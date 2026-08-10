import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { idParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/:id/anexos — documentos da conta.
 *
 * A nota e o boleto da PARCELA continuam em `contaspagarparcelas`; aqui vai o
 * resto: contrato, ordem de compra, comprovante. `multipart/form-data` no campo
 * `arquivo`.
 */

export const POST = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.anexar,
);
