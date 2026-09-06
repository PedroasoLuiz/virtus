import { z } from "zod";

/**
 * O ano do relatorio.
 *
 * ⚠️ Teto e piso existem porque o parametro vem da URL. Sem eles, `ano=999999`
 * chega ao Postgres e faz a funcao varrer `pagamentos` e `cartaofaturasparcelas`
 * inteiros para devolver uma matriz de zeros — custo de varredura completa por
 * uma pergunta que ninguem faz. A base comeca em 2020.
 */
export const dreQuerySchema = z.object({
  ano: z.coerce.number().int().min(2020).max(2100),
});

export type DreQuery = z.infer<typeof dreQuerySchema>;

const linhaDaDreSchema = z.object({
  categoria: z.string(),
  meses: z.array(z.number().int()),
  total: z.number().int(),
});

/**
 * ⚠️ O contrato de SAIDA tambem e declarado.
 *
 * `parse` recebe `unknown`, entao campo a mais ou a menos nao e erro de
 * compilacao: aparece em producao como "Dados inválidos", sem dizer qual. O
 * controller passa o objeto por `z.input` antes, e a divergencia vira erro do
 * `tsc`.
 */
export const dreSchema = z.object({
  ano: z.number().int(),
  receitas: z.array(linhaDaDreSchema),
  despesas: z.array(linhaDaDreSchema),
  resumo: z.object({
    receitas: z.number().int(),
    despesas: z.number().int(),
    lucro: z.number().int(),
    meses: z.array(z.number().int()),
    acumuladoAnterior: z.number().int(),
  }),
});
