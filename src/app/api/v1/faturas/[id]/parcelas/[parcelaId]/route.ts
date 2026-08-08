import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { parcelaParamSchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/parcelas/:parcelaId
 *
 * ⚠️ NAO ha mais PATCH de vencimento aqui. Mudar a data de uma parcela virou um
 * caso do editor de parcelamento (`PUT /faturas/:id/parcelas`), que ja mexe em
 * data, valor e quantidade na mesma tela e com a mesma regra. Dois caminhos para
 * a mesma mudanca sao duas regras para manter iguais, e elas divergem.
 */
export const DELETE = handler(
  { params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.excluirParcela,
);
