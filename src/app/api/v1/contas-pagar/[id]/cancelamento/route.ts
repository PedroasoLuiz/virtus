import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { idParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/:id/cancelamento
 *
 * POST cancela a conta inteira: ela foi lancada, mas a divida deixou de valer, e
 * para de ser cobrada sem sair da tela. DELETE desfaz.
 *
 * ⚠️ Caminho proprio, e nao um campo no PATCH da conta — mesma razao do
 * cancelamento da parcela. Cancelar tem regra de quem pode (com baixa, nao) e e
 * um gesto por si: como campo, viajaria junto de uma edicao de observacao e
 * passaria despercebido no dia em que alguem mandasse o objeto inteiro de volta.
 *
 * ⚠️ E cancelar a CONTA nao e a soma de cancelar cada parcela. Ate aqui a unica
 * saida era ir de uma em uma, e a conta continuava viva no meio delas.
 */
export const POST = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.cancelarConta,
);

export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.reativarConta,
);
