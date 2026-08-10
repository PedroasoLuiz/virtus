import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { idParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/baixas/:id — um dinheiro que saiu, e o que ele quitou.
 *
 * Nao fica pendurada numa conta de proposito: um pagamento pode cobrir parcelas
 * de varias contas, e uma rota `/contas-pagar/:id/...` obrigaria a partir o PIX
 * em tantos lancamentos quantas fossem as contas. O extrato do banco mostra um
 * so. Mesma decisao da rota de recebimentos.
 */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.obterBaixa,
);
