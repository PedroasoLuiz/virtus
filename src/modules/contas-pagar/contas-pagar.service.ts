import type { Paginacao, Pagina } from "@/shared/utils/paginacao";
import { hoje } from "@/shared/utils/datas";
import * as repo from "@/modules/contas-pagar/contas-pagar.repository";
import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import {
  conferirTotal,
  paradaNaFila,
  proximaAReceber,
  redefinirParcelas,
  redistribuirTotal,
  type ItemDoParcelamento,
} from "@/shared/domain/parcelas";
import { centavos, formatarSemSimbolo, somar, subtrair, ZERO, type Centavos } from "@/shared/utils/money";
import {
  competenciaBR,
  competenciaDaCompra,
  faturaAceitaLancamento,
  fechamentoDaCompetencia,
  vencimentoDaCompetencia,
} from "@/shared/domain/cartao";
import {
  apagarDocumento,
  caminhoDoDocumento,
  enviarDocumento,
  urlDoDocumento,
} from "@/shared/storage/documentos";
import type {
  BaixaNova,
  BaixaPagar,
  BaixaPagarResumo,
  CartaoDaBaixa,
  CartaoNovo,
  BancoDaLista,
  FaturaDeCartao,
  ContaPagarNova,
  ContaPagarResumo,
  FiltroBaixas,
  FiltroContas,
  IndicadoresDeBaixaPagar,
  LancamentoDaConta,
  ParcelaAPagar,
  TipoDeDocumento,
} from "@/modules/contas-pagar/contas-pagar.types";
import { totalDosLancamentos } from "@/modules/contas-pagar/contas-pagar.types";

/** Regra de negocio de contas a pagar. */

export async function listarContas(
  empresaId: number,
  filtro: FiltroContas,
  paginacao: Paginacao,
): Promise<Pagina<ContaPagarResumo>> {
  return repo.listar(empresaId, filtro, paginacao);
}

export async function listarBaixas(
  empresaId: number,
  filtro: FiltroBaixas,
  paginacao: Paginacao,
): Promise<Pagina<BaixaPagarResumo>> {
  return repo.listarBaixas(empresaId, filtro, paginacao);
}

/**
 * Cada lancamento tem descricao, valor e um centro que a empresa pode usar.
 *
 * ⚠️ NAO ha mais "a soma do rateio tem que bater com o total": a soma DEFINE o
 * total. A conferencia que existia antes protegia contra um total digitado a
 * parte, e esse total deixou de existir — o que sobra e garantir que cada linha
 * seja valida.
 */
async function conferirLancamentos(empresaId: number, entrada: ContaPagarNova): Promise<void> {
  if (entrada.lancamentos.length === 0) {
    throw new BusinessRuleError("A conta precisa de ao menos um lançamento");
  }

  if (entrada.lancamentos.some((l) => l.valor <= 0)) {
    throw new BusinessRuleError("Cada lançamento precisa de um valor maior que zero");
  }

  if (entrada.lancamentos.some((l) => l.descricao.trim().length === 0)) {
    throw new BusinessRuleError("Cada lançamento precisa de uma descrição");
  }

  /*
   * ⚠️ Centro REPETIDO e permitido, e essa e a diferenca para o rateio antigo.
   *
   * Duas linhas no mesmo centro sao duas compras da mesma natureza — dois
   * materiais de escritorio, por exemplo. Somar as duas na digitacao para caber
   * numa linha so apagaria o que cada uma e.
   */
  const ids = entrada.lancamentos
    .map((l) => l.centroCustoId)
    .filter((id): id is number => id != null);

  const validos = await repo.centrosDeDespesaValidos(empresaId, ids);

  if (ids.some((id) => !validos.has(id))) {
    /*
     * ⚠️ A mesma mensagem para "nao existe", "e de outra empresa" e "e de
     * receita". Distinguir contaria a quem sondar quais ids existem no banco de
     * quem, e nenhuma das tres tem conserto diferente na tela.
     */
    throw new BusinessRuleError(
      "Há centro de custo inválido nos lançamentos. Use centros de despesa da sua empresa.",
    );
  }
}

/**
 * As parcelas de um fornecedor esperando dinheiro, ja marcando qual esta liberada.
 *
 * `liberada` sai daqui e nao do banco porque a fila e regra de dominio: a mesma
 * funcao decide o que a tela desabilita e o que o POST recusa, e duas
 * implementacoes divergiriam no primeiro caso de borda.
 */
export async function parcelasAPagar(
  empresaId: number,
  fornecedorId: number,
): Promise<ParcelaAPagar[]> {
  const parcelas = await repo.parcelasAPagar(empresaId, fornecedorId);
  const liberadas = new Set<number>();

  for (const contaId of new Set(parcelas.map((p) => p.contaId))) {
    const proxima = proximaAReceber(paraFila(parcelas, contaId));
    if (proxima) liberadas.add(proxima.id);
  }

  return parcelas.map((p) => ({ ...p, liberada: liberadas.has(p.parcelaId) }));
}

