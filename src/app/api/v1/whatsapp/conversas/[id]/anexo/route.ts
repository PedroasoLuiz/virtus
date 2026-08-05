import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { conversaIdParamSchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/conversas/{id}/anexo
 *
 * Sem schema de `body` de proposito: o corpo e `multipart/form-data`, e o
 * `handler` so sabe ler JSON. O controller le o `FormData` direto — um arquivo
 * de 16 MB nao pode passar por `JSON.parse`.
 */

export const POST = handler(
  { params: conversaIdParamSchema, requerModulo: "financeiro" },
  controller.enviarAnexo,
);
