import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { idParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/** /api/v1/contas-pagar/faturas/:id/lancamentos — as compras do ciclo. */
export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.lancamentosDaFatura,
);
