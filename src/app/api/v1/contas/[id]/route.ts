import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas/contas.controller";
import { contaBodySchema, idParamSchema } from "@/modules/contas/contas.schema";

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.obter,
);

export const PUT = handler(
  { body: contaBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.atualizar,
);

/**
 * Só apaga conta que nunca recebeu lançamento. As demais se desativam: apagar
 * levaria junto o "onde" de todo dinheiro que passou por ela.
 */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.excluir,
);
