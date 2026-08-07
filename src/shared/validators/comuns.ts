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
export const cpfCnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 11 || v.length === 14, "Informe um CPF (11) ou CNPJ (14 digitos)")
  .refine((v) => (v.length === 11 ? cpfValido(v) : cnpjValido(v)), "Documento invalido");

/**
 * ⚠️ Mantido como apelido de `cpfCnpjSchema`.
 *
 * O nome `cnpjSchema` esta espalhado por outros modulos, e trocar todos de uma
 * vez arriscaria mexer em validacao de tela que nao esta sendo testada agora. O
 * comportamento e o novo: os dois documentos passam.
 */
export const cnpjSchema = cpfCnpjSchema;

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

/**
 * Os digitos verificadores do CPF.
 *
 * Mesma ideia do CNPJ com outros pesos: os nove primeiros digitos geram o
 * decimo, e os dez geram o decimo primeiro.
 */
function cpfValido(cpf: string): boolean {
  // Todos iguais fecha a formula e nao existe: 111.111.111-11 passaria.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

function cnpjValido(cnpj: string): boolean {
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
