import { z } from "zod";
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

export const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 14, "CNPJ deve ter 14 digitos")
  .refine(digitosVerificadoresValidos, "CNPJ invalido");

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

function digitosVerificadoresValidos(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digito = (base: string, pesoInicial: number): number => {
    let peso = pesoInicial;
    let soma = 0;
    for (const char of base) {
      soma += Number(char) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = digito(cnpj.slice(0, 12), 5);
  const d2 = digito(cnpj.slice(0, 13), 6);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}
