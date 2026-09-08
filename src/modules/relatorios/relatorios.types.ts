import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * O que falta receber e o que falta pagar, num periodo.
 *
 * ⚠️ E documento de COBRANCA e de COMPROMISSO, e por isso so traz o que esta em
 * aberto. O que ja foi liquidado se confere no extrato e na DRE — aqui ele so
 * ocuparia folha para dizer que nao ha nada a fazer.
 *
 * ⚠️ Nao confundir com a projecao de caixa. La a pergunta e "quanto vou ter";
 * aqui e "de quem cobro e a quem devo". A projecao soma tudo num numero por mes;
 * este lista parcela por parcela, com nome e documento.
 */

/** De que lado do dinheiro. */
export type LadoDoRelatorio = "receber" | "pagar";

/** Uma parcela em aberto. */
export type ParcelaDoRelatorio = {
  vencimento: DataISO;
  /** O id do titulo, para a tela abrir o drawer dele. */
  documentoId: number;
  /**
   * O numero que a pessoa ve.
   *
   * ⚠️ `idtenant` na conta a receber e `numero` na conta a pagar — cada lado tem
   * a sua sequencia por empresa. Nunca o `id`, que e a sequencia global e nao
   * aparece em nenhuma outra tela.
   */
  documentoNumero: number;
  parcelaId: number;
  numero: number;
  /** Quantas parcelas o titulo tem: "5 de 8". */
  deQuantas: number;
  /** Cliente, do lado que recebe; fornecedor, do lado que paga. */
  pessoa: string;
  descricao: string | null;
  /** O valor combinado da parcela. */
  valor: Centavos;
  /** Quanto ja entrou (ou saiu), somando baixas e descontos. */
  jaPago: Centavos;
  /** O que falta. E este o numero que se cobra. */
  emAberto: Centavos;
  /** Zero quando ainda nao venceu. */
  diasDeAtraso: number;
};

/**
 * Um mes do relatorio.
 *
 * ⚠️ O agrupamento e por MES DE VENCIMENTO, por decisao do Pedro. Ele casa com o
 * fluxo de caixa e responde "quanto cai em cada mes" sem obrigar a somar as
 * linhas na mao.
 */
export type MesDoRelatorio = {
  /** Primeiro dia do mes, para a tela formatar como quiser. */
  mes: DataISO;
  parcelas: ParcelaDoRelatorio[];
  total: Centavos;
};

/**
 * Um ciclo de cartao ainda aberto, resumido.
 *
 * ⚠️ Uma linha por CICLO, e nao por compra. A fatura e um compromisso so, com um
 * vencimento so; as vinte compras dela respondem outra pergunta, e a tela do
 * cartao ja responde essa.
 */
export type CicloDeCartao = {
  faturaId: number;
  cartaoId: number;
  cartao: string;
  /** O mes do ciclo: "Ciclo 09/2026". */
  competencia: DataISO;
  /** Quando a fatura vence. E por esta data que o relatorio filtra. */
  vencimento: DataISO;
  compras: number;
  total: Centavos;
  diasDeAtraso: number;
};

/**
 * O cartao no relatorio de contas a pagar.
 *
 * ⚠️ Nulo quando a pessoa NAO pediu para considerar. Nulo e "nao perguntou";
 * lista vazia seria "perguntou e nao ha nada" — e as duas coisas se leem
 * diferente no papel.
 *
 * ⚠️ So ciclos ABERTOS. A fatura fechada ja virou conta a pagar e esta na tabela
 * principal; trazer as duas contaria o cartao duas vezes. E a mesma regra da
 * projecao de caixa.
 */
export type CartaoNoRelatorio = {
  ciclos: CicloDeCartao[];
  total: Centavos;
};

export type Relatorio = {
  lado: LadoDoRelatorio;
  de: DataISO;
  ate: DataISO;
  meses: MesDoRelatorio[];
  /**
   * Os ciclos de cartao em aberto, quando pedidos. Nulo quando nao.
   *
   * ⚠️ So existe do lado que PAGA. Cartao de credito e divida da empresa; nao ha
   * equivalente do lado que recebe.
   */
  cartao: CartaoNoRelatorio | null;
  /**
   * O total do periodo.
   *
   * ⚠️ SOMA o cartao quando ele foi pedido. Um total que ignorasse a fatura que
   * a pessoa pediu para considerar seria um numero que nao fecha com o que esta
   * impresso logo acima dele.
   */
  total: Centavos;
  /** Quanto do total ja venceu. Zero quando nao ha atraso nenhum. */
  vencido: Centavos;
  quantidade: number;
};