/** As parcelas de uma conta, no formato que a fila entende. */
function paraFila(parcelas: ParcelaAPagar[], contaId: number) {
  return parcelas
    .filter((p) => p.contaId === contaId)
    .map((p) => ({
      id: p.parcelaId,
      numero: p.numero,
      vencimento: p.vencimento,
      total: p.total,
      // A fila do dominio fala em "recebido"; aqui o mesmo lugar guarda o que ja
      // foi quitado. E a mesma pergunta vista do outro lado do caixa.
      recebido: p.quitado,
      pago: false,
    }));
}

/**
 * Registra UM dinheiro que saiu e reparte entre as parcelas que ele quita.
 *
 * O gatilho do banco cuida do resto: recalcula `pago` de cada parcela e
 * `fecha_conta_a_pagar` move o estado da conta. Nada disso e escrito daqui —
 * duas fontes para o mesmo fato divergem no primeiro caminho que esquecer uma.
 */
export async function registrarBaixa(
  empresaId: number,
  usuarioId: string,
  entrada: BaixaNova,
): Promise<number> {
  if (entrada.destinos.length === 0) {
    throw new BusinessRuleError("Escolha ao menos uma parcela");
  }

  const ids = entrada.destinos.map((d) => d.parcelaId);
  if (new Set(ids).size !== ids.length) {
    throw new BusinessRuleError("A mesma parcela aparece duas vezes nesta baixa");
  }

  /*
   * O total do lancamento inclui o acrescimo.
   *
   * `valor` e o que abate divida; juros e multa sairam do banco junto e precisam
   * estar no extrato, senao a linha do Vope fica menor que a do banco em todo
   * pagamento em atraso — e a conciliacao acusa diferenca que nao existe.
   */
  const total = entrada.destinos.reduce<Centavos>(
    (soma, d) => somar(soma, somar(d.valor, somar(d.juros, d.multa))),
    ZERO,
  );
  if (total <= 0) throw new BusinessRuleError("Informe o valor pago");

  /*
   * As parcelas sao conferidas contra o BANCO, e nao contra o que a tela mandou.
   *
   * O corpo vem do navegador e pode estar velho ou adulterado: sem esta
   * consulta, um `parcelaId` trocado a mao quitaria a divida de outro
   * fornecedor, ou ate de outra empresa.
   */
  const donas = await repo.donasDasParcelasAPagar(ids);

  for (const id of ids) {
    const dona = donas.get(id);
    if (!dona || dona.empresaId !== empresaId) {
      throw new NotFoundError("Parcela nao encontrada");
    }
    if (dona.fornecedorId !== entrada.fornecedorId) {
      throw new BusinessRuleError(
        "Há parcela de outro fornecedor nesta baixa. Um pagamento é para um recebedor só.",
      );
    }
  }

  const abertas = await parcelasAPagar(empresaId, entrada.fornecedorId);
  const porId = new Map(abertas.map((p) => [p.parcelaId, p]));

  for (const d of entrada.destinos) {
    const parcela = porId.get(d.parcelaId);

    if (!parcela) throw new BusinessRuleError("Há parcela já quitada nesta baixa.");

    if (d.valor > parcela.emAberto) {
      throw new BusinessRuleError(
        `A parcela ${parcela.numero} da conta ${parcela.contaNumero ?? parcela.contaId} tem apenas ${formatarSemSimbolo(parcela.emAberto)} em aberto.`,
      );
    }
  }

  /*
   * A fila e conferida por CONTA: sao dividas independentes, e travar a segunda
   * porque a primeira atrasou impediria de pagar o que precisa ser pago hoje.
   */
  for (const contaId of new Set(entrada.destinos.map((d) => donas.get(d.parcelaId)!.contaId))) {
    const parada = paradaNaFila(paraFila(abertas, contaId), entrada.destinos);

    if (parada) {
      throw new BusinessRuleError(
        `Na conta ${contaId}, a parcela ${parada.numero} vence antes e continua em aberto. Pague ela primeiro.`,
      );
    }
  }

  /*
   * ⚠️ Quem escolheu quitar tem a diferenca gravada como DESCONTO NO VINCULO, e
   * o `total` da parcela fica intocado.
   *
   * Era o defeito do legado: ele sobrescrevia o total com o valor pago, e depois
   * disso nao havia como saber quanto a parcela valia. O gatilho soma
   * `valor + desconto` justamente para que a parcela feche sem que ninguem
   * precise mentir sobre o quanto ela era.
   */
  const descontos = new Map<number, Centavos>();

  for (const d of entrada.destinos) {
    if (!d.quitar) continue;

    const parcela = porId.get(d.parcelaId)!;
    const diferenca = subtrair(parcela.emAberto, d.valor);
    if (diferenca > 0) descontos.set(d.parcelaId, diferenca);
  }

  /*
   * ⚠️ Ou conta bancaria, OU cartao — nunca os dois, nunca nenhum.
   *
   * Sao duas coisas diferentes: pela conta o dinheiro SAI agora; pelo cartao a
   * divida troca de credor e o dinheiro sai quando a fatura for paga. Aceitando
   * os dois, o mesmo pagamento apareceria no saldo e na fatura.
   */
  if (entrada.cartaoId && entrada.contaBancariaId) {
    throw new BusinessRuleError("Escolha a conta bancária ou o cartão, não os dois");
  }
  if (!entrada.cartaoId && !entrada.contaBancariaId) {
    throw new BusinessRuleError("Escolha de onde o dinheiro sai");
  }

  const cartao = entrada.cartaoId
    ? await repo.cartaoDaEmpresa(empresaId, entrada.cartaoId)
    : null;

  if (entrada.cartaoId && !cartao) throw new NotFoundError("Cartão não encontrado");

  const favorecido = await repo.nomeDoFornecedor(empresaId, entrada.fornecedorId);
  const quantas = entrada.destinos.length;

  /*
   * A linha que aparece no extrato.
   *
   * Diz o favorecido e quantas parcelas, e nao o numero da conta: um pagamento
   * pode cobrir varias, e "conta 42" numa linha que tambem quitou a 51 seria
   * mais enganoso que nao dizer nada.
   */
  const descricao = cartao
    ? `Compra no cartão ${cartao.apelido ?? cartao.id} — ${favorecido ?? "fornecedor"}`
    : `Pagamento a ${favorecido ?? "fornecedor"} (${quantas === 1 ? "1 parcela" : `${quantas} parcelas`})`;

  const pagamentoId = await repo.criarBaixa(
    empresaId,
    usuarioId,
    entrada,
    total,
    descricao,
    descontos,
    favorecido,
  );

  /*
   * No cartao, a compra ainda vira uma linha da FATURA.
   *
   * ⚠️ Isto acontece DEPOIS da baixa, e uma falha aqui nao a desfaz. A divida ao
   * fornecedor ja foi quitada — e verdade, e o gatilho ja fechou a parcela. O
   * que faltaria e a linha da fatura, que se lanca de novo; desfazer a baixa
   * reabriria uma divida que a pessoa acabou de dizer que pagou.
   */
  if (cartao) {
    const competencia = competenciaDaCompra(cartao.diaFechamento, entrada.data);

    const fatura = await repo.faturaDaCompetencia(
      empresaId,
      cartao.id,
      competencia,
      fechamentoDaCompetencia(cartao.diaFechamento, competencia),
      vencimentoDaCompetencia(cartao.diaFechamento, cartao.diaVencimento, competencia),
      usuarioId,
    );

    /*
     * ⚠️ Fatura FECHADA nao recebe mais nada.
     *
     * Ela ja virou conta a pagar com um total; acrescentar uma linha depois
     * faria a fatura somar mais do que a conta que a representa, e a diferenca
     * so apareceria quando o extrato do cartao chegasse.
     */
    if (!faturaAceitaLancamento(fatura.status)) {
      throw new BusinessRuleError(
        `A fatura de ${competenciaBR(competencia)} já está fechada. Lance na competência seguinte ou reabra a fatura.`,
      );
    }

    /*
     * ⚠️ O centro de custo vem de cada PARCELA da conta a pagar, e nao do
     * cabecalho. E o rateio que a conta ja tem: a linha da fatura herda a
     * classificacao que a despesa recebeu quando foi cadastrada.
     */
    const classificacao = await repo.centroDeCustoDasParcelas(ids);

    await repo.lancarNaFatura(
      empresaId,
      fatura.id,
      cartao.id,
      usuarioId,
      entrada.destinos.map((d) => ({
        fornecedorId: entrada.fornecedorId,
        descricao: `${favorecido ?? "Fornecedor"} — parcela ${porId.get(d.parcelaId)?.numero ?? ""}`.trim(),
        dataCompra: entrada.data,
        competencia,
        valor: d.valor,
        centroCustoId: classificacao.get(d.parcelaId) ?? null,
      })),
    );
  }

  return pagamentoId;
}

