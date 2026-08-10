import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";
import { paginasDisponiveisBodySchema } from "@/modules/insights/insights.schema";

/**
 * /api/v1/insights/paginas-disponiveis — o que um acesso enxerga em Paginas.
 *
 * ⚠️ POST apesar de nao gravar nada, pelo mesmo motivo da busca de contas: o
 * token pode vir no corpo, e credencial nao viaja em URL.
 */
export const POST = handler(
  { body: paginasDisponiveisBodySchema, requerModulo: "financeiro" },
  controller.paginasDisponiveis,
);
