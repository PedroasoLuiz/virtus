import { z } from "zod";
import { serverClient } from "@/infra/supabase/client";
import { deReais, type Centavos } from "@/shared/utils/money";
import type { Dre, LinhaDaDre } from "@/modules/dre/dre.types";

/**
 * A DRE sai PRONTA do banco, pela funcao `dre_por_ano`.
 *
 * ⚠️ A conta mora no Postgres de proposito, e nao aqui. Ela varre `pagamentos` e
 * `cartaofaturasparcelas` do ano inteiro para devolver uma matriz de doze
 * colunas: trazer as linhas cruas para somar em TypeScript seria arrastar
 * milhares de registros pela rede a cada abertura da tela.
 *
 * ⚠️ Sem `security definer`, entao a RLS continua valendo: quem le e o usuario.
 * O `pfkempresa` nao e a protecao, e sim o recorte — a funcao aceita nulo para
 * "todas", e nulo aqui traria as outras empresas do mesmo usuario para dentro
 * do mesmo relatorio.
 */

/**
 * ⚠️ A resposta e `jsonb`, entao chega como `unknown` e e conferida aqui.
 *
 * Sem isso, uma mudanca na funcao apareceria na tela como `undefined` no meio de
 * uma coluna de dinheiro, e nao como erro.
 */
const linhaSchema = z.object({
  categoria: z.string(),
  meses: z.array(z.number()),
  total: z.number(),
});

const respostaSchema = z.object({
  Receitas: z.array(linhaSchema).nullable(),
  Despesas: z.array(linhaSchema).nullable(),
  Resumo: z.object({
    ReceitasTotal: z.number(),
    DespesasTotal: z.number(),
    LucroTotal: z.number(),
    /* Nulavel porque a chave nasceu depois: uma resposta em cache de antes da
       migration nao a traz, e um `parse` estourando aqui derrubaria a tela. */
    AcumuladoAnterior: z.number().nullish(),
    Meses: z.array(z.number()).nullable(),
  }),
});

const MESES_NO_ANO = 12;

/**
 * ⚠️ Doze posicoes, sempre. O banco devolve o que tem; um ano sem movimento
 * nenhum volta com `Meses` nulo, e a tabela precisa das doze colunas assim
 * mesmo.
 */
function dozeMeses(valores: number[] | null | undefined): Centavos[] {
  const cheio = Array.from({ length: MESES_NO_ANO }, (_, i) => valores?.[i] ?? 0);
  return cheio.map(deReais);
}

function paraLinha(l: z.infer<typeof linhaSchema>): LinhaDaDre {
  return {
    categoria: l.categoria,
    meses: dozeMeses(l.meses),
    total: deReais(l.total),
  };
}

export async function dreDoAno(empresaId: number, ano: number): Promise<Dre> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("dre_por_ano", {
    pano: ano,
    pfkempresa: empresaId,
  });

  if (error) throw error;

  const bruto = respostaSchema.parse(data);

  return {
    ano,
    receitas: (bruto.Receitas ?? []).map(paraLinha),
    despesas: (bruto.Despesas ?? []).map(paraLinha),
    resumo: {
      receitas: deReais(bruto.Resumo.ReceitasTotal),
      despesas: deReais(bruto.Resumo.DespesasTotal),
      lucro: deReais(bruto.Resumo.LucroTotal),
      meses: dozeMeses(bruto.Resumo.Meses),
      acumuladoAnterior: deReais(bruto.Resumo.AcumuladoAnterior ?? 0),
    },
  };
}