export async function faturasDoCartao(
  empresaId: number,
  cartaoId?: number,
): Promise<FaturaDeCartao[]> {
  return repo.faturasDoCartao(empresaId, cartaoId);
}

/**
 * Fecha a fatura e gera a conta a pagar que a representa.
 *
 * ⚠️ Fechar e MANUAL, e nao um processo que roda na data. A fatura pode receber
 * lancamento atrasado depois da data de fechamento — a nota chega depois —, e
 * uma rotina automatica trancaria o ciclo no meio do trabalho de quem estava
 * digitando. Quem fecha decide que acabou.
 *
 * ⚠️ A conta a pagar gerada NAO tem centro de custo, e isso e o coracao do
 * modelo. Ela e LIQUIDACAO, e nao despesa nova: o custo ja foi lancado quando
 * cada compra virou linha da fatura, com o centro dela. Repetindo o centro aqui,
 * a mesma despesa entraria duas vezes na DRE — uma no mes da compra e outra no
 * mes da fatura.
 */
export async function fecharFatura(
  empresaId: number,
  usuarioId: string,
  faturaId: number,
): Promise<number> {
  const faturas = await repo.faturasDoCartao(empresaId);
  const fatura = faturas.find((f) => f.id === faturaId);

  if (!fatura) throw new NotFoundError("Fatura nao encontrada");
  if (!faturaAceitaLancamento(fatura.status)) {
    throw new BusinessRuleError("Esta fatura já está fechada");
  }

  const total = await repo.totalDaFatura(faturaId);

  /*
   * ⚠️ Fatura zerada nao vira conta a pagar. Uma conta de zero real seria
   * cobranca que nao existe, e ela ficaria para sempre em aberto na listagem
   * porque nao ha o que pagar.
   */
  if (total <= 0) {
    throw new BusinessRuleError("Esta fatura não tem lançamentos. Não há o que fechar.");
  }

  const cartao = await repo.cartaoDaEmpresa(empresaId, fatura.cartaoId);
  if (!cartao) throw new NotFoundError("Cartão não encontrado");

  /*
   * ⚠️ O fornecedor e resolvido AQUI, e nao exigido no cadastro do cartao.
   *
   * Na tela se escolhe o BANCO, que e o que a pessoa sabe. O cadastro que recebe
   * o dinheiro e detalhe contabil, e ele so precisa existir no momento em que a
   * conta a pagar nasce. Resolvido uma vez, fica gravado no cartao.
   */
  let fornecedorId = cartao.fornecedorId;

  if (!fornecedorId) {
    if (!cartao.bancoNome) {
      throw new BusinessRuleError(
        "Este cartão não tem emissor. Escolha o banco no cadastro do cartão.",
      );
    }

    fornecedorId = await repo.fornecedorDoBanco(empresaId, usuarioId, cartao.bancoNome);
    await repo.ligarFornecedorAoCartao(cartao.id, usuarioId, fornecedorId);
  }

  const tipos = await repo.listarTiposDeDocumento();
  const especie = tipos.find((t) => t.sigla.toUpperCase() === "FAT") ?? tipos[0];

  if (!especie) throw new BusinessRuleError("Nenhuma espécie de documento cadastrada");

  const descricao = `Fatura do cartão ${cartao.apelido ?? cartao.id} · ${competenciaBR(fatura.competencia)}`;
  const vencimento = fatura.vencimento ?? hoje();

  const contaId = await criarConta(empresaId, usuarioId, {
    fornecedorId,
    descricao,
    emissao: fatura.fechamento ?? hoje(),
    /*
     * UM lancamento, SEM centro de custo. A regra do modulo exige ao menos um
     * lancamento — a conta e a soma deles —, e aqui ele existe so para carregar
     * o valor. O centro fica nulo pelo motivo do bloco acima.
     */
    lancamentos: [{ descricao, valor: total, centroCustoId: null }],
    origem: { tipo: "CARTAO", ordemId: fatura.id },
    documento: competenciaBR(fatura.competencia),
    tipoDocumentoId: especie.id,
    observacoes: null,
    // Uma parcela: a fatura vence de uma vez, na data do cartao.
    parcelas: [{ vencimento, valor: total }],
  });

  await repo.marcarFaturaFechada(faturaId, usuarioId, total, contaId);
  return contaId;
}

