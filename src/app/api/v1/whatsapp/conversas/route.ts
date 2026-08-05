import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { listarConversasQuerySchema } from "@/modules/whatsapp/whatsapp.schema";

/** /api/v1/whatsapp/conversas */

export const GET = handler(
  { query: listarConversasQuerySchema, requerModulo: "financeiro" },
  controller.listarConversas,
);
