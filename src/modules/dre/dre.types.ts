import type { Centavos } from "@/shared/utils/money";

/**
 * Uma linha da DRE: um centro de custo, os doze meses e o total do ano.
 *
 * ⚠️ `meses` tem SEMPRE doze posicoes, mesmo com o ano pela metade. O mes sem
 * movimento e zero, e nao ausencia: a tabela e uma grade de doze colunas, e uma
 * lista curta desalinharia agosto de uma linha com maio de outra.
 */
export type LinhaDaDre = {
  categoria: string;
  meses: Centavos[];
  total: Centavos;
};

/**
 * O fechamento do ano, e o lucro de cada mes.
 *
 * ⚠️ `meses` aqui e o RESULTADO do mes (receita menos despesa), e por isso pode
 * ser negativo. Nas linhas de receita e de despesa, nao.
 */
export type ResumoDaDre = {
  receitas: Centavos;
  despesas: Centavos;
  lucro: Centavos;
  meses: Centavos[];
  /**
   * O resultado de tudo que aconteceu ANTES de 1o de janeiro deste exercicio.
   *
   * ⚠️ E o que faz o acumulado de janeiro ser "janeiro + dezembro do ano
   * passado". Zerado a cada virada de ano, o acumulado diria que a empresa
   * comeca do zero todo mes de janeiro, que e verdade contabil de resultado do
   * exercicio e mentira sobre o dinheiro.
   */
  acumuladoAnterior: Centavos;
};

export type Dre = {
  ano: number;
  receitas: LinhaDaDre[];
  despesas: LinhaDaDre[];
  resumo: ResumoDaDre;
};
