import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/ia/ia.controller";
import { provedorParamSchema } from "@/modules/ia/ia.schema";

/** /api/v1/ia/provedores/:provedor */

export const DELETE = handler(
  { params: provedorParamSchema, requerModulo: "financeiro" },
  controller.remover,
);
