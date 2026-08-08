import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import { previsaoDeCredito } from "@/shared/domain/recebimento";
import { formatarSemSimbolo, somar, subtrair, type Centavos, ZERO } from "@/shared/utils/money";
import type { Pagina, Paginacao } from "@/shared/utils/paginacao";
import { paradaNaFila, proximaAReceber } from "@/shared/domain/parcelas";
import type { ParametrosDeCobranca } from "@/shared/domain/cobranca";
import * as repo from "@/modules/recebimentos/recebimentos.repository";
import type {
  FiltroRecebimentos,
  ParcelaEmAberto,
  Recebimento,
  RecebimentoNovo,
  RecebimentoResumo,
} from "@/modules/recebimentos/recebimentos.types";

/**
 * Regra de negocio do recebimento.
 *
 * A pergunta central: um dinheiro entrou, para onde ele vai. Tudo aqui existe
 * para que a resposta continue verdadeira depois — que a soma dos destinos bata
 * com o lancamento, que nenhuma parcela receba mais do que deve, e que a fila de
 * cada conta seja respeitada.
 */

export async function listarRecebimentos(
  empresaId: number,
  filtro: FiltroRecebimentos,
  paginacao: Paginacao,
): Promise<Pagina<RecebimentoResumo>> {
  return repo.listar(empresaId, filtro, paginacao);
}

export async function obterRecebimento(empresaId: number, id: number): Promise<Recebimento> {
  const recebimento = await repo.buscarPorId(empresaId, id);
  if (!recebimento) throw new NotFoundError("Recebimento nao encontrado");
  return recebimento;
}

/**
 * As parcelas de um cliente esperando dinheiro, ja marcando qual esta liberada.
 *
 * `liberada` e calculada aqui e nao no banco porque a fila e regra de dominio:
 * a mesma funcao decide o que a tela desabilita e o que o POST recusa, e duas
 * implementacoes divergiriam no primeiro caso de borda.
 */
export async function parcelasEmAberto(
  empresaId: number,
  clienteId: number,
): Promise<ParcelaEmAberto[]> {
  const parcelas = await repo.parcelasEmAberto(empresaId, clienteId);
  const liberadas = new Set<number>();

  for (const faturaId of new Set(parcelas.map((p) => p.faturaId))) {
    const proxima = proximaAReceber(paraFila(parcelas, faturaId));
    if (proxima) liberadas.add(proxima.id);
  }

  return parcelas.map((p) => ({ ...p, liberada: liberadas.has(p.parcelaId) }));
}

/**
 * O que o cliente deve, com a politica de atraso que vale para ele.
 *
 * As duas coisas na mesma resposta porque a tela precisa das duas ao mesmo tempo
 * e uma nao serve sem a outra: sem as parcelas nao ha o que cobrar, sem a
 * politica o juros nao se calcula. Duas chamadas produziriam um estado
 * intermediario em que a tela mostra parcela vencida e acrescimo zero.
 */
export async function carteiraDoCliente(
  empresaId: number,
  clienteId: number,
): Promise<{ parcelas: ParcelaEmAberto[]; cobranca: ParametrosDeCobranca }> {
  const [parcelas, cobranca] = await Promise.all([
    parcelasEmAberto(empresaId, clienteId),
    repo.parametrosDeCobranca(empresaId, clienteId),
  ]);

  return { parcelas, cobranca };
}

/**
 * Registra UM dinheiro que entrou e reparte entre as parcelas que ele paga.
 *
 * O gatilho do banco cuida do resto: recalcula `pago` de cada parcela e move o
 * status de cada conta. Nada disso e escrito daqui — duas fontes para o mesmo
 * fato divergem no primeiro caminho que esquecer de atualizar uma delas.
 */
