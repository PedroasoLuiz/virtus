import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { dividirParcelaBodySchema, idParamSchema } from "@/modules/faturas/faturas.schema";

/** /api/v1/faturas/:id/parcelas */

export const POST = handler(
  { params: idParamSchema, body: dividirParcelaBodySchema, requerModulo: "financeiro" },
  controller.adicionarParcela,
);
