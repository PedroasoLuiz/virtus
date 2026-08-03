import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { idParamSchema, moverTicketBodySchema } from "@/modules/tickets/tickets.schema";

/** /api/v1/tickets/:id/status — move o ticket de coluna. */

export const PATCH = handler(
  { body: moverTicketBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.moverTicket,
);
