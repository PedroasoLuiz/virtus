import type { Centavos } from "@/shared/utils/money";

/**
 * As contas da DRE que a TELA e o PDF fazem igual.
 *
 * ⚠️ Funcao pura, e num lugar so. A tela desenha a grade e o PDF a imprime: as
 * duas precisam do mesmo total de mes e do mesmo acumulado, e escritas duas
 * vezes elas divergiriam no primeiro ajuste — com o papel dizendo um numero e a
 * tela outro, sobre o mesmo ano.
 */

type ComMeses = { meses: Centavos[] };

/** A soma de uma coluna: o mes somado em todos os centros de custo. */
export function somaDoMes(linhas: ComMeses[], mes: number): Centavos {
  return linhas.reduce((s, l) => s + (l.meses[mes] ?? 0), 0) as Centavos;
}

/**
 * O acumulado mes a mes, comecando do que veio antes do exercicio.
 *
 * ⚠️ Janeiro ja nasce somado a dezembro do ano anterior, e nao do zero. A
 * pergunta que esta linha responde e "quanto sobrou ate aqui", e uma empresa
 * que fechou o ano no vermelho nao amanhece em 1o de janeiro devendo nada.
 *
 * ⚠️ Acumula o RESULTADO do mes, que ja e receita menos despesa. Acumular os
 * dois lados em separado daria duas linhas que ninguem soma de cabeca.
 */
export function acumuladoPorMes(resultadoDoMes: Centavos[], anterior: Centavos): Centavos[] {
  const saida: Centavos[] = [];
  let corrente = anterior;

  for (const mes of resultadoDoMes) {
    corrente = (corrente + mes) as Centavos;
    saida.push(corrente);
  }

  return saida;
}
