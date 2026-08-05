import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import {
  conversaIdQuerySchema,
  midiaIdParamSchema,
} from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/midia/{id}
 *
 * Proxy do anexo recebido. Existe porque a URL que a Meta devolve tambem exige
 * o Bearer para baixar — nao ha como entrega-la ao navegador sem entregar o
 * token junto.
 */

export const GET = handler(
  {
    params: midiaIdParamSchema,
    query: conversaIdQuerySchema,
    requerModulo: "financeiro",
  },
  controller.obterMidia,
);
