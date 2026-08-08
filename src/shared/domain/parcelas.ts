import { BusinessRuleError } from "@/shared/errors/app-error";
import {
  dividir,
  somar,
  subtrair,
  type Centavos,
  ZERO,
} from "@/shared/utils/money";
import {
  diffEmDias,
  proximoDiaUtil,
  somarDias,
  type DataISO,
} from "@/shared/utils/datas";

/**
 * Parcelamento — regra compartilhada entre contas a receber (faturas) e contas
 * a pagar. No legado eram dois arquivos quase identicos que ja divergiam entre
 * si (docs/04 §1 e §3); aqui e uma implementacao so.
 *
 * Funcoes puras: nao tocam banco, nao conhecem HTTP, nao dependem de relogio.
 * Sao o unico lugar do sistema onde o cronograma de um titulo e decidido, e por
 * isso o alvo natural dos testes.
 *
 * INVARIANTE, valido em toda operacao deste arquivo:
 *     soma(parcelas.valor) === total do titulo
 */

export type Parcela = {
  numero: number;
  vencimento: DataISO;
  valor: Centavos;
};

export type ParcelaExistente = Parcela & {
  id: number;
  pago: boolean;
};

export const INTERVALO_PADRAO_DIAS = 30;
const MAX_PARCELAS = 360;

// ── Geracao ─────────────────────────────────────────────────────────────────

export type EntradaGerar = {
  total: Centavos;
  quantidade: number;
  primeiroVencimento: DataISO;
  intervaloDias?: number;
};

/**
 * Monta o cronograma de um titulo novo.
 *
 * Cada vencimento e empurrado para o proximo dia util. A divisao distribui o
 * resto de centavos entre as primeiras parcelas em vez de acumular tudo na
 * ultima, como fazia o legado.
 */
export function gerarParcelas({
  total,
  quantidade,
  primeiroVencimento,
  intervaloDias = INTERVALO_PADRAO_DIAS,
}: EntradaGerar): Parcela[] {
  if (total <= 0) {
    throw new BusinessRuleError("Total do titulo deve ser maior que zero");
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_PARCELAS) {
    throw new BusinessRuleError(`Quantidade de parcelas deve estar entre 1 e ${MAX_PARCELAS}`);
  }
  if (!Number.isInteger(intervaloDias) || intervaloDias < 1) {
    throw new BusinessRuleError("Intervalo entre parcelas deve ser de ao menos 1 dia");
  }

  const valores = dividir(total, quantidade);

  return valores.map((valor, i) => ({
    numero: i + 1,
    // O deslocamento parte SEMPRE da data original, nao da anterior ja
    // ajustada — senao o ajuste de dia util acumula e a ultima parcela sai
    // dias adiante do previsto.
    vencimento: proximoDiaUtil(somarDias(primeiroVencimento, intervaloDias * i)),
    valor,
  }));
}

// ── Adicionar ───────────────────────────────────────────────────────────────

/**
 * Divide a ultima parcela em duas. Preserva o total.
 *
 * O intervalo e inferido da distancia entre as duas ultimas parcelas; com uma
 * parcela so, cai no padrao de 30 dias.
 */
export function adicionarParcela(parcelas: ParcelaExistente[]): {
  atualizar: { id: number; valor: Centavos };
  criar: Parcela;
} {
  const ordenadas = ordenar(parcelas);
  const ultima = ordenadas.at(-1);

  if (!ultima) {
    throw new BusinessRuleError("Titulo sem parcelas");
  }
  if (ultima.pago) {
    // Guarda que o legado nao tinha: dividir uma parcela ja baixada
    // desalinharia o titulo do pagamento registrado.
    throw new BusinessRuleError("A ultima parcela ja foi paga e nao pode ser dividida");
  }
  if (ultima.valor < 2) {
    throw new BusinessRuleError("Parcela pequena demais para ser dividida");
  }

  const [ficaNaUltima, vaiParaNova] = dividir(ultima.valor, 2);

  const anterior = ordenadas.at(-2);
  const intervalo = anterior
    ? Math.max(1, diffEmDias(anterior.vencimento, ultima.vencimento))
    : INTERVALO_PADRAO_DIAS;

  return {
    atualizar: { id: ultima.id, valor: ficaNaUltima },
    criar: {
      numero: ultima.numero + 1,
      vencimento: proximoDiaUtil(somarDias(ultima.vencimento, intervalo)),
      valor: vaiParaNova,
    },
  };
}

