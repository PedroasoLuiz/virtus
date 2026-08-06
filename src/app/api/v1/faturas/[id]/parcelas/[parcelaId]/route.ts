import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import {
  alterarVencimentoBodySchema,
  parcelaParamSchema,
} from "@/modules/faturas/faturas.schema";

/** /api/v1/faturas/:id/parcelas/:parcelaId */

export const DELETE = handler(
  { params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.excluirParcela,
);

/** Muda so o vencimento. Valor e numero da parcela seguem por outro caminho. */
export const PATCH = handler(
  {
    body: alterarVencimentoBodySchema,
    params: parcelaParamSchema,
    requerModulo: "financeiro",
  },
  controller.alterarVencimento,
);
