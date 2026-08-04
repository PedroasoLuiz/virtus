import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/recebimentos/recebimentos.controller";
import { idParamSchema } from "@/modules/recebimentos/recebimentos.schema";

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.obter,
);

/**
 * Estorno: desfaz a baixa e apaga o lançamento.
 *
 * DELETE e não um POST em `/estornar` porque é isto que acontece: a linha deixa
 * de existir. Estorno que gera contralançamento faz sentido quando o original já
 * foi conferido no extrato, e nesse caso a rota recusa em vez de apagar.
 */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.estornar,
);
