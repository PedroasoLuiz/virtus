import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { parcelaParamSchema } from "@/modules/faturas/faturas.schema";

/** /api/v1/faturas/:id/parcelas/:parcelaId */

export const DELETE = handler(
  { params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.excluirParcela,
);
