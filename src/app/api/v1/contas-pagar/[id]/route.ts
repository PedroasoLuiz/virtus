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
/**
 * ⚠️ Apaga de verdade, e o servico recusa quando ja ha parcela paga.
 *
 * O pagamento e dinheiro que saiu do banco: apagar a conta deixaria a baixa
 * apontando para uma divida que ninguem mais explica, e a conciliacao do extrato
 * com uma linha sem par. Conta que ja recebeu dinheiro se CANCELA.
 */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.excluirConta,
);

export const PATCH = handler(
  { body: atualizarContaBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.atualizar,
);