export async function listarBancos(): Promise<BancoDaLista[]> {
  return repo.listarBancos();
}

export async function cartoesDaEmpresa(empresaId: number): Promise<CartaoDaBaixa[]> {
  return repo.cartoesDaEmpresa(empresaId);
}

/**
 * Cadastra um cartao.
 *
 * ⚠️ O numero e RECORTADO aqui, e nao confiado a tela. O corpo vem do navegador:
 * se alguem mandar o PAN inteiro, e este ponto que impede o banco de guarda-lo.
 * A tela tambem limita, mas limite de tela e conveniencia, nao garantia.
 */
export async function criarCartao(
  empresaId: number,
  usuarioId: string,
  entrada: CartaoNovo,
): Promise<number> {
  if (entrada.apelido.trim().length === 0) {
    throw new BusinessRuleError("O cartão precisa de um apelido");
  }

  const digitos = (entrada.ultimosDigitos ?? "").replace(/\D/g, "");

  return repo.criarCartao(empresaId, usuarioId, {
    ...entrada,
    apelido: entrada.apelido.trim(),
    ultimosDigitos: digitos ? digitos.slice(-4) : null,
  });
}

export async function listarTiposDeDocumento(): Promise<TipoDeDocumento[]> {
  return repo.listarTiposDeDocumento();
}

