/**
 * Valor por extenso, em reais.
 *
 * Recibo pede o valor escrito: e o que impede alterar um algarismo depois de
 * assinado. "1.500,00" vira "5.500,00" com uma canetada; "mil e quinhentos
 * reais" nao.
 *
 * Cobre ate centenas de milhoes, que e mais do que qualquer parcela deste
 * sistema vai ver.
 */

const UNIDADES = [
  "", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
  "dezoito", "dezenove",
];

const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
];

const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** Um grupo de tres digitos: 0 a 999. */
function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  if (n < 20) return UNIDADES[n];

  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }

  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} e ${ate999(resto)}`;
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (milhoes > 0) partes.push(`${ate999(milhoes)} ${milhoes === 1 ? "milhao" : "milhoes"}`);
  // "mil" nao leva "um" na frente: e "mil e duzentos", nao "um mil e duzentos".
  if (milhares > 0) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto > 0) partes.push(ate999(resto));

  /*
   * "e" antes do ultimo grupo so quando ele e menor que cem ou multiplo de cem:
   * "mil e duzentos", mas "mil duzentos e trinta".
   */
  if (partes.length > 1 && resto > 0 && (resto < 100 || resto % 100 === 0)) {
    const ultimo = partes.pop()!;
    return `${partes.join(", ")} e ${ultimo}`;
  }
  return partes.join(" ");
}

/** Recebe CENTAVOS, devolve a frase inteira. */
export function valorPorExtenso(centavos: number): string {
  const reais = Math.floor(Math.abs(centavos) / 100);
  const cents = Math.abs(centavos) % 100;

  const parteReais =
    reais === 0 ? "" : `${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`;
  const parteCents =
    cents === 0 ? "" : `${inteiroPorExtenso(cents)} ${cents === 1 ? "centavo" : "centavos"}`;

  if (!parteReais) return parteCents || "zero real";
  if (!parteCents) return parteReais;
  return `${parteReais} e ${parteCents}`;
}
