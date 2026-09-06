import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  cancelarParcelaBodySchema,
  parcelaParamSchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/:id/parcelas/:parcelaId/cancelamento
 *
 * POST cancela a parcela: ela foi combinada, mas nao vai mais acontecer, e para
 * de ser cobrada sem sair da conta. DELETE desfaz.
 *
 * ⚠️ Caminho proprio, e nao um campo no PATCH da conta. Cancelar tem regra de
 * quem pode (paga nao) e e um gesto por si: como campo, viajaria junto de uma
 * edicao de observacao e passaria despercebido no dia em que alguem mandasse o
 * objeto inteiro de volta.
 */
export const POST = handler(
  { body: cancelarParcelaBodySchema, params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.cancelarParcela,
);

export const DELETE = handler(
  { params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.reativarParcela,
);
