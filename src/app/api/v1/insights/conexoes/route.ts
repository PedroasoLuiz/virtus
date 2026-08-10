import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";
import { conectarContasBodySchema } from "@/modules/insights/insights.schema";

/**
 * /api/v1/insights/conexoes — as contas de anuncio ligadas.
 *
 * ⚠️ O GET nunca devolve token. Ele vive cifrado no vault, preso ao ACESSO, e so
 * e lido no servidor no instante da consulta a Meta.
 *
 * ⚠️ O POST liga N contas sob UM acesso, e nao uma por chamada. Uma por chamada
 * gravaria o segredo N vezes, que era o modelo antigo e fazia a renovacao
 * alcancar so uma delas.
 */
export const GET = handler({ requerModulo: "financeiro" }, controller.listar);

export const POST = handler(
  { body: conectarContasBodySchema, requerModulo: "financeiro" },
  controller.conectarContas,
);