export async function registrarRecebimento(
  empresaId: number,
  usuarioId: string,
  entrada: RecebimentoNovo,
): Promise<Recebimento> {
  if (entrada.destinos.length === 0) {
    throw new BusinessRuleError("Escolha ao menos uma parcela");
  }

  const ids = entrada.destinos.map((d) => d.parcelaId);
  if (new Set(ids).size !== ids.length) {
    throw new BusinessRuleError("A mesma parcela aparece duas vezes no recebimento");
  }

  /*
   * O total do lancamento inclui o acrescimo.
   *
   * `valor` e o que abate divida; juros e multa entraram no banco junto e
   * precisam estar no extrato, senao a linha do VPay fica menor que a do banco
   * em todo pagamento em atraso — e a conciliacao acusa diferenca que nao existe.
   */
  const total = entrada.destinos.reduce<Centavos>(
    (soma, d) => somar(soma, somar(d.valor, somar(d.juros, d.multa))),
    ZERO,
  );
  if (total <= 0) throw new BusinessRuleError("Informe o valor recebido");

  /*
   * ⚠️ A taxa nao pode comer o recebimento inteiro.
   *
   * Uma taxa igual ou maior que o valor significa que o dinheiro nao entrou, e
   * isso nao e recebimento: e digito trocado. Deixando passar, a conta fecharia
   * como paga com zero no extrato.
   */
  const taxa = entrada.taxa ?? (ZERO as Centavos);
  if (taxa < 0) throw new BusinessRuleError("A taxa nao pode ser negativa");
  if (taxa >= total) {
    throw new BusinessRuleError("A taxa nao pode ser igual nem maior que o valor recebido");
  }

  /*
   * ⚠️ Quando o dinheiro CAI, que nao e quando o cliente pagou.
   *
   * Sem data informada, o prazo sai da forma de recebimento: cartao credita em
   * D+30, boleto no dia util seguinte, PIX na hora. A tela sugere o mesmo numero,
   * e quem cadastra corrige quando o contrato com a adquirente e outro.
   */
  const dataCredito = entrada.dataCredito ?? previsaoDeCredito(entrada.tipo, entrada.data);

  if (dataCredito < entrada.data) {
    throw new BusinessRuleError("O dinheiro nao pode cair antes de o cliente pagar");
  }

  /*
   * As parcelas sao conferidas contra o BANCO, e nao contra o que a tela mandou.
   *
   * O corpo vem do navegador e pode estar velho ou adulterado: sem esta
   * consulta, um `parcelaId` trocado a mao baixaria a divida de outro cliente,
   * ou ate de outra empresa.
   */
  const donas = await repo.donasDasParcelas(ids);

  for (const id of ids) {
    const dona = donas.get(id);
    if (!dona || dona.empresaId !== empresaId) {
      throw new NotFoundError("Parcela nao encontrada");
    }
    if (dona.clienteId !== entrada.clienteId) {
      throw new BusinessRuleError(
        "Ha parcela de outro cliente neste recebimento. Um pagamento e de um pagador so.",
      );
    }
  }

  const abertas = await repo.parcelasEmAberto(empresaId, entrada.clienteId);
  const porId = new Map(abertas.map((p) => [p.parcelaId, p]));

  for (const d of entrada.destinos) {
    const parcela = porId.get(d.parcelaId);

    if (!parcela) {
      throw new BusinessRuleError("Ha parcela ja quitada neste recebimento.");
    }
    if (d.valor > parcela.emAberto) {
      throw new BusinessRuleError(
        `A parcela ${parcela.numero} da conta ${parcela.faturaNumero} tem apenas ${formatarSemSimbolo(parcela.emAberto)} em aberto.`,
      );
    }
  }

  // A fila e conferida por CONTA: sao acordos independentes, e travar a segunda
  // porque a primeira atrasou impediria de receber dinheiro que entrou mesmo.
  for (const faturaId of new Set(entrada.destinos.map((d) => donas.get(d.parcelaId)!.faturaId))) {
    const parada = paradaNaFila(paraFila(abertas, faturaId), entrada.destinos);

    if (parada) {
      throw new BusinessRuleError(
        `Na conta ${faturaId}, a parcela ${parada.numero} vence antes e continua em aberto. Receba ela primeiro.`,
      );
    }
  }

  /*
   * Quem escolheu quitar tem a diferenca abatida ANTES do rateio: o gatilho
   * compara o recebido com o total, e o total precisa ja estar reduzido quando
   * ele rodar. Na ordem inversa a parcela ficaria um instante "nao paga".
   */
  const descontos = new Map<number, Centavos>();

  for (const d of entrada.destinos) {
    if (!d.quitar) continue;

    const parcela = porId.get(d.parcelaId)!;
    const novoTotal = somar(parcela.recebido, d.valor);
    const diferenca = subtrair(parcela.total, novoTotal);

    if (diferenca > 0) {
      await repo.encerrarDiferenca(d.parcelaId, usuarioId, novoTotal, diferenca);
      descontos.set(d.parcelaId, diferenca);
    }
  }

  const pagador = await repo.nomeDoCliente(empresaId, entrada.clienteId);
  const quantas = entrada.destinos.length;

  const id = await repo.criar(
    empresaId,
    usuarioId,
    // A data do credito ja resolvida: o repositorio grava, nao decide.
    { ...entrada, dataCredito, taxa },
    total,
    /*
     * A linha que aparece no extrato.
     *
     * Diz o pagador e quantas parcelas, e nao o numero da conta a receber: um
     * recebimento pode cobrir varias, e "conta 214" numa linha que tambem quitou
     * a 220 e a 231 seria mais enganoso que nao dizer nada.
     */
    `Recebimento de ${pagador ?? "cliente"} (${quantas === 1 ? "1 parcela" : `${quantas} parcelas`})`,
    descontos,
    pagador,
  );

  return obterRecebimento(empresaId, id);
}

/**
 * Desfaz um recebimento inteiro.
 *
 * ⚠️ Recusa depois de conciliado. Conciliar significa "conferi no extrato e
 * bate": apagar o lancamento depois disso desfaz uma conferencia que alguem
 * assinou, e o proximo fechamento nao teria como saber que ele existiu. Erro
 * encontrado depois da conciliacao se conserta com um lancamento novo, nao
 * apagando o antigo.
 *
 * Estorno e o gesto certo para o caso comum: lancei errado agora e quero
 * refazer. Por isso ele existe enquanto a linha ainda nao foi conferida.
 */
export async function estornarRecebimento(
  empresaId: number,
  usuarioId: string,
  id: number,
): Promise<void> {
  const recebimento = await obterRecebimento(empresaId, id);

  if (recebimento.conciliado) {
    throw new BusinessRuleError(
      "Este recebimento já foi conciliado. Desfaça a conciliação antes de estornar.",
    );
  }

  /*
   * O desconto volta ANTES de o rateio sair.
   *
   * O gatilho compara o recebido com o total da parcela; com o total ainda
   * reduzido, a parcela passaria um instante valendo menos do que vale, e quem
   * lesse o saldo nesse intervalo veria uma divida encolhida sem motivo.
   */
  for (const d of recebimento.destinos) {
    if (d.desconto > 0) await repo.devolverDesconto(d.parcelaId, usuarioId, d.desconto);
  }

  await repo.apagar(id);
}

/** As parcelas de uma conta, no formato que a fila entende. */
function paraFila(parcelas: ParcelaEmAberto[], faturaId: number) {
  return parcelas
    .filter((p) => p.faturaId === faturaId)
    .map((p) => ({
      id: p.parcelaId,
      numero: p.numero,
      vencimento: p.vencimento,
      total: p.total,
      recebido: p.recebido,
      pago: false,
    }));
}