// ── Excluir ─────────────────────────────────────────────────────────────────

/**
 * Remove uma parcela e joga o valor dela na ultima restante, renumerando o
 * cronograma. Preserva o total.
 */
export function excluirParcela(
  parcelas: ParcelaExistente[],
  idExcluir: number,
): {
  excluir: number;
  atualizar: { id: number; numero: number; valor: Centavos }[];
} {
  const ordenadas = ordenar(parcelas);

  if (ordenadas.length <= 1) {
    throw new BusinessRuleError("Nao e possivel excluir a unica parcela do titulo");
  }

  const alvo = ordenadas.find((p) => p.id === idExcluir);
  if (!alvo) {
    throw new BusinessRuleError("Parcela nao pertence a este titulo");
  }
  if (alvo.pago) {
    throw new BusinessRuleError("Parcela ja paga nao pode ser excluida");
  }

  const restantes = ordenadas.filter((p) => p.id !== idExcluir);
  const ultima = restantes.at(-1)!;

  if (ultima.pago) {
    throw new BusinessRuleError(
      "A ultima parcela ja foi paga e nao pode absorver o valor da parcela excluida",
    );
  }

  const atualizar = restantes.map((p, i) => ({
    id: p.id,
    numero: i + 1,
    valor: p.id === ultima.id ? somar(p.valor, alvo.valor) : p.valor,
  }));

  return { excluir: idExcluir, atualizar };
}

// ── Ordem de recebimento ────────────────────────────────────────────────────

/**
 * O minimo para saber se uma parcela ainda espera dinheiro.
 *
 * Numeros crus, e nao `Centavos`/`DataISO`: a mesma regra roda no servico e na
 * tela, e o componente de tela nao carrega os tipos de dominio. Os branded types
 * entram aqui sem conversao, porque sao numero e string por baixo.
 */
export type ParcelaNaFila = {
  id: number;
  numero: number;
  vencimento: string | null;
  total: number;
  recebido: number;
  pago: boolean;
};

export function esperaDinheiro(p: ParcelaNaFila): boolean {
  return !p.pago && p.total - p.recebido > 0;
}

/**
 * Quanto esta conta ainda espera receber.
 *
 * ⚠️ Sai das PARCELAS, e nunca de `total da conta menos o que entrou`.
 *
 * Aquela subtracao ignora o DESCONTO. Uma conta de 1.500 baixada com 500 de
 * desconto recebeu 1.000 e esta quitada; pela subtracao, ela aparecia com 500 em
 * aberto para sempre, e o cliente que ja pagou continuava na lista de cobranca.
 * Uma parcela paga nao espera mais nada, com desconto ou sem.
 */
export function saldoAReceber(parcelas: ParcelaNaFila[]): number {
  return parcelas.filter(esperaDinheiro).reduce((s, p) => s + (p.total - p.recebido), 0);
}

/** O que de fato entrou, somando parcela quitada e parcela recebida pela metade. */
export function totalRecebido(parcelas: ParcelaNaFila[]): number {
  return parcelas.reduce((s, p) => s + p.recebido, 0);
}

/**
 * A ordem em que as parcelas sao recebidas: vencimento manda, o numero so
 * desempata.
 *
 * Parcela sem vencimento vai para o FIM e nao para o comeco: nao se sabe quando
 * ela vence, e travar o titulo inteiro atras de uma data que ninguem preencheu
 * seria pior do que deixa-la por ultimo.
 */
export function filaDeRecebimento<T extends ParcelaNaFila>(parcelas: T[]): T[] {
  const chave = (p: T) => p.vencimento ?? "9999-12-31";

  return [...parcelas].sort((a, b) =>
    chave(a) === chave(b) ? a.numero - b.numero : chave(a) < chave(b) ? -1 : 1,
  );
}

