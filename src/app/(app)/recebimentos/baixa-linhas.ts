import { acrescimoPorAtraso, type ParametrosDeCobranca } from "@/shared/domain/cobranca";
import type { Centavos } from "@/shared/utils/money";
import type { ParcelaEmAberto } from "@/modules/recebimentos/recebimentos.types";

/**
 * O que a baixa guarda de cada parcela enquanto se digita.
 *
 * ⚠️ SEM `"use client"`. Este modulo e so tipo e funcao pura, e a diretiva
 * marcaria o modulo inteiro como cliente: dali em diante nem o servidor nem um
 * teste conseguiriam ler `valorDaLinha`, que e exatamente a conta que os dois
 * precisariam conferir. Ja custou dois bugs neste projeto.
 */

export type Valores = Record<number, EstadoDaLinha>;

export type EstadoDaLinha = {
  /** Esta parcela entra nesta baixa. Sem isto, toda a lista entraria sozinha. */
  incluida: boolean;
  juros: number;
  multa: number;
  desconto: number;
  /** `null` = o valor e calculado. Numero = pagamento parcial digitado a mao. */
  recebido: number | null;
};

/**
 * A linha que ninguem tocou.
 *
 * ⚠️ `recebido` nasce nulo porque o valor e CALCULADO: o que estava em aberto
 * menos o que foi perdoado. Digitar de novo um numero que ja esta na linha ao
 * lado seria trabalho de copia, e as duas versoes poderiam discordar.
 */
export const VAZIO: EstadoDaLinha = {
  incluida: false,
  juros: 0,
  multa: 0,
  desconto: 0,
  recebido: null,
};

/** O que abate divida nesta linha: o digitado, ou o que sobra do desconto. */
export function valorDaLinha(estado: EstadoDaLinha, emAberto: number): number {
  if (!estado.incluida) return 0;
  return estado.recebido ?? Math.max(0, emAberto - estado.desconto);
}

/**
 * Quantas parcelas cabem numa pagina da baixa.
 *
 * Dez porque a lista aqui e o meio, e nao o fim: quem baixa esta olhando o total
 * la embaixo, e uma tabela mais alta que a tela empurra o total para fora
 * justamente na hora de conferir.
 */
export const POR_PAGINA_NA_BAIXA = 10;

/**
 * A linha preenchida: tudo o que falta, mais o acrescimo que a politica sugere.
 *
 * O juros entra calculado e nao zerado porque digitar e o passo em que se erra:
 * quem recebe uma parcela vencida ha 40 dias sabe que ha juros, mas raramente
 * refaz a conta. Continua editavel — acordo com cliente nem sempre segue a
 * tabela, e a data do recebimento e o que define o atraso.
 */
export function preencher(
  parcela: ParcelaEmAberto,
  cobranca: ParametrosDeCobranca,
  data: string,
): EstadoDaLinha {
  const { juros, multa } = acrescimoPorAtraso(
    parcela.emAberto as Centavos,
    parcela.vencimento,
    data,
    cobranca,
  );

  return { incluida: true, juros, multa, desconto: 0, recebido: null };
}
