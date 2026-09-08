import { hoje, type DataISO } from "@/shared/utils/datas";
import type { Centavos } from "@/shared/utils/money";

/** Contratos de dominio de contas a pagar. */

export type ContaPagarResumo = {
  id: number;
  /**
   * O numero que a pessoa ve, contado por empresa.
   *
   * Nao e o `id`: aquele e sequencia global e vem intercalado entre empresas, e
   * uma empresa com quatro contas via a primeira delas chamada de 127.
   */
  numero: number | null;
  descricao: string;
  fornecedorId: number | null;
  fornecedorNome: string | null;
  emissao: DataISO | null;
  proximoVencimento: DataISO | null;
  total: Centavos;
  pago: boolean;
  /** Quanto ja saiu, somando as parcelas pagas. */
  valorPago: Centavos;
  /** Deixou de existir. Marca, nao etapa. */
  cancelada: boolean;
  /** Existe, mas parou de correr. Marca, nao etapa. */
  suspensa: boolean;
  /** Todo o dinheiro que saiu ja foi conferido no extrato. */
  conciliada: boolean;
  qtdParcelas: number;
  parcelasPagas: number;
};

/**
 * Onde a conta esta no caminho ate ser quitada e conferida.
 *
 * ⚠️ VENCIDA e CANCELADA saem daqui, e cada uma por um motivo diferente.
 *
 * **Vencida nao e etapa, e tempo.** ABERTA e PARCIAL falam de progresso —
 * quanto ja foi pago; vencida fala de calendario. Sao perguntas independentes, e
 * uma conta pode ser as duas. Espremidas no mesmo enum, a mais rica sumia: no
 * dado real, as 9 contas parciais eram TODAS tambem vencidas, e como vencida era
 * testada antes, PARCIAL nunca aparecia na tela. A coluna do quadro ficava vazia
 * com nove contas que pertenciam a ela.
 *
 * **Cancelada nao e etapa, e um fato sobre a conta inteira.** Ela ja e coluna
 * booleana no banco, e uma conta cancelada nao esta "num ponto do caminho": ela
 * saiu do caminho.
 *
 * BAIXADA entra depois de PAGA e nao no lugar dela, exatamente como na conta a
 * receber: PAGA e "saiu daqui"; BAIXADA e "conferi no extrato e bate".
 */
export const SITUACOES_CONTA = ["ABERTA", "PARCIAL", "PAGA", "BAIXADA", "SUSPENSA"] as const;

export type SituacaoConta = (typeof SITUACOES_CONTA)[number];

export type FiltroContas = {
  situacao?: SituacaoConta;
  fornecedorId?: number;
  incluirCanceladas?: boolean;
};

/**
 * O que basta para uma conta a pagar existir.
 *
 * ⚠️ Sem conta bancaria e sem cartao, de proposito. De onde o dinheiro sai e
 * decisao da BAIXA, e nao da conta: a mesma despesa pode ser paga em PIX hoje ou
 * no cartao amanha, e prender a forma aqui obrigaria a editar a divida para
 * mudar de bolso. O centro de custo, esse sim, e da conta.
 */
export type ContaPagarNova = {
  fornecedorId: number;
  /** Vazia, o servico usa a descricao do primeiro lancamento. */
  descricao: string | null;
  emissao: DataISO;
  /**
   * As linhas da conta. ⚠️ O total NAO vem no contrato: ele e a soma delas, e
   * quem calcula e o servidor com `totalDosLancamentos`. Recebendo os dois, o
   * primeiro corpo em que eles discordassem gravaria uma conta que nao fecha.
   */
  lancamentos: LancamentoDaConta[];
  /** De onde ela veio. Sem nada aqui, o servico grava AVULSA. */
  origem?: {
    tipo: TipoDeOrigem;
    ordemId?: number | null;
    contratoId?: number | null;
  };
  /**
   * O numero do documento. ⚠️ OBRIGATORIO: toda conta a pagar nasce de um
   * papel, e sem ele nao ha como conferir a divida contra nada.
   */
  documento: string;
  /** A especie: NFS-e, CT, DARF. */
  tipoDocumentoId: number;
  observacoes: string | null;
  /** O cronograma como a tela desenhou. A soma tem de fechar com os lancamentos. */
  parcelas: { vencimento: DataISO; valor: Centavos }[];
};

/**
 * Uma baixa: um dinheiro que SAIU e as parcelas que ele quitou.
 *
 * Espelho de `RecebimentoResumo`. `pagamentos` e o extrato — o que saiu, quando
 * e de qual conta —, e nao tem vinculo com conta a pagar nenhuma; e isso que
 * permite um pagamento so cobrir varias parcelas.
 */
