import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";

/** Como a conta fala de data. */

export function periodo(de: string | null, ate: string | null): string {
  if (!de) return "—";
  const fim = ate ?? de;
  return fim !== de
    ? `${paraFormatoBR(de as DataISO)} a ${paraFormatoBR(fim as DataISO)}`
    : paraFormatoBR(de as DataISO);
}

export function vencida(parcela: { pago: boolean; vencimento: string | null }): boolean {
  return !parcela.pago && parcela.vencimento != null && parcela.vencimento < hoje();
}

/** dd/mm/aa. O seculo nao muda nada aqui, e a coluna encolhe um terco. */
export function curto(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
