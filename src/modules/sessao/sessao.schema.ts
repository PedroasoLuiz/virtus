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

/**
 * Campo opcional de texto: vazio vira `null`.
 *
 * ⚠️ String vazia e `null` significam a mesma coisa aqui — "nao informou" —, e
 * guardar as duas faria toda leitura testar os dois casos para sempre.
 */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .default(null);

export const editarPerfilSchema = z.object({
  nome: z.string().trim().min(2, "Informe o seu nome").max(120, "Nome muito longo"),
  /* Data solta (`YYYY-MM-DD`) e nao `datetime`: aniversario nao tem hora nem
     fuso, e guardar com hora faria a data virar a vespera em meio mundo. */
  nascimento: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .transform((v) => v || null)
    .nullable()
    .or(z.literal("").transform(() => null))
    .default(null),
  whatsapp: opcional(20),
  instagram: opcional(60),
  pronome: opcional(40),
  funcao: opcional(80),
});

/**
 * ⚠️ A senha ATUAL entra junto, e nao so a nova.
 *
 * `updateUser` troca a senha de quem ja tem sessao valida — o que significa que
 * uma maquina deixada aberta bastaria para trocar a senha e tomar a conta. Pedir
 * a atual e o que prova que quem esta ali e o dono, e nao quem sentou na
 * cadeira.
 */
export const alterarSenhaSchema = z.object({
  atual: z.string().min(1, "Informe a senha atual"),
  nova: z.string().min(6, "A nova senha precisa de ao menos 6 caracteres"),
});

export const trocarEmailSchema = z.object({
  novo: emailSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SelecionarEmpresaInput = z.infer<typeof selecionarEmpresaSchema>;
