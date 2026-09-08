import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/movimentacoes/movimentacoes.controller";
import {
  criarMovimentacaoBodySchema,
  periodoQuerySchema,
} from "@/modules/movimentacoes/movimentacoes.schema";

/** /api/v1/movimentacoes?de=2026-09-01&ate=2026-09-30 */
export const GET = handler(
  { query: periodoQuerySchema, requerModulo: "financeiro" },
  controller.listar,
);

export const POST = handler(
  { body: criarMovimentacaoBodySchema, requerModulo: "financeiro" },
  controller.criar,
);
