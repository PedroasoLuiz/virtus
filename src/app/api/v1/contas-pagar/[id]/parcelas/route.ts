import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  idParamSchema,
  redefinirParcelasBodySchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/:id/parcelas — o cronograma inteiro.
 *
 * PUT e não PATCH: chega o parcelamento como ele deve ficar. Mandar "mudei a
 * parcela 3" obrigaria o servidor a recompor o conjunto a partir de um estado
 * que ele não viu, e duas edições simultâneas se sobrescreveriam sem ninguém
 * notar.
 *
 * ⚠️ Aqui o TOTAL não muda: o que muda é como ele se reparte. Mexer no valor da
 * conta é outro caminho, em /lancamentos, e ele só vale antes do primeiro
 * pagamento.
 */
export const PUT = handler(
  {
    body: redefinirParcelasBodySchema,
    params: idParamSchema,
    requerModulo: "financeiro",
  },
  controller.redefinirParcelas,
);
