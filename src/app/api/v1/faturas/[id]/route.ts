import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { idParamSchema } from "@/modules/faturas/faturas.schema";

/** /api/v1/faturas/:id */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.obter,
);

/** Apagar so antes de qualquer baixa; depois disso, cancela-se. */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.excluirConta,
);
