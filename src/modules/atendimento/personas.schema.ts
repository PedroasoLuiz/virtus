import { z } from "zod";
import { temPalavrao } from "@/shared/domain/linguagem";

/** Contratos de entrada e saida das personas. */

export const personaSchema = z.object({
  id: z.number(),
  contaId: z.number().nullable(),
  setorId: z.number().nullable(),
  nome: z.string(),
  descricao: z.string().nullable(),
  evitar: z.string().nullable(),
  saudacao: z.string().nullable(),
  podeResolver: z.string().nullable(),
  permissoes: z.array(z.string()),
  ativo: z.boolean(),
});

export const salvarPersonaBodySchema = z.object({
  id: z.number().int().positive().nullable().default(null),
  /** Vazio vale para todos os numeros. */
  contaId: z.number().int().positive().nullable().default(null),
  /** Vazio e a persona geral. */
  setorId: z.number().int().positive().nullable().default(null),
  /*
   * ⚠️ A checagem do nome vive AQUI, e nao so na tela: a tela e conveniencia, o
   * schema e a regra, e um POST direto passaria por cima do formulario.
   */
  nome: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .refine((v) => !temPalavrao(v), "Escolha outro nome para esta persona"),
  descricao: z.string().trim().max(2000).nullable().default(null),
  evitar: z.string().trim().max(2000).nullable().default(null),
  saudacao: z.string().trim().max(400).nullable().default(null),
  podeResolver: z.string().trim().max(4000).nullable().default(null),
  permissoes: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  ativo: z.boolean().default(true),
});

/**
 * O pedido de rascunho a IA.
 *
 * ⚠️ `setorNome` e so CONTEXTO para o texto sair no tom certo, e nao amarra
 * nada: quem decide o setor da persona e o formulario. Nulo diz ao modelo que a
 * persona e a geral, que nao pode consultar dado de cliente.
 */
export const sugestaoDePersonaBodySchema = z.object({
  credencialId: z.number().int().positive(),
  setorNome: z.string().trim().max(60).nullable().default(null),
  contexto: z.string().trim().min(10).max(2000),
});

export const personaParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type SalvarPersonaBody = z.infer<typeof salvarPersonaBodySchema>;
export type SugestaoDePersonaBody = z.infer<typeof sugestaoDePersonaBodySchema>;
export type PersonaParam = z.infer<typeof personaParamSchema>;
