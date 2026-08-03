import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { alterarStatusBodySchema, idParamSchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/status
 *
 * Endpoint proprio em vez de um PATCH generico na fatura: mudanca de estado
 * tem regra de transicao propria e merece contrato separado.
 */
export const PUT = handler(
  { body: alterarStatusBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.alterarStatus,
);