/**
 * A unica parcela que pode receber agora. Nula quando nao ha nada em aberto.
 *
 * Receber fora de ordem quebra a leitura do saldo: com a 3 baixada e a 1 em
 * aberto, "em atraso" e "a vencer" deixam de dizer o que dizem, e quem deve a
 * parcela mais velha aparece em dia na listagem. Quem quer encerrar a primeira
 * sem receber usa o desconto da baixa, que registra a decisao; pular nao
 * registra nada.
 */
export function proximaAReceber<T extends ParcelaNaFila>(parcelas: T[]): T | null {
  return filaDeRecebimento(parcelas).find(esperaDinheiro) ?? null;
}

/**
 * Qual parcela impede este recebimento. Nula quando a ordem esta respeitada.
 *
 * Nao proibe quitar varias de uma vez: proibe DEIXAR uma para tras. Um dinheiro
 * que cobre as parcelas 1, 2 e 3 passa; um que cobre a 2 sem fechar a 1, nao.
 *
 * Vale por titulo, e nao entre titulos: duas contas do mesmo cliente sao acordos
 * independentes, e travar a segunda porque a primeira atrasou impediria de
 * receber um dinheiro que o cliente esta pagando de verdade.
 */
export function paradaNaFila<T extends ParcelaNaFila>(
  parcelas: T[],
  destinos: { parcelaId: number; valor: number; quitar?: boolean }[],
): T | null {
  const porDestino = new Map(destinos.map((d) => [d.parcelaId, d]));
  let pendente: T | null = null;

  for (const p of filaDeRecebimento(parcelas).filter(esperaDinheiro)) {
    const destino = porDestino.get(p.id);
    if (destino && pendente) return pendente;

    // Sobra depois desta baixa. Quem escolheu quitar fecha a parcela mesmo
    // recebendo menos, entao nao segura a fila.
    const sobra = p.total - p.recebido - (destino?.valor ?? 0);
    if (!pendente && sobra > 0 && !destino?.quitar) pendente = p;
  }

  return null;
}

// ── Verificacao ─────────────────────────────────────────────────────────────

/**
 * Confere o invariante. Chamado pelos services antes de persistir — barato, e
 * transforma um erro de centavos num 422 explicito em vez de num titulo
 * silenciosamente errado.
 */
export function conferirTotal(parcelas: { valor: Centavos }[], total: Centavos): void {
  const soma = parcelas.reduce<Centavos>((acc, p) => somar(acc, p.valor), ZERO);
  if (soma !== total) {
    throw new BusinessRuleError("Soma das parcelas nao confere com o total do titulo", {
      soma,
      total,
      diferenca: subtrair(soma, total),
    });
  }
}

function ordenar(parcelas: ParcelaExistente[]): ParcelaExistente[] {
  return [...parcelas].sort((a, b) => a.numero - b.numero);
}

// â”€â”€ O que da para fazer nesta conta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Uma parcela, do ponto de vista de quem quer MEXER nela.
 *
 * âš ï¸ `temDocumento` e boleto ou nota emitidos, e nao o comprovante. Comprovante e
 * prova de que o dinheiro entrou; boleto e nota sao promessas que sairam com um
 * valor escrito, e mudar a parcela depois deixa o documento mentindo.
 */
export type ParcelaEditavel = ParcelaExistente & { temDocumento: boolean };

export type Permissao = {
  pode: boolean;
  /** A frase que a tela mostra quando `pode` e falso. */
  motivo: string | null;
};

export type OQuePodeNaConta = {
  /** Vincular e desvincular ticket ou produto: mexe no TOTAL. */
  tickets: Permissao;
  /** Mexer no cronograma do que ainda esta em aberto. */
  parcelas: Permissao;
  /** Por parcela: dividir, juntar ou mudar o vencimento DAQUELA. */
  porParcela: Record<number, Permissao>;
};

const LIBERADO: Permissao = { pode: true, motivo: null };

