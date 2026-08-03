import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { anexoParamSchema } from "@/modules/faturas/faturas.schema";

/** /api/v1/faturas/:id/anexos/:anexoId */

export const GET = handler(
  { params: anexoParamSchema, requerModulo: "financeiro" },
  controller.abrirAnexo,
);

export const DELETE = handler(
  { params: anexoParamSchema, requerModulo: "financeiro" },
  controller.removerAnexoDaConta,
);
