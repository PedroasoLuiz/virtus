import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import {
  cancelarParcelaBodySchema,
  parcelaParamSchema,
} from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/parcelas/:parcelaId/cancelamento
 *
 * Espelho da rota do lado que paga: POST cancela a parcela, DELETE desfaz. Ela
 * foi combinada, mas nao vai mais ser cobrada, e continua na conta como
 * historico do contrato.
 */
export const POST = handler(
  { body: cancelarParcelaBodySchema, params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.cancelarParcela,
);

export const DELETE = handler(
  { params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.reativarParcela,
);
