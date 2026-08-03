import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { criarTicketBodySchema } from "@/modules/tickets/tickets.schema";

/** /api/v1/tickets */

export const POST = handler(
  { body: criarTicketBodySchema, requerModulo: "os" },
  controller.criarTicket,
);
