import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { criarStatusBodySchema } from "@/modules/tickets/tickets.schema";

/** /api/v1/tickets/status — colunas do quadro. */

export const GET = handler({ requerModulo: "os" }, controller.listarStatus);

export const POST = handler(
  { body: criarStatusBodySchema, requerModulo: "os" },
  controller.criarStatus,
);