export type BaixaPagarResumo = {
  id: number;
  data: DataISO | null;
  tipo: string | null;
  valor: Centavos;
  fornecedorNome: string | null;
  contaNome: string | null;
  conciliado: boolean;
  descricao: string | null;
  qtdParcelas: number;
  qtdContas: number;
};

/** Uma parcela que a baixa quitou. */
export type DestinoDaBaixa = {
  parcelaId: number;
  contaId: number;
  contaNumero: number | null;
  contaDescricao: string | null;
  numero: number;
  vencimento: DataISO | null;
  /** O que a parcela valia. ⚠️ Nao muda quando ela e paga. */
  total: Centavos;
  /** O que esta baixa aplicou nela. */
  valor: Centavos;
};

export type BaixaPagar = BaixaPagarResumo & {
  observacoes: string | null;
  registradoEm: string | null;
  destinos: DestinoDaBaixa[];
};

/**
 * As formas de pagar.
 *
 * ⚠️ Espelha `TIPOS_DE_RECEBIMENTO` sem "Cartão de crédito": baixar no cartão
 * NÃO tira do saldo — o dinheiro sai quando a conta a pagar da fatura é paga. Ele
 * é outro gesto, com tela própria, e oferecê-lo aqui faria a despesa sair do
 * caixa duas vezes.
 */
export const TIPOS_DE_PAGAMENTO = [
  "PIX",
  "Boleto",
  "TED",
  "DOC",
  "Cartão de débito",
  "Dinheiro",
  "Cheque",
  "Débito automático",
] as const;

export type TipoDePagamento = (typeof TIPOS_DE_PAGAMENTO)[number];

/** Uma parcela esperando dinheiro sair, no formato que a tela da baixa usa. */
export type ParcelaAPagar = {
  parcelaId: number;
  contaId: number;
  contaNumero: number | null;
  contaDescricao: string | null;
  numero: number;
  totalParcelas: number;
  vencimento: DataISO | null;
  total: Centavos;
  /** Quanto ja saiu para esta parcela, somando pagamentos e descontos. */
  quitado: Centavos;
  emAberto: Centavos;
  /** A primeira em aberto da conta. As outras esperam a vez. */
  liberada: boolean;
};

/** Para onde vai um pedaco do dinheiro que saiu. */
export type DestinoDoPagamento = {
  parcelaId: number;
  valor: Centavos;
  juros: Centavos;
  multa: Centavos;
  /** Fecha a parcela perdoando a diferenca que sobrar. */
  quitar: boolean;
};

export type BaixaNova = {
  fornecedorId: number;
  data: DataISO;
  tipo: string;
  /**
   * De onde o dinheiro sai.
   *
   * ⚠️ NULO quando a baixa e no CARTAO. `vwsaldo` soma `pagamentos` juntando por
   * `fkContaBancaria`: sem conta, o lancamento nao entra em saldo nenhum — que e
   * exatamente o que se quer, porque no cartao o dinheiro ainda nao saiu do
   * banco. Ele sai quando a fatura virar conta a pagar e ELA for paga.
   */
  contaBancariaId: number | null;
  /** O cartao usado. Exclusivo com `contaBancariaId`. */
  cartaoId?: number | null;
  observacoes: string | null;
  destinos: DestinoDoPagamento[];
};

/** Um cartao, no formato que a tela da baixa precisa. */
export type CartaoDaBaixa = {
  id: number;
  apelido: string | null;
  bandeira: string | null;
  diaFechamento: number;
  diaVencimento: number;
  /**
   * O cadastro que recebe o pagamento da fatura.
   *
   * ⚠️ EXIGIDO no fechamento: e o credor da conta a pagar que nasce ali. Antes o
   * sistema inventava um cliente com o nome do banco quando faltava, e a conta
   * nascia no nome de um cadastro sem CNPJ que ninguem reconhecia.
   */
  fornecedorId: number | null;
  fornecedorNome: string | null;
  /** A instituicao emissora, da lista de bancos. */
  bancoId: number | null;
  bancoNome: string | null;
  /** Os 4 ultimos digitos. Serve para dizer QUAL cartao, e nao para transacionar. */
  ultimosDigitos: string | null;
  ativo: boolean;
  limite: Centavos;
};

export type CartaoNovo = {
  apelido: string;
  bandeira: string | null;
  ultimosDigitos: string | null;
  diaFechamento: number;
  diaVencimento: number;
  limite: Centavos;
  /** A instituicao emissora. E ela que se escolhe na tela. */
  bancoId: number | null;
  /**
   * Quem recebe. ⚠️ Opcional: sem ele, o FECHAMENTO da fatura resolve — acha o
   * cadastro pelo nome do banco ou cria um. Exigir na criacao obrigaria a
   * cadastrar o banco como fornecedor antes de cadastrar o cartao, o que e a
   * mesma informacao pedida duas vezes.
   */
  fornecedorId: number | null;
  contaBancariaId: number | null;
};

