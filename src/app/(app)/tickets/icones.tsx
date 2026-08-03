/**
 * Icones do card do quadro.
 *
 * 14px e nao 12: abaixo disso o tracado de 1.7 fecha e o desenho vira mancha.
 * Mesma gramatica do resto do sistema: 24x24, ponta e junta arredondadas,
 * `currentColor`.
 *
 * Ficam aqui e nao no kit porque so o card de ticket os usa — kit e o que se
 * repete entre telas.
 */

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: { flexShrink: 0 },
};

/**
 * Serviços — lista com marcadores.
 *
 * Terceira tentativa. A chave inglesa lia como "manutenção", e a lista com três
 * vistos tinha seis traços em 14px: virava mancha. O que se conta aqui é quantas
 * linhas o orçamento tem, e uma lista simples diz isso com metade dos traços.
 */
export function IconeServico() {
  return (
    <svg {...base} aria-hidden>
      <circle cx="5" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M10 6.5h10M10 12h10M10 17.5h10" />
    </svg>
  );
}

/**
 * Contas a receber — o recibo.
 *
 * A moeda falava de dinheiro em geral; o que se conta aqui é documento de
 * cobrança emitido, e recibo é a forma que se reconhece como tal.
 */
export function IconeFatura() {
  return (
    <svg {...base} aria-hidden>
      <path d="M5 3v18l2-1.4L9 21l2-1.4L13 21l2-1.4L17 21l2-1.4V3l-2 1.4L15 3l-2 1.4L11 3 9 4.4 7 3 5 4.4z" />
      <path d="M9 9h6M9 13h4" />
    </svg>
  );
}
