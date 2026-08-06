import { z } from "zod";

/** Contratos de entrada e saida da configuracao de IA. */

const provedorSchema = z.enum(["gemini", "openai", "anthropic", "deepseek"]);

export const configIASchema = z.object({
  provedor: provedorSchema,
  modelo: z.string(),
  ativo: z.boolean(),
  temChave: z.boolean(),
  ordem: z.number(),
  numeroTeste: z.string().nullable(),
});

/**
 * `chave` opcional significa "mantem a que esta no vault", nunca "apaga". E o
 * que permite trocar o modelo sem redigitar a credencial — e sem que a tela
 * precise ter recebido a chave para reenvia-la.
 */
export const salvarProvedorBodySchema = z.object({
  provedor: provedorSchema,
  modelo: z.string().trim().min(3).max(60),
  ativo: z.boolean(),
  /** 1 responde; os demais existem para o dia em que ele nao responder. */
  ordem: z.number().int().min(1).max(9).default(1),
  chave: z.string().trim().min(20).nullable().default(null),
});

export const salvarNumeroTesteBodySchema = z.object({
  /** Vazio limpa o modo de teste. Ver `ConfigIA.numeroTeste`. */
  numeroTeste: z.string().trim().max(400).nullable().default(null),
});

export const provedorParamSchema = z.object({
  provedor: provedorSchema,
});

export type SalvarProvedorBody = z.infer<typeof salvarProvedorBodySchema>;
export type SalvarNumeroTesteBody = z.infer<typeof salvarNumeroTesteBodySchema>;
export type ProvedorParam = z.infer<typeof provedorParamSchema>;
