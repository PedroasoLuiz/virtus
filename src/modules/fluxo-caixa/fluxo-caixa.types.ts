import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * A projecao de caixa: quanto se tem hoje, e quanto se tera a cada mes.
 *
 * ⚠️ E PREVISAO, e nao realizado. O DRE conta o que passou pela conta; aqui se
 * conta o que ainda vai passar, pelo VENCIMENTO do que esta em aberto. Os dois
 * nunca vao bater, e nao devem: um olha para tras e o outro para frente.
 */

/** Uma conta bancaria e o saldo dela hoje. */
export type ContaNaProjecao = {
  id: number;
  apelido: string | null;
  banco: string | null;
  conta: string | null;
  /** Pode ser negativo: conta no vermelho e um fato, e nao um erro. */
  saldo: Centavos;
};

/** Um mes da projecao. */
export type MesProjetado = {
  /** Primeiro dia do mes, para a tela formatar como quiser. */
  mes: DataISO;
  /** O que falta receber, com multa e juros do que ja venceu. */
  entrada: Centavos;
  /**
   * Quanto de `entrada` e multa e juros por atraso.
   *
   * ⚠️ Esta DENTRO de `entrada`, e nao ao lado. E um recorte para a observacao
   * embaixo da tabela poder dize-lo; somar os dois contaria o acrescimo duas
   * vezes.
   *
   * ⚠️ Vem da politica de cobranca do cliente, e nao de uma taxa fixa. Quem nao
   * tem politica cadastrada nao ganha acrescimo nenhum.
   */
  entradaAcrescimo: Centavos;
  /** Titulos mais cartao: o que sai no mes, somado. */
  saida: Centavos;
  /** A parte que vem de conta a pagar — inclui fatura de cartao ja fechada. */
  saidaTitulo: Centavos;
  /**
   * A parte que vem de fatura de cartao ainda ABERTA, no vencimento dela.
   *
   * ⚠️ Separada de `saidaTitulo` para poder ser CONFERIDA. Ela sempre esteve
   * dentro do total, e invisivel: nao havia como olhar a tabela e saber se a
   * fatura do mes tinha entrado. Numa projecao, o que nao se confere nao se
   * confia.
   *
   * ⚠️ Fatura FECHADA nao entra aqui: ela ja virou conta a pagar e conta em
   * `saidaTitulo`. Somar as duas dobraria o cartao.
   */
  saidaCartao: Centavos;
  /** Entrada menos saida. Negativo quando o mes fecha no vermelho. */
  resultado: Centavos;
  /**
   * O saldo previsto ao fim do mes: o de hoje mais tudo ate aqui.
   *
   * ⚠️ Nos meses JA VENCIDOS este numero nao e historico. Ele parte do saldo de
   * HOJE e soma meses que ja passaram, porque a serie mostra o vencido junto —
   * ver `vencido`. E por isso que a tela precisa marcar esses meses.
   */
  saldo: Centavos;
  /**
   * O mes ja passou e o que esta aqui continua em aberto.
   *
   * ⚠️ Nao e "atrasado" por engano: e divida e credito que venceram e ninguem
   * liquidou. Some-los ao mes corrente esconderia ha quanto tempo isso arrasta.
   */
  vencido: boolean;
};

export type ProjecaoDeCaixa = {
  /** Ate quando a projecao foi pedida. */
  ate: DataISO;
  /**
   * As contas que a pessoa escolheu, ou nulo para todas.
   *
   * ⚠️ Volta do servidor junto do resultado porque o PAPEL precisa dizer sob que
   * recorte aqueles numeros valem. Duas emissoes do mesmo mes, uma so da Cresol
   * e outra de todas, sao documentos diferentes com o mesmo titulo — e sem isso
   * escrito, ninguem distingue uma da outra depois de impressas.
   */
  contasEscolhidas: number[] | null;
  /** O vencido entrou na conta. */
  incluiVencidos: boolean;
  contas: ContaNaProjecao[];
  /** A soma dos saldos de hoje: o ponto de partida da curva. */
  saldoHoje: Centavos;
  meses: MesProjetado[];
};
