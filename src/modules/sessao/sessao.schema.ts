import { z } from "zod";
import { emailSchema, idSchema } from "@/shared/validators/comuns";

/** Contratos de entrada do modulo de sessao. */

export const loginSchema = z.object({
  email: emailSchema,
  // Sem regra de complexidade na ENTRADA: quem define politica de senha e o
  // Supabase Auth, no cadastro. Exigir aqui so quebraria o login de quem ja
  // tem senha antiga valida.
  senha: z.string().min(1, "Informe a senha"),
});

export const selecionarEmpresaSchema = z.object({
  empresaId: idSchema,
});

export const recuperarSenhaSchema = z.object({
  email: emailSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SelecionarEmpresaInput = z.infer<typeof selecionarEmpresaSchema>;
