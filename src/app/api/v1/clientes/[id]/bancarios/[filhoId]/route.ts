import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { filhoIdParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/bancarios/{filhoId}
 *
 * ⚠️ O DELETE apenas DESATIVA. A conta que saiu do cadastro e a que consta num
 * pagamento ja feito: apagando, "para onde este dinheiro foi" fica sem resposta.
 */

export const DELETE = handler(
  { params: filhoIdParamSchema, requerModulo: "financeiro" },
  controller.excluirBancario,
);
