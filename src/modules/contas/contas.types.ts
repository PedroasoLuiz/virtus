import type { Centavos } from "@/shared/utils/money";
import type { DocumentoDoPagamento } from "@/modules/documentos/documentos.repository";
import type { DataISO } from "@/shared/utils/datas";

/**
 * Contas bancarias e o extrato de cada uma.
 *
 * Duas perguntas que sempre vem juntas: quanto tem em cada conta, e o que passou
 * por ela. Por isso o extrato nao e uma tela propria — ele e a segunda tela
 * desta, aberta a partir da conta escolhida. Extrato sem conta e uma pergunta
 * pela metade.
 */

export const TIPOS_DE_CONTA = ["Corrente", "Poupança", "Caixa", "Investimento"] as const;

export type TipoDeConta = (typeof TIPOS_DE_CONTA)[number];

export type ContaBancaria = {
  id: number;
  apelido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  ativo: boolean;
  limite: Centavos;
  saldoInicial: Centavos;
  /**
   * Saldo de hoje: inicial mais tudo que passou. Vem da view `vwsaldo`, nunca
   * de uma coluna — saldo guardado e a primeira coisa a divergir do extrato.
   *
   * ⚠️ NULO na listagem, e preenchido so na leitura por id.
   *
   * `vwsaldo` varre `pagamentos` inteiro a cada chamada, e a listagem pede todas
   * as contas da empresa: com vinte contas e vinte pessoas com a tela aberta,
   * era uma varredura completa por abertura, vezes vinte. Nulo aqui nao e
   * "saldo zero" — e "ninguem perguntou", e a tela que quiser o numero pede a
   * conta por id.
   */
  saldo: Centavos | null;
  /**
   * O que esta conta cobra para receber, e em quanto tempo credita.
   *
   * ⚠️ Mora na CONTA e nao no lancamento. A taxa e do contrato com a
   * adquirente: muda uma vez por ano e vale para todas as vendas daquela
   * maquininha. Perguntada a cada baixa, ela era refeita de cabeca ou consultada
   * no contrato — e cada pessoa chegava a um numero.
   */
  aceitaCartao: boolean;
  /** Percentuais. Nulos quando a conta nao recebe por aquela forma. */
  taxaDebito: number | null;
  taxaCredito: number | null;
  taxaParcelado: number | null;
  /**
   * Dias entre a venda no cartao e o credito.
   *
   * ⚠️ Nulo usa o padrao da forma de recebimento. `previsaoDeCredito` traz D+30
   * cravado, e cada contrato com a adquirente tem o seu prazo.
   */
  prazoCreditoDias: number | null;
  /** ⚠️ VALOR fixo, e nao percentual: o banco cobra por boleto emitido. */
  tarifaBoleto: Centavos | null;
  /** O nome que se le na tela. Apelido, ou banco e conta quando nao ha apelido. */
  nome: string;
};

export type ContaNova = {
  apelido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  ativo: boolean;
  limite: Centavos;
  saldoInicial: Centavos;
  aceitaCartao: boolean;
  taxaDebito: number | null;
  taxaCredito: number | null;
  taxaParcelado: number | null;
  prazoCreditoDias: number | null;
  tarifaBoleto: Centavos | null;
};

/** Uma linha do extrato. */
export type MovimentoDoExtrato = {
  /** O `pagamentos.id`. E o que permite marcar a linha como conferida. */
  id: number;
  data: DataISO | null;
  nome: string | null;
  tipo: "ENTRADA" | "SAIDA";
  valor: Centavos;
  origem: string | null;
  descricao: string | null;
  formaPagamento: string | null;
  /**
   * Conferido no extrato do banco. Gesto humano: nada no sistema marca sozinho,
   * porque a pergunta que ele responde e "eu vi isso na conta".
   */
  conciliado: boolean;
  /**
   * A que titulo esta linha pertence, com o que a tela precisa para ABRI-LO.
   *
   * ⚠️ Objeto e nao texto: o numero na tela e um link, e ele precisa do tipo e
   * do id. Mandando "CR 180 P 2", a tela teria de desmontar a string — e o
   * formato do rotulo passaria a ser contrato de duas telas sem ninguem dizer.
   *
   * ⚠️ `MOV` nao e falta de dado: e a resposta de que nao existe titulo por
   * tras. Tarifa e rendimento nunca terao um; a baixa do legado tambem nao,
   * porque ela gravava o dinheiro sem gravar o vinculo com a parcela.
   */
  documento: DocumentoDoPagamento | null;
  /**
   * Saldo depois deste movimento.
   *
   * Calculado na leitura, acumulando a partir do saldo de abertura. Nao aparece
   * linha a linha na tela — quem fecha o dia e o saldo do DIA —, mas e dele que
   * o saldo do dia sai.
   */
  saldoApos: Centavos;
};

export type Extrato = {
  contaId: number;
  contaNome: string;
  de: DataISO;
  ate: DataISO;
  /** Quanto havia na conta ANTES do primeiro dia do periodo. */
  saldoInicial: Centavos;
  saldoFinal: Centavos;
  entradas: Centavos;
  saidas: Centavos;
  /**
   * O saldo de HOJE da conta, e nao o do periodo consultado.
   *
   * ⚠️ Viaja junto do extrato porque sai de graca: `extrato()` ja busca a conta
   * por id para saber que ela existe, e essa leitura ja calcula o saldo. A tela
   * nao tem outro caminho para ele — a listagem parou de calcular saldo, e a
   * conta que ela entrega chega com o campo nulo.
   */
  saldoAtual: Centavos;
  /**
   * Quantos lancamentos da conta ainda nao foram conferidos no extrato do banco.
   *
   * ⚠️ Do EXTRATO INTEIRO, e nao do periodo consultado. A pergunta que ele
   * responde e "quanto falta conferir nesta conta", e ela nao muda quando
   * alguem estreita a janela da tela — estreitada, o numero cairia e daria a
   * impressao de trabalho feito.
   *
   * ⚠️ QUANTIDADE, e nao soma de valor. Entrada e saida se anulam: uma conta com
   * mil reais entrando e mil saindo, nenhum dos dois conferido, mostraria zero e
   * diria que nao ha nada a fazer.
   */
  semConciliar: number;
  movimentos: MovimentoDoExtrato[];
};
