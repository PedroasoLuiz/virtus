import { z } from "zod";
import { documentoValido, limparDocumento } from "@/shared/domain/documento";
import { ehDataISO } from "@/shared/utils/datas";

/**
 * Validadores reaproveitaveis. Se dois modulos validam a mesma coisa, o schema
 * mora aqui — nao duplicado em cada `*.schema.ts`.
 */

export const idSchema = z.coerce.number().int().positive();

export const dataISOSchema = z
  .string()
  .refine(ehDataISO, "Data deve estar no formato YYYY-MM-DD");

/** Valor monetario em centavos, como inteiro. A API nao aceita float em dinheiro. */
export const centavosSchema = z
  .number()
  .int("Valor deve ser inteiro em centavos")
  .nonnegative();

export const centavosPositivoSchema = centavosSchema.refine(
  (v) => v > 0,
  "Valor deve ser maior que zero",
);

/**
 * O documento de uma pessoa: CPF ou CNPJ.
 *
 * ⚠️ Aceita os DOIS, e antes so aceitava CNPJ.
 *
 * O cadastro sempre foi de pessoa fisica e juridica na mesma tabela — metade da
 * base sao pessoas com CPF —, mas a validacao exigia catorze digitos. O efeito
 * era silencioso do jeito pior: quem editava uma pessoa fisica clicava em salvar
 * e a tela recusava sem que ninguem entendesse o porque, porque o campo estava
 * preenchido e correto.
 *
 * ⚠️ Continua conferindo os digitos verificadores dos dois. Aceitar qualquer
 * numero de onze ou catorze digitos deixaria passar erro de digitacao, que e a
 * unica coisa que esta validacao existe para pegar.
 */
/**
 * CPF ou CNPJ, ja limpo e conferido.
 *
 * ⚠️ A regra mora em `shared/domain/documento`, e nao aqui. O CNPJ virou
 * alfanumerico em 31/07/2026, e ter a conta em dois lugares faria uma tela
 * aceitar a letra e a outra recusar o mesmo cadastro.
 */
export const cpfCnpjSchema = z
  .string()
  .transform(limparDocumento)
  .refine(
    (v) => v.length === 11 || v.length === 14,
    "Informe um CPF (11) ou CNPJ (14 caracteres)",
  )
  .refine(documentoValido, "Documento invalido");

export const emailSchema = z.email().max(255);

export const textoCurtoSchema = z.string().trim().min(1).max(255);
export const textoLongoSchema = z.string().trim().max(4000);

/** Ordenacao generica. Cada modulo restringe os campos permitidos. */
export function ordenacaoSchema<T extends readonly [string, ...string[]]>(campos: T) {
  return z.object({
    ordenarPor: z.enum(campos).optional(),
    direcao: z.enum(["asc", "desc"]).default("desc"),
  });
}

/**
 * Chave de idempotencia de operacoes financeiras de escrita. Reenviar a mesma
 * chave nao duplica efeito.
 */
export const idempotencyKeySchema = z.string().min(8).max(128);
