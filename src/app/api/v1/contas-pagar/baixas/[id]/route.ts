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

/**
 * Estornar: o dinheiro nao saiu, e as parcelas voltam a ficar em aberto.
 *
 * ⚠️ DELETE, e nao um PATCH de "estornada". A baixa nao vira um registro
 * cancelado que fica na lista: ela deixa de existir, e o que existe de novo sao
 * as parcelas em aberto. Um pagamento estornado que continuasse na listagem
 * apareceria somando zero no total de baixas do mes, sem dizer por que.
 */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.estornarBaixa,
);
