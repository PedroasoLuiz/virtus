import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import {
  conversaIdParamSchema,
  enviarModeloBodySchema,
} from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/conversas/{id}/modelo
 *
 * Separado de `/mensagens` porque a regra e outra: texto livre EXIGE janela
 * aberta, modelo funciona dentro e fora dela. Um endpoint so precisaria de um
 * `if` no corpo para saber qual validacao aplicar.
 */

export const POST = handler(
  {
    body: enviarModeloBodySchema,
    params: conversaIdParamSchema,
    requerModulo: "financeiro",
  },
  controller.enviarModelo,
);
