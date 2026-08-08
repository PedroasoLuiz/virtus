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

export const filhoIdParamSchema = z.object({ id: idSchema, filhoId: idSchema });

export const enderecoSchema = z.object({
  id: z.number(),
  cep: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  principal: z.boolean(),
});

export const criarEnderecoBodySchema = z.object({
  cep: z.string().trim().max(12).nullish(),
  logradouro: z.string().trim().max(160).nullish(),
  numero: z.string().trim().max(20).nullish(),
  complemento: z.string().trim().max(80).nullish(),
  bairro: z.string().trim().max(80).nullish(),
  cidade: z.string().trim().max(80).nullish(),
  /** Duas letras. Estado por extenso quebraria a nota fiscal na hora de emitir. */
  uf: z.string().trim().length(2).nullish(),
  principal: z.boolean().default(false),
});

export const bancarioSchema = z.object({
  id: z.number(),
  banco: z.string().nullable(),
  agencia: z.string().nullable(),
  conta: z.string().nullable(),
  tipo: z.string().nullable(),
  titular: z.string().nullable(),
  documento: z.string().nullable(),
  pixTipo: z.string().nullable(),
  pixChave: z.string().nullable(),
  principal: z.boolean(),
});

export const criarBancarioBodySchema = z.object({
  banco: z.string().trim().max(80).nullish(),
  agencia: z.string().trim().max(20).nullish(),
  conta: z.string().trim().max(30).nullish(),
  tipo: z.enum(["corrente", "poupanca"]).nullish(),
  titular: z.string().trim().max(160).nullish(),
  documento: z.string().trim().max(20).nullish(),
  pixTipo: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).nullish(),
  pixChave: z.string().trim().max(160).nullish(),
  principal: z.boolean().default(false),
});

export const usuarioComAcessoSchema = z.object({
  id: z.string(),
  nome: z.string().nullable(),
  email: z.string().nullable(),
});

/*
 * ⚠️ Os vinculos vao INTEIROS, e nao "adiciona um" / "remove um".
 *
 * A tela edita a lista toda de uma vez, e duas pessoas mexendo ao mesmo tempo com
 * operacoes incrementais deixariam a pessoa num estado que nenhuma das duas
 * pediu. Mandando o conjunto, a ultima a salvar ganha e ela SABE o que mandou.
 */
export const definirUsuariosBodySchema = z.object({
  usuarios: z.array(z.uuid()).max(60),
});

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
export type FilhoIdParam = z.infer<typeof filhoIdParamSchema>;
export type CriarEnderecoBody = z.infer<typeof criarEnderecoBodySchema>;
export type CriarBancarioBody = z.infer<typeof criarBancarioBodySchema>;
export type DefinirUsuariosBody = z.infer<typeof definirUsuariosBodySchema>;
export type CriarContatoBody = z.infer<typeof criarContatoBodySchema>;
export type CriarClienteBody = z.infer<typeof criarClienteBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;

/** Edicao: tudo opcional — o cliente envia so o que mudou. */
export const atualizarClienteBodySchema = criarClienteBodySchema
  .partial()
  .extend({ ativo: z.boolean().optional() });

export type AtualizarClienteBody = z.infer<typeof atualizarClienteBodySchema>;
