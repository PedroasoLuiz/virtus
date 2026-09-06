import { z } from "zod";
import { centavosSchema, dataISOSchema, idSchema } from "@/shared/validators/comuns";

export const criarMovimentacaoBodySchema = z
  .object({
    data: dataISOSchema,
    valor: centavosSchema,
    origemId: idSchema,
    destinoId: idSchema,
    observacoes: z.string().trim().max(300).nullish(),
  })
  /*
   * ⚠️ Origem e destino diferentes, e a conferencia e AQUI, na borda.
   *
   * Transferir de uma conta para ela mesma grava duas linhas que se anulam: o
   * saldo nao muda, o extrato ganha duas conferencias a fazer, e nada explica
   * por que elas existem.
   */
  .refine((m) => m.origemId !== m.destinoId, {
    message: "A conta de origem e a de destino precisam ser diferentes",
    path: ["destinoId"],
  });

export const periodoQuerySchema = z.object({
  de: dataISOSchema,
  ate: dataISOSchema,
});

/** O id de uma transferencia e o uuid que as duas pontas dividem. */
export const movimentacaoParamSchema = z.object({ id: z.string().uuid() });

export type CriarMovimentacaoBody = z.infer<typeof criarMovimentacaoBodySchema>;
export type PeriodoQuery = z.infer<typeof periodoQuerySchema>;
export type MovimentacaoParam = z.infer<typeof movimentacaoParamSchema>;
