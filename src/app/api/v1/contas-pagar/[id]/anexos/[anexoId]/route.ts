import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { anexoParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/** /api/v1/contas-pagar/:id/anexos/:anexoId */

export const GET = handler(
  { params: anexoParamSchema, requerModulo: "financeiro" },
  controller.abrirAnexo,
);

export const DELETE = handler(
  { params: anexoParamSchema, requerModulo: "financeiro" },
  controller.removerAnexo,
);
