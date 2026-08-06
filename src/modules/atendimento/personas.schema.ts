import { z } from "zod";

/** Contratos de entrada e saida das personas. */

export const personaSchema = z.object({
  id: z.number(),
  contaId: z.number().nullable(),
  setorId: z.number().nullable(),
  nome: z.string(),
  descricao: z.string().nullable(),
  podeResolver: z.string().nullable(),
  ativo: z.boolean(),
});

export const salvarPersonaBodySchema = z.object({
  id: z.number().int().positive().nullable().default(null),
  /** Vazio vale para todos os numeros. */
  contaId: z.number().int().positive().nullable().default(null),
  /** Vazio e a persona geral. */
  setorId: z.number().int().positive().nullable().default(null),
  nome: z.string().trim().min(2).max(60),
  descricao: z.string().trim().max(2000).nullable().default(null),
  podeResolver: z.string().trim().max(4000).nullable().default(null),
  ativo: z.boolean().default(true),
});

export const personaParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type SalvarPersonaBody = z.infer<typeof salvarPersonaBodySchema>;
export type PersonaParam = z.infer<typeof personaParamSchema>;