export async function obterBaixa(empresaId: number, id: number): Promise<BaixaPagar> {
  const baixa = await repo.buscarBaixaPorId(empresaId, id);
  if (!baixa) throw new NotFoundError("Baixa nao encontrada");
  return baixa;
}

/**
 * Os numeros dos cartoes do topo da listagem de baixas.
 *
 * A janela e de seis meses pelo mesmo motivo do lado que recebe: menos que isso
 * nao desenha tendencia, e mais aperta a serie a ponto de a variacao sumir.
 */
export async function indicadoresDeBaixas(
  empresaId: number,
  hojeISO: string,
): Promise<IndicadoresDeBaixaPagar> {
  const mes = hojeISO.slice(0, 7);
  return repo.indicadoresDeBaixas(empresaId, mesesAtras(mes, MESES_DO_GRAFICO - 1), mes);
}

/** Quantos meses o cartao do topo desenha, contando o corrente. */
export const MESES_DO_GRAFICO = 6;

/**
 * "AAAA-MM" recuado N meses.
 *
 * ⚠️ Sobre a string, e nao sobre `Date`. O mes aqui e prefixo do que o banco
 * guarda em `data`, que nao tem hora; passando por `Date`, o fuso do servidor
 * empurra o primeiro dia do mes para o mes anterior e a janela abre errada.
 */
function mesesAtras(mes: string, quantos: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) - quantos;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Troca os lancamentos de uma conta que ainda nao recebeu pagamento.
 *
 * ⚠️ So enquanto NADA foi pago, e a razao nao e tecnica. Ao primeiro centavo a
 * conta vira DOCUMENTO: alguem pagou contra um valor, e mexer no total depois
 * faria o comprovante que existe apontar para uma divida que mudou de tamanho.
 * A mesma regra do lado que recebe, onde o ticket so entra e sai antes da
 * primeira baixa.
 *
 * ⚠️ Mudar o total NAO regenera o cronograma: os vencimentos ficam e os VALORES
 * se redistribuem. Regenerando, as datas que alguem combinou com o fornecedor
 * seriam trocadas por um "a cada 30 dias" que ninguem pediu.
 */
export async function substituirLancamentos(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  lancamentos: LancamentoDaConta[],
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);

  if (conta.cancelada) {
    throw new BusinessRuleError("Conta cancelada não se edita");
  }
  if (conta.parcelasPagas > 0) {
    throw new BusinessRuleError(
      "Esta conta já tem parcela paga. O valor não muda depois do primeiro pagamento.",
    );
  }

  await conferirLancamentos(empresaId, { ...conta, lancamentos } as unknown as ContaPagarNova);

  const total = centavos(totalDosLancamentos(lancamentos));
  if (total <= 0) {
    throw new BusinessRuleError("O total da conta precisa ser maior que zero");
  }

  /*
   * ⚠️ A redistribuicao roda ANTES da gravacao, e de proposito.
   *
   * `redistribuirTotal` recusa total pequeno demais para o numero de parcelas —
   * quatro parcelas e tres centavos deixariam uma sem nada. Chamada depois de
   * gravar, a conta ficaria com lancamentos novos e parcelas velhas, somando
   * coisas diferentes.
   */
  const novasParcelas = redistribuirTotal(
    conta.parcelas.map((p) => ({
      id: p.id,
      numero: p.numero,
      vencimento: p.vencimento ?? hoje(),
      valor: p.valor,
      pago: p.pago,
    })),
    total,
  );

  await repo.substituirLancamentos(contaId, usuarioId, lancamentos);
  await repo.atualizarTotal(contaId, usuarioId, total);
  await repo.atualizarValoresDasParcelas(contaId, usuarioId, novasParcelas);
}

/**
 * A anotacao de quem trabalha na conta.
 *
 * ⚠️ Editavel mesmo em conta ja paga, e de proposito. Observacao nao e valor: ela
 * nao muda o que se deve nem o que se pagou, e o registro do que aconteceu
 * costuma ser escrito DEPOIS — "paguei adiantado e negociei desconto" so existe
 * depois do pagamento. Travar junto com o valor calaria justamente quem tem o
 * que contar.
 *
 * Cancelada continua fora: ali a conta inteira parou.
 */