/**
 * A unica resposta para "o que da para fazer nesta conta agora".
 *
 * âš ï¸ Funcao pura, lida pela TELA e pelo SERVICO. A tela apaga o que nao pode e
 * diz por que; o servico recusa de novo. Escrita duas vezes, ela divergiria no
 * primeiro ajuste e a tela passaria a oferecer o que o servidor recusa.
 *
 * As tres regras, em uma frase cada:
 *
 * âš ï¸ Conta CANCELADA nao aceita nada. Ela parou de ser cobravel.
 *
 * âš ï¸ Enquanto NADA foi recebido, a conta e editavel: ticket entra e sai, e o
 * total se redistribui entre as parcelas.
 *
 * âš ï¸ Ao primeiro centavo, a conta vira DOCUMENTO. O cliente pagou contra um
 * valor, e mexer no total depois faz o boleto ou a nota que sairam divergirem
 * dela. O que ainda da para fazer e reparcelar o que continua em aberto, sem
 * tocar no total: e o pedido mais comum que existe ("divide o resto em duas"), e
 * travar a conta inteira obrigaria a cancelar tudo e refazer.
 */
export function oQuePodeNaConta(conta: {
  cancelada: boolean;
  parcelas: ParcelaEditavel[];
}): OQuePodeNaConta {
  if (conta.cancelada) {
    const negado = { pode: false, motivo: "Esta conta estÃ¡ cancelada." };

    return {
      tickets: negado,
      parcelas: negado,
      porParcela: Object.fromEntries(conta.parcelas.map((p) => [p.id, negado])),
    };
  }

  const recebeu = conta.parcelas.some((p) => p.pago);
  const emAberto = conta.parcelas.filter((p) => !p.pago);

  const tickets: Permissao = recebeu
    ? {
        pode: false,
        motivo:
          "Esta conta jÃ¡ recebeu. Mexer no total agora faria o boleto e a nota que saÃ­ram divergirem dela: o caminho Ã© uma conta a receber nova.",
      }
    : LIBERADO;

  const parcelas: Permissao =
    emAberto.length === 0
      ? { pode: false, motivo: "Todas as parcelas jÃ¡ foram recebidas." }
      : LIBERADO;

  return {
    tickets,
    parcelas,
    porParcela: Object.fromEntries(
      conta.parcelas.map((p) => [
        p.id,
        p.pago
          ? { pode: false, motivo: "Parcela jÃ¡ recebida." }
          : p.temDocumento
            ? {
                pode: false,
                motivo:
                  "JÃ¡ saiu boleto ou nota desta parcela. Mudar o valor ou o vencimento deixaria o documento dizendo outra coisa.",
              }
            : LIBERADO,
      ]),
    ),
  };
}

/**
 * Tira um pedaco de uma parcela e faz dele uma parcela nova. Preserva o total.
 *
 * âš ï¸ Diferente de `adicionarParcela`, que parte a ultima ao meio: aqui quem
 * cadastra diz QUANTO e para QUANDO. E o que o cliente pede ao telefone â€” "tira
 * mil dessa e joga para o mes que vem" â€”, e partir ao meio nunca era o numero
 * combinado.
 *
 * âš ï¸ O vencimento novo tem de ser DEPOIS do da parcela de origem. Antes, a conta
 * ficaria com a parcela 4 vencendo entre a 1 e a 2, e a ordem de recebimento
 * (que manda no sistema) passaria a discordar da numeracao.
 */
