import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/** Contratos de dominio do modulo. Entidades, nao linhas de tabela. */

/**
 * Status reais gravados no banco, em caixa alta e com acento — foi o que o
 * FlutterFlow deixou e o que 151 faturas ja existentes usam. Nao ha ganho em
 * renomear para um enum "mais limpo" e migrar dado vivo por estetica.
 *
 * Distribuicao atual: PAGA 72, ABERTA 33, ORCAMENTO 33, PARC. PAGA 9,
 * FATURADA 4.
 *
 * ORCAMENTO e o estado pre-fatura (proposta ainda nao emitida).
 */
/*
 * ORÇAMENTO saiu: quem orça e o TICKET, que tem coluna propria para isso no
 * quadro dele. Conta a receber nasce de ticket ja combinado — orcar duas vezes
 * fazia o mesmo trabalho aparecer em dois lugares, e nenhum dos dois sabia do
 * outro.
 *
 * BAIXADA entrou depois de PAGA, e nao no lugar dela: sao duas perguntas
 * diferentes. PAGA e "o cliente pagou"; BAIXADA e "conferi no extrato e bate".
 * Entre uma e outra existe o dia em que o dinheiro ainda nao apareceu na conta,
 * e e justamente esse intervalo que o financeiro precisa enxergar.
 */
export const STATUS_FATURA = ["ABERTA", "FATURADA", "PARC. PAGA", "PAGA", "BAIXADA"] as const;

export type StatusFatura = (typeof STATUS_FATURA)[number];

/**
 * Cancelamento e coluna booleana separada (`cancelada`), nao um status. Uma
 * fatura pode estar ABERTA e cancelada ao mesmo tempo no banco — na tela ela
 * aparece como cancelada, que e a informacao que importa.
 */
export type SituacaoFatura = StatusFatura | "CANCELADA";

export const TRANSICOES_FATURA: Record<StatusFatura, StatusFatura[]> = {
  ABERTA: ["FATURADA", "PARC. PAGA", "PAGA"],
  FATURADA: ["PARC. PAGA", "PAGA"],
  "PARC. PAGA": ["PAGA"],
  PAGA: ["BAIXADA"],
  // Fim da linha: conta conciliada nao volta. Erro de conciliacao se conserta
  // no extrato, nao arrastando o cartao de volta.
  BAIXADA: [],
};

export function podeTransicionar(de: StatusFatura, para: StatusFatura): boolean {
  return TRANSICOES_FATURA[de].includes(para);
}


export type ParcelaFatura = {
  id: number;
  numero: number;
  vencimento: DataISO | null;
  valor: Centavos;
  acrescimo: Centavos;
  desconto: Centavos;
  total: Centavos;
  pago: boolean;
  pagamentoId: number | null;
  /** Data da baixa. E o fato que o recibo comprova — nao confundir com o vencimento. */
  pagoEm: DataISO | null;
  /** Quanto ja entrou nesta parcela, somado dos vinculos. */
  recebido: Centavos;
  nfs: string | null;
  boleto: string | null;
  /** O que o cliente manda ao pagar. Nota e boleto vao; este volta. */
  comprovante: string | null;
};

/** Fatura como aparece na listagem. */
export type FaturaResumo = {
  id: number;
  numero: number;
  clienteId: number | null;
  clienteNome: string | null;
  /** Periodo apurado — "Apuracao" na tela do VPay. */
  apuracaoInicio: DataISO | null;
  apuracaoFim: DataISO | null;
  /** Vencimento da proxima parcela em aberto. */
  proximoVencimento: DataISO | null;
  status: StatusFatura;
  cancelada: boolean;
  situacao: SituacaoFatura;
  total: Centavos;
  qtdParcelas: number;
  /** Quantos tickets a conta juntou. Uma de oito se le diferente de uma de um. */
  qtdTickets: number;
  /**
   * Quanto ja entrou, somado das parcelas baixadas.
   *
   * Calculado, nunca guardado: e a PARCELA que carrega a verdade sobre o
   * pagamento, e um campo no cabecalho da conta seria uma segunda versao dela.
   */
  /** O que de fato entrou: parcela quitada e parcela recebida pela metade. */
  pago: Centavos;
  /**
   * O que ainda espera dinheiro.
   *
   * ⚠️ NAO e `total - pago`. Aquela subtracao ignora o desconto dado na baixa, e
   * mostrava uma conta quitada com saldo em aberto para sempre.
   */
  saldo: Centavos;
};

