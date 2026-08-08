import { somarDias, proximoDiaUtil, type DataISO } from "@/shared/utils/datas";
import { subtrair, type Centavos } from "@/shared/utils/money";
import { TIPOS_DE_RECEBIMENTO, type TipoDeRecebimento } from "@/modules/faturas/faturas.types";

/**
 * Quando o dinheiro de um recebimento CAI, e quanto dele fica no caminho.
 *
 * ⚠️ Pagar e receber sao dois fatos com datas diferentes. O cliente passa o
 * cartao no dia 20 e a conta a receber fecha ali — ele pagou, nao deve mais. Mas
 * o dinheiro so aparece no extrato trinta dias depois, e ate la ele nao esta na
 * conta. Com uma data so, ou a cobranca fica aberta um mes depois de o cliente
 * ter pago, ou o caixa mostra dinheiro que ainda nao existe.
 *
 * ⚠️ A TAXA nao e desconto. Desconto e abatimento dado ao cliente; aqui ele pagou
 * o valor cheio e quem ficou com a diferenca foi a adquirente. Lancada como
 * desconto, a receita encolhe, o custo some, e o resultado erra dos dois lados.
 */

/** Quantos dias uteis ate o dinheiro cair, por forma de recebimento. */
const PRAZO_DE_CREDITO: Record<TipoDeRecebimento, number> = {
  PIX: 0,
  Dinheiro: 0,
  TED: 0,
  DOC: 1,
  Transferência: 0,
  Boleto: 1,
  "Cartão de débito": 1,
  // ⚠️ Trinta dias e o padrao do mercado para credito a vista, e nao uma regra:
  // cada contrato com a adquirente tem o seu, e antecipacao muda tudo. A tela
  // sugere e quem cadastra corrige.
  "Cartão de crédito": 30,
  Cheque: 1,
  Outro: 0,
};

/**
 * As formas em que reter taxa e o NORMAL.
 *
 * ⚠️ Nao e proibicao: qualquer recebimento aceita taxa, porque banco cobra
 * tarifa de boleto e de TED tambem. Isto so decide se a tela abre o campo
 * sozinha, para nao pedir taxa em todo PIX.
 */
const COM_TAXA: readonly TipoDeRecebimento[] = ["Cartão de crédito", "Cartão de débito", "Boleto"];

export function temTaxaDeCostume(tipo: TipoDeRecebimento): boolean {
  return COM_TAXA.includes(tipo);
}

export function creditaNoMesmoDia(tipo: TipoDeRecebimento): boolean {
  return PRAZO_DE_CREDITO[tipo] === 0;
}

/**
 * Quando este dinheiro deve cair.
 *
 * ⚠️ Cai em dia util. Banco nao credita sabado, e uma previsao de domingo faz o
 * fluxo de caixa prometer dinheiro para um dia em que nada se move.
 */
export function previsaoDeCredito(tipo: TipoDeRecebimento, pagoEm: DataISO): DataISO {
  const dias = PRAZO_DE_CREDITO[tipo] ?? 0;
  return dias === 0 ? proximoDiaUtil(pagoEm) : proximoDiaUtil(somarDias(pagoEm, dias));
}

/** O que sobra depois da retencao. E este numero que aparece no extrato. */
export function liquidoDoRecebimento(valor: Centavos, taxa: Centavos): Centavos {
  return subtrair(valor, taxa);
}

export { TIPOS_DE_RECEBIMENTO, type TipoDeRecebimento };