export function dividirParcela(
  parcelas: ParcelaEditavel[],
  idOrigem: number,
  novo: { valor: Centavos; vencimento: DataISO },
): { atualizar: { id: number; numero: number; valor: Centavos }[]; criar: Parcela } {
  const alvo = parcelas.find((p) => p.id === idOrigem);

  if (!alvo) throw new BusinessRuleError("Parcela nao pertence a esta conta");
  if (alvo.pago) throw new BusinessRuleError("Parcela ja recebida nao pode ser dividida");
  if (alvo.temDocumento) {
    throw new BusinessRuleError(
      "Ja saiu boleto ou nota desta parcela; mudar o valor deixaria o documento dizendo outra coisa",
    );
  }

  if (novo.valor <= 0) {
    throw new BusinessRuleError("O valor da parcela nova deve ser maior que zero");
  }
  if (novo.valor >= alvo.valor) {
    // Igual deixaria a parcela de origem zerada; maior, negativa.
    throw new BusinessRuleError(
      "O valor tem de ser menor que o da parcela de origem: o que sai dela e que vira a parcela nova",
    );
  }
  if (novo.vencimento <= alvo.vencimento) {
    throw new BusinessRuleError("O vencimento da parcela nova tem de ser depois do da origem");
  }

  const comANova: ParcelaEditavel[] = [
    ...parcelas.map((p) =>
      p.id === idOrigem ? { ...p, valor: subtrair(p.valor, novo.valor) } : p,
    ),
    // Id negativo: ela ainda nao existe no banco, e so serve para a renumeracao
    // enxergar a nova no lugar certo da fila.
    { id: -1, numero: 0, pago: false, temDocumento: false, ...novo },
  ];

  const numerada = renumerar(comANova);
  const nova = numerada.find((p) => p.id === -1)!;

  return {
    atualizar: numerada
      .filter((p) => p.id !== -1)
      .map((p) => ({ id: p.id, numero: p.numero, valor: p.valor })),
    criar: { numero: nova.numero, vencimento: nova.vencimento, valor: nova.valor },
  };
}

/**
 * Espalha um total novo entre as parcelas, mantendo os vencimentos.
 *
 * âš ï¸ DIVIDE entre todas em vez de jogar a diferenca na ultima. Numa conta 3x, o
 * ticket que entra depois viraria uma ultima parcela desproporcional que ninguem
 * combinou; dividindo, a proporcao acertada com o cliente continua de pe.
 *
 * âš ï¸ So roda com a conta inteira em aberto, e por isso nao recebe parcela paga: e
 * chamada quando um ticket entra ou sai, e isso so acontece antes do primeiro
 * recebimento.
 */
export function redistribuirTotal(
  parcelas: ParcelaEditavel[],
  novoTotal: Centavos,
): { id: number; numero: number; vencimento: DataISO; valor: Centavos }[] {
  if (parcelas.some((p) => p.pago)) {
    throw new BusinessRuleError("Conta com parcela recebida nao tem o total redistribuido");
  }
  if (parcelas.length === 0) throw new BusinessRuleError("Conta sem parcelas");
  if (novoTotal < parcelas.length) {
    throw new BusinessRuleError(
      "Total pequeno demais para o numero de parcelas: alguma ficaria sem um centavo",
    );
  }

  const valores = dividir(novoTotal, parcelas.length);

  return renumerar(parcelas).map((p, i) => ({
    id: p.id,
    numero: p.numero,
    vencimento: p.vencimento,
    valor: valores[i],
  }));
}

/**
 * Numera o cronograma pela ORDEM DE VENCIMENTO.
 *
 * âš ï¸ Parcela recebida NAO troca de numero. O recibo que o cliente tem na mao diz
 * "parcela 2", e renumerar depois faria o papel dele apontar para outra. As em
 * aberto ficam com os numeros que sobram, na ordem em que vencem.
 */
function renumerar(parcelas: ParcelaEditavel[]): ParcelaEditavel[] {
  const pagas = parcelas.filter((p) => p.pago);
  const usados = new Set(pagas.map((p) => p.numero));

  let proximo = 1;
  const livre = () => {
    while (usados.has(proximo)) proximo++;
    return proximo++;
  };

  const abertas = parcelas
    .filter((p) => !p.pago)
    .sort((a, b) =>
      a.vencimento === b.vencimento
        ? a.numero - b.numero
        : a.vencimento < b.vencimento
          ? -1
          : 1,
    )
    .map((p) => ({ ...p, numero: livre() }));

  return [...pagas, ...abertas].sort((a, b) => a.numero - b.numero);
}


/**
 * O parcelamento inteiro, do jeito que a tela desenhou.
 *
 * âš ï¸ Substitui `dividirParcela` como caminho principal. Dividir uma ao meio
 * resolve um caso; quem vendeu 10.000 e combinou 2.000 num dia, 1.200 no outro e
 * o resto depois precisa DIGITAR o cronograma, e nao chegar nele por divisoes
 * sucessivas.
 *
 * âš ï¸ A regra de ouro e uma so: a soma tem de bater com o total da conta. O que a
 * tela faz e mostrar a diferenca enquanto ela existe e travar o salvar; aqui ela
 * e conferida de novo, porque o corpo chega pela rede.
 */
