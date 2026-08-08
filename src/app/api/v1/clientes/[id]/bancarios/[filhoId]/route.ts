import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import {
  atualizarBancarioBodySchema,
  filhoIdParamSchema,
} from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/bancarios/{filhoId}
 *
 * ⚠️ O DELETE apenas DESATIVA. A conta que saiu do cadastro e a que consta num
 * pagamento ja feito: apagando, "para onde este dinheiro foi" fica sem resposta.
 *
 * O PUT corrige a conta inteira. Ele nao mexe no `principal`: aquilo e exclusivo
 * entre as contas da pessoa, e mudar de um lado exige derrubar o outro.
 */

export const PUT = handler(
  {
    params: filhoIdParamSchema,
    body: atualizarBancarioBodySchema,
    requerModulo: "financeiro",
  },
  controller.atualizarBancario,
);

export const DELETE = handler(
  { params: filhoIdParamSchema, requerModulo: "financeiro" },
  controller.excluirBancario,
);
