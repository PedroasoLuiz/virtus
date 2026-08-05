import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import {
  conversaIdParamSchema,
  enviarTextoBodySchema,
} from "@/modules/whatsapp/whatsapp.schema";

/** /api/v1/whatsapp/conversas/{id}/mensagens */

export const GET = handler(
  { params: conversaIdParamSchema, requerModulo: "financeiro" },
  controller.abrirConversa,
);

export const POST = handler(
  {
    body: enviarTextoBodySchema,
    params: conversaIdParamSchema,
    requerModulo: "financeiro",
  },
  controller.responder,
);
