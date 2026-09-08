import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import type {
  MesDoRelatorio,
  ParcelaDoRelatorio,
} from "@/modules/relatorios/relatorios.types";

/**
 * Agrupa as parcelas por mes de vencimento e soma cada grupo.
 *
 * Funcao pura: nao toca banco, nao conhece HTTP. Mora aqui porque a TELA e o PDF
 * precisam do mesmo agrupamento, e feito duas vezes os dois divergiriam no
 * primeiro ajuste — foi assim que o legado acabou com relatorios que nao somavam
 * igual entre si.
 *
 * ⚠️ Preserva a ORDEM em que as parcelas chegam. O banco ja devolve por
 * vencimento; reordenar aqui seria uma segunda regra de ordenacao, e no dia em
 * que uma mudasse a outra ficaria mentindo.
 */
export function porMesDeVencimento(
  parcelas: ParcelaDoRelatorio[],
): MesDoRelatorio[] {
  const meses = new Map<string, ParcelaDoRelatorio[]>();

  for (const p of parcelas) {
    const chave = `${p.vencimento.slice(0, 7)}-01`;
    const lista = meses.get(chave);
    if (lista) lista.push(p);
    else meses.set(chave, [p]);
  }

  return [...meses.entries()].map(([mes, lista]) => ({
    mes: mes as DataISO,
    parcelas: lista,
    total: somar(lista),
  }));
}

/** O que falta, somado. */
export function somar(parcelas: ParcelaDoRelatorio[]): Centavos {
  return parcelas.reduce((t, p) => t + p.emAberto, 0) as Centavos;
}

/**
 * Quanto do total ja venceu.
 *
 * ⚠️ Le `diasDeAtraso`, e nao compara datas de novo. Quem decide o que e atraso
 * e o banco, no momento da consulta; refazer a conta aqui com o relogio do
 * navegador daria respostas diferentes para o mesmo relatorio conforme o fuso da
 * maquina.
 */
export function vencido(parcelas: ParcelaDoRelatorio[]): Centavos {
  return parcelas
    .filter((p) => p.diasDeAtraso > 0)
    .reduce((t, p) => t + p.emAberto, 0) as Centavos;
}