/** Um banco da lista: os do sistema mais os que a empresa acrescentou. */
export type BancoDaLista = {
  id: number;
  codigo: string;
  nome: string;
  doSistema: boolean;
};

/** Uma fatura de cartao, no formato da tela. */
export type FaturaDeCartao = {
  id: number;
  cartaoId: number;
  cartaoApelido: string | null;
  competencia: DataISO;
  fechamento: DataISO | null;
  vencimento: DataISO | null;
  total: Centavos;
  status: string;
  /** A conta a pagar gerada no fechamento. Nulo enquanto aberta. */
  contaPagarId: number | null;
  /**
   * O NUMERO dessa conta — o que a tela mostra.
   *
   * ⚠️ Nao e o `contaPagarId`. O sistema e multiempresa: `id` e a sequencia
   * global e nao aparece em lugar nenhum, e a tela dizia "Conta 190" para a
   * conta que a lista de contas a pagar chama de 189. Mesmo defeito que o
   * extrato tinha na coluna de registro.
   */
  contaPagarNumero: number | null;
  /**
   * A conta a pagar do fechamento ja recebeu dinheiro.
   *
   * ⚠️ Existe para a TELA poder barrar o reabrir antes do clique. Reabrir apaga
   * a conta a pagar, e conta com parcela paga nao se apaga — o servidor ja
   * recusava, mas so depois de a pessoa confirmar um dialogo que prometia o que
   * nao ia acontecer. Barrado no menu, o motivo aparece antes.
   *
   * Falso quando a fatura esta aberta: nao ha conta ainda.
   */
  contaPaga: boolean;
  qtdLancamentos: number;
};

export type FiltroBaixas = {
  de?: DataISO;
  ate?: DataISO;
};

/**
 * Os numeros do topo da listagem de baixas.
 *
 * Mesma forma do lado que recebe: o que entrou e o que saiu se medem igual.
 */
export type IndicadoresDeBaixaPagar = {
  /** Do mais antigo para o mais recente. O ultimo e o mes corrente. */
  meses: { mes: string; valor: Centavos; qtd: number }[];
  /** Tudo que ninguem conferiu no extrato, de QUALQUER epoca. */
  aConciliar: { valor: Centavos; qtd: number };
  totalDeBaixas: number;
  /** Quanto saiu por forma de pagamento no periodo, maior primeiro. */
  porForma: { tipo: string; valor: Centavos }[];
};

/**
 * Uma linha do que esta sendo pago.
 *
 * ⚠️ O centro de custo mora AQUI, no lancamento, e nao na conta. Uma conta de
 * energia rateada entre dois setores nao e "uma despesa com dois centros": sao
 * duas linhas, cada uma com o seu. Assim o que se digita e o que a DRE le sao a
 * mesma coisa, e nao duas listas que precisam concordar.
 */
export type LancamentoDaConta = {
  descricao: string;
  valor: Centavos;
  centroCustoId: number | null;
};

export type LancamentoComNome = LancamentoDaConta & {
  id: number;
  /** O codigo legivel do centro, unico por empresa. */
  centroCustoCodigo: string | null;
  centroCustoNome: string | null;
};

/**
 * O total da conta, a partir das linhas.
 *
 * ⚠️ Funcao pura e UNICA: a tela mostra este numero enquanto se digita e o
 * servidor grava este numero. Um total digitado a parte, como era antes, deixa
 * a conta afirmar um valor que suas proprias linhas nao sustentam.
 *
 * ⚠️ Soma pura, sem subtracao. Desconto NAO e linha da conta: a conta e o que se
 * deve conforme o documento, e desconto por antecipacao depende de QUANDO se
 * paga. Ele mora na baixa, ao lado de juros e multa — os tres sao a mesma
 * familia, o que muda entre o que se devia e o que se pagou.
 */
export function totalDosLancamentos(lancamentos: { valor: number }[]): number {
  return lancamentos.reduce((soma, l) => soma + l.valor, 0);
}

/** O rateio e o AGRUPAMENTO dos lancamentos por centro, e nao uma segunda lista. */
export function rateioDosLancamentos(
  lancamentos: LancamentoComNome[],
): { centroCustoId: number | null; centroCustoNome: string | null; valor: number }[] {
  const porCentro = new Map<number | null, { nome: string | null; valor: number }>();

  for (const l of lancamentos) {
    const atual = porCentro.get(l.centroCustoId) ?? { nome: l.centroCustoNome, valor: 0 };
    atual.valor += l.valor;
    porCentro.set(l.centroCustoId, atual);
  }

  return [...porCentro.entries()].map(([centroCustoId, v]) => ({
    centroCustoId,
    centroCustoNome: v.nome,
    valor: v.valor,
  }));
}

