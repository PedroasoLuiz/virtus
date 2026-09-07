import type { DataISO } from "@/shared/utils/datas";
import type { Centavos } from "@/shared/utils/money";

/**
 * O que o cliente ve pelo link da cobranca.
 *
 * ⚠️ E a CONTA A RECEBER, e nao mais uma folha por ticket.
 *
 * O link e de uma PARCELA, e parcela pertence a conta. Antes a pagina abria uma
 * folha para cada ticket e repetia dentro de todas as mesmas parcelas — a mesma
 * cobranca impressa tantas vezes quantos tickets ela tivesse. Quem recebia uma
 * conta de dois tickets via dois documentos que se contradiziam sobre quanto ele
 * devia.
 *
 * Agora a folha e uma: a conta, com a composicao dizendo de onde o valor vem. O
 * numero de cada ticket e um LINK, e a folha dele continua existindo em
 * `/p/<token>/t/<numero>` — para quem quer conferir o servico, que e outra
 * pergunta.
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

export type ParcelaPublicaDaConta = {
  numero: number;
  vencimento: DataISO | null;
  total: Centavos;
  desconto: Centavos;
  pago: boolean;
  /**
   * Quanto ja entrou NESTA parcela.
   *
   * ⚠️ Nao e `pago ? total : 0`. Parcela baixada com desconto recebeu menos que
   * o total, e e sobre o que falta que corre a mora.
   */
  recebido: Centavos;
  pagoEm: DataISO | null;
  /** A parcela deste link. Numa lista de doze, todas parecem iguais. */
  atual: boolean;
};

/** Uma linha da composicao: de onde vem o dinheiro desta conta. */
export type OrigemPublica = {
  numero: number;
  titulo: string;
  /**
   * Quanto DESTE ticket entrou na conta — o valor do vinculo, e nao o total do
   * ticket. Um ticket pode ter entrado em parte, ou em mais de uma conta.
   */
  valor: Centavos;
  data: DataISO | null;
  /** A obra daquele ticket. Uma conta junta varios, de obras diferentes. */
  projetoNome: string | null;
};

export type ContaPublica = {
  numero: number;
  situacao: string;
  total: Centavos;
  /** Competencia, para o cabecalho. A tela formata o intervalo. */
  inicio: DataISO | null;
  fim: DataISO | null;
  cliente: {
    nome: string | null;
    doc: string | null;
    endereco: {
      logradouro: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      cidade: string | null;
      uf: string | null;
      cep: string | null;
    } | null;
  };
  tickets: OrigemPublica[];
  parcelas: ParcelaPublicaDaConta[];
};

export type TicketPublico = {
  numero: number;
  situacao: string;
  inicio: DataISO | null;
  fim: DataISO | null;
  descricao: string | null;
  /** ⚠️ PROJETO, e nao centro de custo — a obra e o que o cliente reconhece. */
  projeto: string | null;
  cliente: {
    nome: string | null;
    doc: string | null;
    endereco: string | null;
    endereco2: string | null;
  };
  itens: ItemPublico[];
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
  /** A conta — a folha que a pagina mostra. */
  conta: ContaPublica;
  /**
   * A regra de mora deste cliente.
   *
   * ⚠️ A MESMA fonte da tela interna (`parametroscobranca`), e nao uma copia:
   * dois lugares decidindo quanto se cobra de multa so divergem com o documento
   * ja na mao do cliente.
   */
  cobranca: {
    multaPercentual: number;
    jurosPercentual: number;
    jurosPeriodo: "MES" | "DIA";
    carenciaDias: number;
  } | null;
  /** Os tickets, para a folha de cada um. Nenhum deles fala de parcela. */
  tickets: TicketPublico[];
};
