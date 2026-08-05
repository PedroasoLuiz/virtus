import { z } from "zod";

/** Contratos de entrada e saida da configuracao de IA. */

export const configIASchema = z.object({
  provedor: z.literal("gemini"),
  modelo: z.string(),
  ativo: z.boolean(),
  temChave: z.boolean(),
  numeroTeste: z.string().nullable(),
});

/**
 * `chave` opcional significa "mantem a que esta no vault", nunca "apaga". E o
 * que permite trocar o modelo sem redigitar a credencial — e sem que a tela
 * precise ter recebido a chave para reenvia-la.
 */
export const salvarConfigIABodySchema = z.object({
  modelo: z.string().trim().min(3).max(60),
  ativo: z.boolean(),
  chave: z.string().trim().min(20).nullable().default(null),
  /** Vazio limpa o modo de teste. Ver `ConfigIA.numeroTeste`. */
  numeroTeste: z.string().trim().max(25).nullable().default(null),
});

export type SalvarConfigIABody = z.infer<typeof salvarConfigIABodySchema>;
