import { z } from "zod";

/** Contratos de entrada e saida da configuracao de IA. */

const provedorSchema = z.enum(["gemini", "openai", "anthropic", "deepseek"]);

export const configIASchema = z.object({
  id: z.number(),
  nome: z.string(),
  chaveFinal: z.string().nullable(),
  provedor: provedorSchema,
  modelo: z.string(),
  ativo: z.boolean(),
  temChave: z.boolean(),
  emUso: z.number(),
  numeroTeste: z.string().nullable(),
});

/**
 * `chave` opcional significa "mantem a que esta no vault", nunca "apaga". E o
 * que permite trocar o modelo sem redigitar a credencial — e sem que a tela
 * precise ter recebido a chave para reenvia-la.
 */
export const salvarProvedorBodySchema = z.object({
  id: z.number().int().positive().nullable().default(null),
  nome: z.string().trim().min(2).max(60),
  provedor: provedorSchema,
  modelo: z.string().trim().min(3).max(60),
  ativo: z.boolean(),
  chave: z.string().trim().min(20).nullable().default(null),
});

export const salvarNumeroTesteBodySchema = z.object({
  /** Vazio limpa o modo de teste. Ver `ConfigIA.numeroTeste`. */
  numeroTeste: z.string().trim().max(400).nullable().default(null),
});

export const provedorParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type SalvarProvedorBody = z.infer<typeof salvarProvedorBodySchema>;
export type SalvarNumeroTesteBody = z.infer<typeof salvarNumeroTesteBodySchema>;
export type ProvedorParam = z.infer<typeof provedorParamSchema>;
