import type { Centavos } from "@/shared/utils/money";
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
   */
  saldo: Centavos;
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
  movimentos: MovimentoDoExtrato[];
};
