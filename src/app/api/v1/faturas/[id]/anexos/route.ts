import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { idParamSchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/anexos — documentos da conta inteira.
 *
 * Nota e boleto ficam na PARCELA; aqui vai o resto: contrato, ordem de compra,
 * comprovante. `multipart/form-data` no campo `arquivo`.
 */

export const POST = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.anexarNaConta,
);