export type ItemDoParcelamento = {
  /** `null` numa parcela que ainda nao existe. */
  id: number | null;
  vencimento: DataISO;
  valor: Centavos;
};

export function redefinirParcelas(
  existentes: ParcelaEditavel[],
  itens: ItemDoParcelamento[],
  totalDaConta: Centavos,
): {
  atualizar: { id: number; numero: number; vencimento: DataISO; valor: Centavos }[];
  criar: Parcela[];
  excluir: number[];
} {
  if (itens.length === 0) {
    throw new BusinessRuleError("A conta precisa de ao menos uma parcela");
  }

  const pagas = existentes.filter((p) => p.pago);
  const abertas = existentes.filter((p) => !p.pago);
  const porId = new Map(abertas.map((p) => [p.id, p]));

  for (const item of itens) {
    if (item.valor <= 0) {
      throw new BusinessRuleError("Toda parcela precisa de um valor maior que zero");
    }

    if (item.id == null) continue;

    const atual = porId.get(item.id);
    if (!atual) {
      throw new BusinessRuleError("Parcela nao pertence a esta conta, ou ja foi recebida");
    }

    /*
     * âš ï¸ Parcela com boleto ou nota emitidos nao muda de valor nem de data.
     *
     * Sao promessas que sairam com um numero escrito. O comprovante nao entra
     * nessa conta: ele e prova de que o dinheiro entrou, e nao promessa.
     */
    if (atual.temDocumento && (atual.valor !== item.valor || atual.vencimento !== item.vencimento)) {
      throw new BusinessRuleError(
        `Ja saiu boleto ou nota da parcela ${atual.numero}; mudar o valor ou o vencimento deixaria o documento dizendo outra coisa`,
      );
    }
  }

  const somaPagas = pagas.reduce<Centavos>((s, p) => somar(s, p.valor), ZERO);
  const somaItens = itens.reduce<Centavos>((s, i) => somar(s, i.valor), ZERO);

  if (somar(somaPagas, somaItens) !== totalDaConta) {
    throw new BusinessRuleError(
      "A soma das parcelas nao bate com o total da conta",
      { soma: somar(somaPagas, somaItens), total: totalDaConta },
    );
  }

  // Sumiu do que a tela mandou: quem nao veio e para excluir. Parcela paga nunca
  // chega aqui, entao nao ha como remover uma sem querer.
  const vieram = new Set(itens.filter((i) => i.id != null).map((i) => i.id));
  const excluir = abertas.filter((p) => !vieram.has(p.id)).map((p) => p.id);

  for (const id of excluir) {
    const p = porId.get(id)!;
    if (p.temDocumento) {
      throw new BusinessRuleError(
        `A parcela ${p.numero} tem boleto ou nota emitidos e nao pode ser removida`,
      );
    }
  }

  /*
   * A numeracao sai da ORDEM DE VENCIMENTO, e as pagas nao trocam de numero: o
   * recibo que o cliente tem na mao diz "parcela 2".
   */
  const paraNumerar: ParcelaEditavel[] = [
    ...pagas,
    ...itens.map((i, indice) => ({
      // Id negativo distingue a parcela nova sem confundir com id de banco, e o
      // indice mantem duas parcelas do mesmo dia na ordem em que foram digitadas.
      id: i.id ?? -(indice + 1),
      numero: i.id ? (porId.get(i.id)?.numero ?? 0) : 0,
      vencimento: i.vencimento,
      valor: i.valor,
      pago: false,
      temDocumento: false,
    })),
  ];

  const numeradas = renumerar(paraNumerar).filter((p) => !p.pago);

  return {
    atualizar: numeradas
      .filter((p) => p.id > 0)
      .map((p) => ({ id: p.id, numero: p.numero, vencimento: p.vencimento, valor: p.valor })),
    criar: numeradas
      .filter((p) => p.id < 0)
      .map((p) => ({ numero: p.numero, vencimento: p.vencimento, valor: p.valor })),
    excluir,
  };
}