export async function atualizarObservacoes(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  observacoes: string | null,
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);
  if (conta.cancelada) throw new BusinessRuleError("Conta cancelada não se edita");

  await repo.atualizarObservacoes(empresaId, contaId, usuarioId, observacoes);
}

/**
 * Redesenha o cronograma da conta sem mexer no TOTAL.
 *
 * ⚠️ Diferente de editar lancamentos: la o total muda e as parcelas se ajustam;
 * aqui o total esta fixo e o que muda e como ele se reparte. Por isso esta
 * funciona mesmo com parcela ja paga — o que ela nao deixa e tocar NAS pagas.
 * E o pedido mais comum que existe ("divide o resto em duas"), e travar a conta
 * inteira obrigaria a cancelar tudo e refazer.
 */
export async function redefinirParcelasDaConta(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  itens: ItemDoParcelamento[],
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);
  if (conta.cancelada) throw new BusinessRuleError("Conta cancelada não se edita");

  const editaveis = conta.parcelas.map((p) => ({
    id: p.id,
    numero: p.numero,
    vencimento: p.vencimento ?? hoje(),
    valor: p.total,
    pago: p.pago,
  }));

  const plano = redefinirParcelas(editaveis, itens, conta.total);

  /*
   * Barato, e transforma um erro de centavos num 422 explicito em vez de numa
   * divida silenciosamente errada. As PAGAS entram na soma: elas nao mudam, mas
   * continuam fazendo parte do total.
   */
  conferirTotal(
    [...conta.parcelas.filter((p) => p.pago).map((p) => ({ valor: p.total })), ...plano.atualizar, ...plano.criar],
    conta.total,
  );

  await repo.aplicarParcelamento(contaId, usuarioId, plano);

  /*
   * A tela pode ter TIRADO parcelas, e com elas some quem segurava o arquivo.
   *
   * ⚠️ Depois da escrita e sem derrubar a operacao: a parcela ja saiu, e um
   * arquivo orfao custa espaco — devolver erro faria a tela dizer que nao deu
   * certo uma mudanca que ja esta gravada.
   */
  for (const id of plano.excluir) {
    const parcela = conta.parcelas.find((p) => p.id === id);
    if (!parcela) continue;

    for (const referencia of [parcela.boleto, parcela.nfs, parcela.comprovante]) {
      if (referencia) await apagarDocumento(referencia).catch(() => {});
    }
  }
}

// ── Documentos da parcela ───────────────────────────────────────────────────

/**
 * A nota, o boleto e o comprovante ficam na PARCELA, e nao na conta.
 *
 * Conta de tres parcelas tem tres boletos e tres comprovantes: guardados no
 * cabecalho, o segundo pagamento sobrescreveria a prova do primeiro.
 */
export async function anexarDocumentoDaParcela(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  parcelaId: number,
  tipo: "nfs" | "boleto" | "comprovante",
  arquivo: File,
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);
  const parcela = conta.parcelas.find((p) => p.id === parcelaId);

  if (!parcela) throw new NotFoundError("Parcela nao encontrada nesta conta");
  if (conta.cancelada) throw new BusinessRuleError("Conta cancelada nao recebe documento");

  const caminho = caminhoDoDocumento(empresaId, contaId, tipo, arquivo.name, "contas-pagar");
  await enviarDocumento(caminho, arquivo);

  /*
   * O anterior so e apagado DEPOIS que o novo entrou e o registro aponta para
   * ele. Na ordem inversa, uma falha no meio deixaria a parcela sem documento
   * nenhum — e o arquivo velho ja destruido.
   */
  const anterior = parcela[tipo];
  await repo.gravarDocumentoDaParcela(parcelaId, usuarioId, tipo, caminho);
  if (anterior) await apagarDocumento(anterior);
}

export async function removerDocumentoDaParcela(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  parcelaId: number,
  tipo: "nfs" | "boleto" | "comprovante",
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);
  const parcela = conta.parcelas.find((p) => p.id === parcelaId);

  if (!parcela) throw new NotFoundError("Parcela nao encontrada nesta conta");

  const referencia = parcela[tipo];
  if (!referencia) return;

  await repo.gravarDocumentoDaParcela(parcelaId, usuarioId, tipo, null);
  await apagarDocumento(referencia);
}

/** Link temporario para abrir o documento da parcela. */
export async function linkDoDocumentoDaParcela(
  empresaId: number,
  contaId: number,
  parcelaId: number,
  tipo: "nfs" | "boleto" | "comprovante",
): Promise<string> {
  /*
   * ⚠️ Procurado dentro da CONTA, que ja foi lida sob a RLS do usuario. Assinar
   * pelo id da parcela direto geraria link para documento de outra empresa a
   * quem soubesse chutar um numero.
   */
  const conta = await obterConta(empresaId, contaId);
  const parcela = conta.parcelas.find((p) => p.id === parcelaId);
  const referencia = parcela?.[tipo];

  if (!referencia) throw new NotFoundError("Documento nao encontrado");
  return urlDoDocumento(referencia);
}

