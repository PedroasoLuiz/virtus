import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { lancamentoParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * Cancela uma compra do ciclo — POST cancela, DELETE reativa.
 *
 * ⚠️ Diferente de remover, e os dois existem de proposito. Remover e para o que
 * foi lancado ERRADO; cancelar e para o que aconteceu e foi desfeito (estorno,
 * compra negada). A linha cancelada fica na fatura, riscada, e para de somar —
 * e e ela que explica depois por que o mes fechou abaixo da soma das notas.
 */
export const POST = handler(
  { params: lancamentoParamSchema, requerModulo: "financeiro" },
  controller.cancelarLancamentoDaFatura,
);

export const DELETE = handler(
  { params: lancamentoParamSchema, requerModulo: "financeiro" },
  controller.reativarLancamentoDaFatura,
);
