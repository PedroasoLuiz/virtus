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

export const listarQuerySchema = paginacaoSchema.extend({
  busca: z.string().trim().max(120).optional(),
  papel: papelSchema.optional(),
  ativo: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
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
export type CriarClienteBody = z.infer<typeof criarClienteBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;

/** Edicao: tudo opcional — o cliente envia so o que mudou. */
export const atualizarClienteBodySchema = criarClienteBodySchema
  .partial()
  .extend({ ativo: z.boolean().optional() });

export type AtualizarClienteBody = z.infer<typeof atualizarClienteBodySchema>;
