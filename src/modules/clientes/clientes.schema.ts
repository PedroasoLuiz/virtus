import { z } from "zod";
import {
  cnpjSchema,
  emailSchema,
  idSchema,
  textoCurtoSchema,
} from "@/shared/validators/comuns";
import { paginacaoSchema } from "@/shared/utils/paginacao";

/** Contratos de entrada e saida do modulo clientes. */

export const papelSchema = z.enum(["cliente", "fornecedor", "colaborador"]);

export const campoDeOrdemSchema = z.enum([
  "id",
  "razao",
  "cnpj",
  "contato",
  "email",
  "responsavel",
]);

export const listarQuerySchema = paginacaoSchema.extend({
  busca: z.string().trim().max(120).optional(),
  papel: papelSchema.optional(),
  ativo: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  ordem: campoDeOrdemSchema.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export const contagemQuerySchema = z.object({
  /** Sem isto, so os ativos entram na conta — o mesmo padrao da listagem. */
  inativos: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const contagemSchema = z.object({
  total: z.number(),
  cliente: z.number(),
  fornecedor: z.number(),
  colaborador: z.number(),
});

export const criarClienteBodySchema = z.object({
  razao: textoCurtoSchema,
  nomeFantasia: textoCurtoSchema.nullish(),
  cnpj: cnpjSchema.nullish(),
  email: emailSchema.nullish(),
  contato: z.string().trim().max(40).nullish(),
  responsavel: textoCurtoSchema.nullish(),
  papeis: z.array(papelSchema).min(1, "Informe ao menos um papel"),
  grupoId: idSchema.nullish(),
  /** Omitido, o banco preenche com o "Geral" da empresa. */
  centroCustoId: idSchema.nullish(),
});

export const idParamSchema = z.object({ id: idSchema });

export const contatoIdParamSchema = z.object({ id: idSchema, contatoId: idSchema });

export const contatoSchema = z.object({
  id: z.number(),
  tipo: z.enum(["telefone", "email"]),
  valor: z.string(),
  rotulo: z.string().nullable(),
});

/**
 * ⚠️ O e-mail e validado como e-mail; o telefone, so pelo tamanho.
 *
 * Formato de telefone no Brasil e uma bagunca honesta — com DDI, sem DDI, com o
 * nono digito, ramal no fim —, e recusar o que a pessoa tem escrito na agenda
 * dela seria inventar uma regra que o cadastro nunca teve.
 */
export const criarContatoBodySchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("email"),
    valor: emailSchema,
    rotulo: z.string().trim().max(40).nullish(),
  }),
  z.object({
    tipo: z.literal("telefone"),
    valor: z.string().trim().min(8).max(30),
    rotulo: z.string().trim().max(40).nullish(),
  }),
]);

export const clienteSchema = z.object({
  id: z.number(),
  razao: z.string(),
  nomeFantasia: z.string().nullable(),
  cnpj: z.string().nullable(),
  email: z.string().nullable(),
  contato: z.string().nullable(),
  responsavel: z.string().nullable(),
  papeis: z.array(papelSchema),
  grupoId: z.number().nullable(),
  centroCustoId: z.number().nullable(),
  centroCustoNome: z.string().nullable(),
  ativo: z.boolean(),
});

export type ListarQuery = z.infer<typeof listarQuerySchema>;
export type ContagemQuery = z.infer<typeof contagemQuerySchema>;
export type ContatoIdParam = z.infer<typeof contatoIdParamSchema>;
export type CriarContatoBody = z.infer<typeof criarContatoBodySchema>;
export type CriarClienteBody = z.infer<typeof criarClienteBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;

/** Edicao: tudo opcional — o cliente envia so o que mudou. */
export const atualizarClienteBodySchema = criarClienteBodySchema
  .partial()
  .extend({ ativo: z.boolean().optional() });

export type AtualizarClienteBody = z.infer<typeof atualizarClienteBodySchema>;
