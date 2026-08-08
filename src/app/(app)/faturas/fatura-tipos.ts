/**
 * O que a conta a receber e, para a tela.
 *
 * ⚠️ Arquivo proprio porque cinco arquivos leem estes tipos: o drawer, as duas
 * abas, os documentos e as acoes da parcela. Declarados dentro do drawer, cada um
 * deles teria de importar do proprio pai.
 */

export type Parcela = {
  id: number;
  numero: number;
  vencimento: string | null;
  valor: number;
  acrescimo: number;
  desconto: number;
  total: number;
  pago: boolean;
  /** Preenchido quando a baixa foi conciliada. E o que trava a edicao. */
  pagamentoId: number | null;
  /** Data da baixa. E o fato que o recibo comprova — nao e o vencimento. */
  pagoEm: string | null;
  /** A baixa ja bateu com o extrato. Vem do pagamento, nao da parcela. */
  conciliado: boolean;
  /** Quanto ja entrou nesta parcela, de um pagamento ou de varios. */
  recebido: number;
  nfs: string | null;
  boleto: string | null;
  comprovante: string | null;
};

export type TicketDaFatura = {
  ticketId: number;
  numero: number;
  valor: number;
  titulo: string;
  status: string;
  clienteNome: string | null;
  encerradoEm: string | null;
};

export type Fatura = {
  id: number;
  numero: number;
  clienteId: number | null;
  clienteNome: string | null;
  /** Coluna própria no banco, não um status: a conta guarda em que estado foi cancelada. */
  cancelada: boolean;
  apuracaoInicio: string | null;
  apuracaoFim: string | null;
  situacao: string;
  total: number;
  observacoes: string | null;
  rodape: string | null;
  parcelas: Parcela[];
  tickets: TicketDaFatura[];
  clienteDoc: string | null;
  emitente: {
    razaoSocial: string | null;
    endereco: string | null;
    cnpj: string | null;
    logo: string | null;
  };
  historico: {
    criadoEm: string | null;
    criadoPor: string | null;
    editadoEm: string | null;
    editadoPor: string | null;
  };
};

