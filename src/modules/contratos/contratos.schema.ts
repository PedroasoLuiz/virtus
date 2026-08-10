import { z } from "zod";
import { centavosSchema, dataISOSchema, idSchema, textoLongoSchema } from "@/shared/validators/comuns";
import { NATUREZAS_CONTRATO, PERIODICIDADES } from "@/modules/contratos/contratos.types";

/** Contratos de entrada e saida do modulo contratos. */

export const idParamSchema = z.object({ id: idSchema });

export const criarContratoBodySchema = z.object({
  numero: z.string().trim().max(40).nullish(),
  descricao: textoLongoSchema.nullish(),
  clienteId: idSchema.nullish(),
  valor: centavosSchema,
  periodicidade: z.enum(PERIODICIDADES).default("MENSAL"),
  diaVencimento: z.number().int().min(1).max(31).nullish(),
  inicio: dataISOSchema.nullish(),
  fim: dataISOSchema.nullish(),
  /*
   * Omitida, o contrato nasce de RECEITA — que e o unico caso que existia antes
   * desta coluna, e o que todo consumidor atual manda.
   */
  natureza: z.enum(NATUREZAS_CONTRATO).default("RECEITA"),
});

export const atualizarContratoBodySchema = criarContratoBodySchema
  .partial()
  .extend({ ativo: z.boolean().optional() });

export type CriarContratoBody = z.infer<typeof criarContratoBodySchema>;
export type AtualizarContratoBody = z.infer<typeof atualizarContratoBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