// ── Anexos ──────────────────────────────────────────────────────────────────

export async function anexarNaConta(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  arquivo: File,
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);
  if (conta.cancelada) throw new BusinessRuleError("Conta cancelada nao recebe anexo");

  const caminho = caminhoDoDocumento(empresaId, contaId, "anexo", arquivo.name, "contas-pagar");
  await enviarDocumento(caminho, arquivo);
  await repo.criarAnexo(contaId, usuarioId, {
    nome: arquivo.name,
    caminho,
    tipo: arquivo.type,
  });
}

export async function removerAnexoDaConta(
  empresaId: number,
  contaId: number,
  anexoId: number,
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);
  if (!conta.anexos.some((a) => a.id === anexoId)) {
    throw new NotFoundError("Anexo nao encontrado nesta conta");
  }

  /*
   * O registro sai primeiro, o arquivo depois. Na ordem inversa, uma falha no
   * meio deixaria a linha apontando para um arquivo que nao existe mais — e a
   * tela mostraria um anexo que nao abre.
   */
  const anexo = await repo.apagarAnexo(anexoId);
  if (anexo) await apagarDocumento(anexo.caminho);
}

export async function linkDoAnexo(
  empresaId: number,
  contaId: number,
  anexoId: number,
): Promise<string> {
  /*
   * ⚠️ O anexo e procurado dentro da CONTA, que ja foi lida sob a RLS do
   * usuario. Assinar pelo id do anexo direto geraria link para arquivo de outra
   * empresa a quem soubesse chutar um numero.
   */
  const conta = await obterConta(empresaId, contaId);
  const anexo = conta.anexos.find((a) => a.id === anexoId);

  if (!anexo) throw new NotFoundError("Anexo nao encontrado");
  return urlDoDocumento(anexo.caminho);
}

export async function obterConta(empresaId: number, id: number) {
  const conta = await repo.buscarPorId(empresaId, id);
  if (!conta) throw new NotFoundError("Conta a pagar nao encontrada");
  return conta;
}

/**
 * Cria uma conta a pagar com o cronograma que a tela montou.
 *
 * A conta e `fornecedor + descricao + valor + parcelamento`. Compra e servico
 * contratado nao precisam de caminhos diferentes: quando o modulo de compras
 * existir, ele vira a ORIGEM desta mesma conta, do mesmo jeito que o ticket
 * gera a conta a receber.
 */
export async function criarConta(
  empresaId: number,
  usuarioId: string,
  entrada: ContaPagarNova,
): Promise<number> {
  const dono = await repo.pertencemAEmpresa(
    empresaId,
    entrada.fornecedorId,
    entrada.tipoDocumentoId,
  );

  if (!dono.fornecedor) throw new NotFoundError("Fornecedor nao encontrado");
  if (!dono.tipoDocumento) throw new NotFoundError("Tipo de documento nao encontrado");

  /*
   * ⚠️ Centro de RECEITA nao entra numa conta a pagar, e quem barra isso e o
   * `conferirRateio`.
   *
   * O tipo do centro diz de que lado do resultado a linha cai: uma despesa
   * apontando para centro de receita entra na DRE somando onde deveria subtrair,
   * e o resultado do mes fica errado nos dois sentidos ao mesmo tempo.
   */
  await conferirLancamentos(empresaId, entrada);

  /*
   * O numero sai da sequencia DEPOIS das conferencias.
   *
   * Ele e consumido de forma irreversivel: pegando antes, toda tentativa
   * recusada por fornecedor invalido queimaria um numero e a contagem da empresa
   * ficaria cheia de buracos que ninguem sabe explicar.
   */
  const numero = await repo.proximoNumero(empresaId);

  /*
   * Sem descricao propria, a conta herda a do PRIMEIRO lancamento.
   *
   * A listagem precisa de um nome, e pedi-lo a parte fazia escrever duas vezes a
   * mesma coisa. Com varios lancamentos, o primeiro e o que a pessoa digitou
   * primeiro — e o que ela chamaria a conta se perguntassem.
   */
  const descricao = entrada.descricao?.trim() || entrada.lancamentos[0].descricao;

  /*
   * ⚠️ O total e CALCULADO, e nao recebido.
   *
   * Ele e a soma dos lancamentos (desconto subtraindo), pela mesma funcao pura
   * que a tela usa enquanto se digita. Recebendo o total do corpo, o primeiro
   * pedido em que ele discordasse das linhas gravaria uma conta que nao fecha
   * consigo mesma — e nada acusaria.
   */
  const total = centavos(totalDosLancamentos(entrada.lancamentos));

  if (total <= 0) {
    throw new BusinessRuleError(
      "O total da conta precisa ser maior que zero. Confira os descontos.",
    );
  }

  /*
   * ⚠️ O cronograma vem da TELA, e o servidor confere a soma.
   *
   * A grade e editavel: quem cadastra move vencimento e reparte valor antes de
   * salvar. `conferirTotal` transforma um erro de centavos num 422 explicito em
   * vez de numa divida que nao fecha consigo mesma.
   */
  const parcelas = entrada.parcelas.map((p, i) => ({
    numero: i + 1,
    vencimento: p.vencimento,
    valor: p.valor,
  }));

  conferirTotal(parcelas, total);

  return repo.criar(empresaId, usuarioId, numero, { ...entrada, descricao }, total, parcelas);
}


