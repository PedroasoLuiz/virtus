import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { atualizarTicketBodySchema, idParamSchema } from "@/modules/tickets/tickets.schema";

/** /api/v1/tickets/:id */

export const GET = handler({ params: idParamSchema, requerModulo: "os" }, controller.obterTicket);

export const PATCH = handler(
  { body: atualizarTicketBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.atualizarTicket,
);
