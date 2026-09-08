import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { lancamentoParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * Tira uma compra da fatura.
 *
 * ⚠️ So com a fatura ABERTA. Fechada, ela ja virou conta a pagar com um total, e
 * tirar uma linha faria a fatura somar menos do que a conta que a representa.
 */
export const DELETE = handler(
  { params: lancamentoParamSchema, requerModulo: "financeiro" },
  controller.removerLancamentoDaFatura,
);