/** Quem criou e quem mexeu por ultimo. Alimenta o historico do drawer. */
export type Historico = {
  criadoEm: string | null;
  criadoPor: string | null;
  editadoEm: string | null;
  editadoPor: string | null;
};

/** Um ticket que originou parte desta conta a receber. */
export type TicketDaFatura = {
  /** Chave interna — abre o drawer. */
  ticketId: number;
  /** Numero por empresa. E o que se mostra: ver docs/10. */
  numero: number;
  /** Quanto DESTE ticket entrou nesta conta — nao o total do ticket. */
  valor: Centavos;
  titulo: string;
  status: string;
  clienteNome: string | null;
  encerradoEm: DataISO | null;
};

export type Fatura = FaturaResumo & {
  observacoes: string | null;
  rodape: string | null;
  parcelas: ParcelaFatura[];
  tickets: TicketDaFatura[];
  historico: Historico;
  anexos: AnexoDaFatura[];
  /** Quem emite o recibo. So no detalhe: a listagem nao imprime nada. */
  emitente: {
    razaoSocial: string | null;
    endereco: string | null;
    cnpj: string | null;
    logo: string | null;
  };
  /** CNPJ/CPF de quem paga. Recibo sem documento nao identifica ninguem. */
  clienteDoc: string | null;
};

/**
 * Quanto desta fatura sai de cada ticket.
 *
 * E o que faz o saldo do ticket baixar. Sem esta linha em `faturasorigens` a
 * fatura existe, cobra e recebe — e o ticket segue "Concluido", com o valor
 * inteiro em aberto, pronto para ser cobrado de novo.
 */
/**
 * Anexo da conta inteira: contrato, ordem de compra, comprovante.
 *
 * Nota e boleto NAO entram aqui — cada parcela tem os seus, e pendura-los na
 * conta faria escolher arbitrariamente a qual parcela pertencem.
 */
export type AnexoDaFatura = {
  id: number;
  nome: string;
  /** Caminho no bucket. A URL e assinada na hora de abrir. */
  caminho: string;
  criadoEm: string;
};

/** Uma conta do banco, para escolher onde o dinheiro entrou. */
export type ContaBancaria = { id: number; nome: string };

/**
 * Uma baixa: o dinheiro que entrou, e para quais parcelas ele foi.
 *
 * O valor vai por PARCELA, e nao um total dividido pelo sistema: um PIX de 3.000
 * pode cobrir 1.000 de uma e 2.000 de outra, e so quem recebeu sabe.
 */
/**
 * Como o dinheiro entrou.
 *
 * Lista curta e fechada, e nao texto livre: no legado a mesma coisa aparece como
 * "Pix", "Transf. Pix Recebida", "Pgto QR Code Pix" e "Transf Pix recebida" —
 * quatro grafias que nenhum relatorio consegue agrupar.
 */
export const TIPOS_DE_RECEBIMENTO = [
  "PIX",
  "Boleto",
  "TED",
  "DOC",
  "Cartão de crédito",
  "Cartão de débito",
  "Dinheiro",
  "Cheque",
  "Transferência",
  "Outro",
] as const;

export type TipoDeRecebimento = (typeof TIPOS_DE_RECEBIMENTO)[number];


export type OrigemNova = {
  ticketId: number;
  valor: Centavos;
};


export type FiltroFaturas = {
  status?: StatusFatura;
  clienteId?: number;
  incluirCanceladas?: boolean;
  busca?: string;
};
