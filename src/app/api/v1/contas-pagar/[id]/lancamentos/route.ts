import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  idParamSchema,
  substituirLancamentosBodySchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/:id/lancamentos — o que está sendo pago.
 *
 * PUT e não PATCH: substitui a lista inteira. A conta é a soma dos lançamentos,
 * e editar linha a linha obrigaria o servidor a recompor o conjunto a partir de
 * um estado que ele não viu.
 *
 * ⚠️ Só enquanto nada foi pago. Ao primeiro centavo a conta vira documento, e o
 * serviço recusa — quem já pagou, pagou contra um valor.
 */
export const PUT = handler(
  {
    body: substituirLancamentosBodySchema,
    params: idParamSchema,
    requerModulo: "financeiro",
  },
  controller.substituirLancamentos,
);