/**
 * Cancela uma parcela: ela foi combinada, mas nao vai mais acontecer.
 *
 * ⚠️ Isto NAO e apagar. A conta continua dizendo que o acordo previa doze
 * parcelas, e e isso que se explica seis meses depois; o que muda e que ela
 * para de ser cobrada e sai do "em aberto".
 *
 * ⚠️ Parcela PAGA nao se cancela. Dinheiro que saiu nao vira "nao vai
 * acontecer" — e um adiantamento pago em maio para uma parcela de julho e
 * exatamente esse caso. Para desfazer um pagamento existe estornar a baixa.
 *
 * ⚠️ Uma de cada vez, pelo menu da propria linha. Uma acao de "encerrar a partir
 * de tal data" decidia por varias parcelas de uma vez, e obrigava a confiar num
 * corte que a tela nao mostrava antes de gravar.
 */
export async function cancelarParcelaDaConta(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  parcelaId: number,
  motivo: string | null,
): Promise<void> {
  const conta = await obterConta(empresaId, contaId);
  if (conta.cancelada) throw new BusinessRuleError("Esta conta está cancelada");

  const parcela = conta.parcelas.find((p) => p.id === parcelaId);
  if (!parcela) throw new NotFoundError("Parcela nao encontrada nesta conta");
  if (parcela.pago) {
    throw new BusinessRuleError(
      "Parcela paga não se cancela: estorne a baixa antes, se o pagamento não aconteceu",
    );
  }

  const feito = await repo.cancelarParcela(contaId, parcelaId, usuarioId, motivo?.trim() || null);
  if (!feito) throw new NotFoundError("Parcela nao encontrada nesta conta");
}

/** Desfaz o cancelamento: a parcela volta a ser cobrada. */
export async function reativarParcelaDaConta(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  parcelaId: number,
): Promise<void> {
  await obterConta(empresaId, contaId);

  const feito = await repo.reativarParcela(contaId, parcelaId, usuarioId);
  if (!feito) throw new NotFoundError("Parcela nao encontrada nesta conta");
}


/**
 * Estorna a baixa: o dinheiro nao saiu, e as parcelas voltam a ficar em aberto.
 *
 * Espelho do `estornarRecebimento`. Correcao de baixa e estorno, e nao edicao:
 * mexer no valor de um pagamento ja lancado reescreveria o que talvez ja tenha
 * virado comprovante na mao do fornecedor.
 *
 * ⚠️ CONCILIADA nao se estorna. A linha do extrato aponta para este pagamento:
 * apagando-o, o banco continuaria dizendo que o dinheiro saiu e o sistema nao
 * teria mais onde encaixar aquela linha. Desfazer a conciliacao primeiro e o
 * caminho, e ele existe na tela de conciliacao.
 *
 * ⚠️ Baixa no CARTAO tambem nao, e o motivo e que ela deixou rastro fora daqui:
 * a compra virou linha da fatura do cartao, e `cartaofaturasparcelas` nao guarda
 * de qual pagamento veio. Apagando so o pagamento, a fatura continuaria cobrando
 * uma compra que o sistema deu por desfeita. O reconhecimento e por
 * `fkContaBancaria` nulo, que e o mesmo mecanismo que mantem a baixa no cartao
 * fora do saldo.
 */
export async function estornarBaixa(
  empresaId: number,
  id: number,
): Promise<void> {
  const baixa = await repo.baixaParaEstorno(empresaId, id);
  if (!baixa) throw new NotFoundError("Baixa nao encontrada");

  if (baixa.conciliado) {
    throw new BusinessRuleError(
      "Esta baixa já foi conciliada. Desfaça a conciliação antes de estornar.",
    );
  }

  if (baixa.contaBancariaId == null) {
    throw new BusinessRuleError(
      "Baixa feita no cartão: remova a compra da fatura do cartão antes de estornar.",
    );
  }

  await repo.apagarBaixa(id);
}
