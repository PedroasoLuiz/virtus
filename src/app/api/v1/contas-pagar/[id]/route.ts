import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  atualizarContaBodySchema,
  idParamSchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/** /api/v1/contas-pagar/:id */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.obter,
);

/**
 * PATCH e nao PUT: chega o que MUDOU, e nao a conta inteira.
 *
 * Hoje so a observacao passa por aqui. Valor e parcelamento tem caminhos
 * proprios porque mexem em dinheiro e tem regra de quando podem.
 */
export const PATCH = handler(
  { body: atualizarContaBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.atualizar,
);
