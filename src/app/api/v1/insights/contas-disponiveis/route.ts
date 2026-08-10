import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";
import { contasDisponiveisBodySchema } from "@/modules/insights/insights.schema";

/**
 * /api/v1/insights/contas-disponiveis — o que um acesso enxerga na Meta.
 *
 * ⚠️ POST apesar de nao gravar nada. O token pode vir no corpo, e numa query ele
 * ficaria no historico do navegador e no log de qualquer proxy do caminho.
 * Credencial nao viaja em URL, mesmo em consulta.
 */
export const POST = handler(
  { body: contasDisponiveisBodySchema, requerModulo: "social" },
  controller.contasDisponiveis,
);