/** De onde a conta veio. AVULSA e origem legitima, e nao ausencia de origem. */
export const ORIGENS_DA_CONTA = ["AVULSA", "PEDIDO", "CONTRATO", "CARTAO"] as const;
export type TipoDeOrigem = (typeof ORIGENS_DA_CONTA)[number];

export type OrigemDaConta = {
  id: number;
  origem: TipoDeOrigem;
  /** A fatura, quando a origem e CARTAO. Guardada em `fkOrdem`. */
  /** O pedido de compra, quando a origem e PEDIDO. */
  ordemId: number | null;
  /** O contrato, quando a origem e CONTRATO. */
  contratoId: number | null;
  valor: Centavos;
  observacoes: string | null;
};

/** A especie do documento. Sem `fkEmpresa` aqui: a tela nao precisa saber. */
export type TipoDeDocumento = {
  id: number;
  sigla: string;
  nome: string;
  /** Do sistema: a empresa nao edita nem apaga. */
  doSistema: boolean;
};

export type AnexoDaConta = {
  id: number;
  nome: string;
  caminho: string;
  criadoEm: string | null;
};

/**
 * Em que ponto do caminho a conta esta.
 *
 * Funcao pura, e por isso mora aqui e nao no service: a tabela (client
 * component) precisa dela, e importar o service arrastaria o repositorio — e
 * com ele o client do Supabase — para o bundle do navegador.
 *
 * ⚠️ A ordem e do fim para o comeco, e nao e arbitraria. SUSPENSA vem primeiro
 * porque uma conta pausada nao esta progredindo, mesmo com parcela ja paga.
 * Depois BAIXADA, que exige PAGA mais a conferencia. Cancelada nao aparece:
 * ela e marca, e quem pergunta por ela pergunta por `conta.cancelada`.
 */
export function situacaoDaConta(conta: ContaPagarResumo): SituacaoConta {
  if (conta.suspensa) return "SUSPENSA";

  const quitada =
    conta.pago || (conta.qtdParcelas > 0 && conta.parcelasPagas === conta.qtdParcelas);

  /*
   * ⚠️ BAIXADA exige conferencia de TODO o dinheiro que saiu, e nao de parte.
   *
   * Com uma parcela conferida e outra nao, a conta ainda tem trabalho pendente:
   * dar por baixada ali esconderia justamente a linha que ninguem olhou.
   */
  if (quitada) return conta.conciliada ? "BAIXADA" : "PAGA";
  if (conta.parcelasPagas > 0) return "PARCIAL";
  return "ABERTA";
}

/**
 * Passou da data e ainda espera dinheiro.
 *
 * ⚠️ Marca, e nao situacao — cruza com ABERTA e com PARCIAL. E ⚠️ conta suspensa
 * NAO vence: pausar a cobranca e exatamente parar de contar o atraso, e deixar
 * ela vermelha faria o gesto de suspender nao ter efeito nenhum na tela.
 */
export function estaVencida(conta: ContaPagarResumo): boolean {
  if (conta.cancelada || conta.suspensa) return false;

  const situacao = situacaoDaConta(conta);
  if (situacao === "PAGA" || situacao === "BAIXADA") return false;

  return conta.proximoVencimento != null && conta.proximoVencimento < hoje();
}

/**
 * Uma compra dentro da fatura do cartão.
 *
 * ⚠️ Ela é a DESPESA, e não o reflexo de uma conta a pagar. Carrega fornecedor,
 * descrição, data da compra, competência, valor e centro de custo próprios — é
 * assim que a DRE a lê, pela competência do ciclo e pelo centro da linha.
 */
export type LancamentoDaFatura = {
  id: number;
  descricao: string;
  /** Quando a compra aconteceu. */
  dataCompra: DataISO | null;
  /**
   * O ciclo em que ela cai.
   *
   * ⚠️ Diferente de `dataCompra`, e é ESTE que vale na DRE. Compra depois do
   * fechamento entra no ciclo seguinte: é por isso que a despesa do cartão
   * aparece no mês em que a fatura vence, e não no dia em que se comprou.
   */
  competencia: DataISO | null;
  numeroParcela: number;
  valor: Centavos;
  /**
   * Combinada e desfeita — estorno, compra negada, cobranca indevida.
   *
   * ⚠️ Ela FICA na fatura e para de somar. Apagada, ninguem descobre depois por
   * que a fatura do mes deu menos do que a soma das notas.
   */
  cancelada: boolean;
  centroCustoId: number | null;
  /** O código do centro. A tela mostra "012 · Marketing", como na conta a pagar. */
  centroCustoCodigo: string | null;
  centroCustoNome: string | null;
  fornecedorId: number | null;
  fornecedorNome: string | null;
};
