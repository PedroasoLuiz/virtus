import { z } from "zod";
import { centavosSchema, idSchema, textoCurtoSchema } from "@/shared/validators/comuns";
import { TIPOS_CENTRO_CUSTO } from "@/modules/cadastros/cadastros.types";

/** Contratos de entrada e saida dos cadastros simples. */

export const idParamSchema = z.object({ id: idSchema });

// ── Servicos ────────────────────────────────────────────────────────────────

export const criarServicoBodySchema = z.object({
  descricao: textoCurtoSchema,
  valor: centavosSchema,
  cnae: z.string().trim().max(20).nullish(),
  centroCustoId: idSchema.nullish(),
  ativo: z.boolean().optional(),
});

/** Edicao: tudo opcional — o cliente envia so o que mudou. */
export const atualizarServicoBodySchema = criarServicoBodySchema.partial();

export const servicoSchema = z.object({
  id: z.number(),
  descricao: z.string(),
  valor: z.number(),
  cnae: z.string().nullable(),
  centroCustoId: z.number().nullable(),
  ativo: z.boolean(),
});

// ── Centro de custo ─────────────────────────────────────────────────────────

export const criarCentroBodySchema = z.object({
  descricao: textoCurtoSchema,
  tipo: z.enum(TIPOS_CENTRO_CUSTO),
  ativo: z.boolean().optional(),
});

export const atualizarCentroBodySchema = criarCentroBodySchema.partial();

export const centroSchema = z.object({
  id: z.number(),
  descricao: z.string(),
  tipo: z.enum(TIPOS_CENTRO_CUSTO),
  ativo: z.boolean(),
});

export type CriarServicoBody = z.infer<typeof criarServicoBodySchema>;
export type AtualizarServicoBody = z.infer<typeof atualizarServicoBodySchema>;
export type CriarCentroBody = z.infer<typeof criarCentroBodySchema>;
export type AtualizarCentroBody = z.infer<typeof atualizarCentroBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
