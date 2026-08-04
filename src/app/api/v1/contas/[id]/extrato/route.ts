import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas/contas.controller";
import { extratoQuerySchema, idParamSchema } from "@/modules/contas/contas.schema";

/**
 * /api/v1/contas/:id/extrato?de=&ate= — o que passou por esta conta.
 *
 * Aninhado na conta e não uma rota solta: extrato sem conta escolhida é uma
 * pergunta pela metade, e o saldo de abertura só existe em relação a uma delas.
 */

export const GET = handler(
  { query: extratoQuerySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.extrato,
);
