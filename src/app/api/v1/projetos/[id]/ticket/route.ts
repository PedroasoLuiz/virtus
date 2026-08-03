import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { gerarTicketBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/:id/ticket — gera o ticket do escopo fechado. */

export const POST = handler(
  { body: gerarTicketBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.gerarTicketDoProjeto,
);
