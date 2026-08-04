import type { DataISO } from "@/shared/utils/datas";
import type { Centavos } from "@/shared/utils/money";

/**
 * O que o cliente ve pelo link da cobranca.
 *
 * ⚠️ E o TICKET, nao a fatura. A fatura e controle interno — numero de conta a
 * receber, parcelamento, baixa. O cliente conhece o servico que contratou, e o
 * documento que ele ja recebia impresso e o do ticket, com a cobranca como um
 * bloco dentro dele.
 *
 * O formato espelha o PDF de propósito: quem recebe a cobranca ja conhece aquele
 * papel, e reconhecer o documento e o que faz confiar no link.
 */

/**
 * ⚠️ Todo dinheiro daqui e CENTAVOS, convertido no repositorio.
 *
 * O RPC devolve reais (double, como o banco herdado guarda). A conversao
 * acontece na fronteira, e nao na tela — foi o que faltou uma vez, e a pagina
 * mostrou uma parcela de 350,00 como "3,50" para o cliente.
 */
export type ItemPublico = {
  servico: string | null;
  descricao: string | null;
  data: DataISO | null;
  quantidade: number;
  unidade: "UN" | "H";
  valor: Centavos;
  desconto: Centavos;
  acrescimo: Centavos;
  total: Centavos;
  despesas: { descricao: string | null; valor: Centavos }[];
};

export type CobrancaPublica = {
  fatura: number;
  parcela: number;
  vencimento: DataISO | null;
  valor: Centavos;
  pago: boolean;
  /** A parcela deste link. Numa lista de doze, todas parecem iguais. */
  atual: boolean;
};

export type TicketPublico = {
  numero: number;
  situacao: string;
  inicio: DataISO | null;
  fim: DataISO | null;
  descricao: string | null;
  cliente: {
    nome: string | null;
    doc: string | null;
    centroDeCusto: string | null;
    endereco: string | null;
    endereco2: string | null;
  };
  itens: ItemPublico[];
  cobranca: CobrancaPublica[];
};

export type CobrancaCompartilhada = {
  /** Interno — usado so no assunto do e-mail e no rodape, nunca em destaque. */
  faturaNumero: number;
  parcelaAtual: number;
  temNfs: boolean;
  temBoleto: boolean;
  empresa: {
    razaoSocial: string | null;
    cnpj: string | null;
    logo: string | null;
    endereco: string | null;
  };
  tickets: TicketPublico[];
};
