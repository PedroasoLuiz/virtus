import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { atualizarStatusBodySchema, idParamSchema } from "@/modules/tickets/tickets.schema";

/** /api/v1/tickets/status/:id */

export const PATCH = handler(
  { body: atualizarStatusBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.atualizarStatus,
);

export const DELETE = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.excluirStatus,
);
