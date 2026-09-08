import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  compraNoCartaoBodySchema,
  idParamSchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/cartoes/:id/compras — lanca uma compra NO cartao.
 *
 * ⚠️ A compra do cartao nao passa por conta a pagar. A linha da fatura ja e a
 * despesa: ela carrega fornecedor, descricao, data, valor e centro de custo, e e
 * assim que a DRE a le — pela competencia do ciclo e pelo centro da linha.
 *
 * O ciclo e escolhido pelo servico a partir do dia de fechamento do cartao, e
 * uma compra parcelada cai numa fatura por parcela.
 */
export const POST = handler(
  {
    body: compraNoCartaoBodySchema,
    params: idParamSchema,
    requerModulo: "financeiro",
  },
  controller.lancarCompraNoCartao,
);
