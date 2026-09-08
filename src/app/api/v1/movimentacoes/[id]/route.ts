import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/movimentacoes/movimentacoes.controller";
import { movimentacaoParamSchema } from "@/modules/movimentacoes/movimentacoes.schema";

/**
 * Desfaz a transferencia inteira.
 *
 * ⚠️ O `id` e o uuid que as DUAS pontas dividem, e nao o id de um lancamento. E
 * ele que garante que as duas saem juntas: um par pela metade e pior que par
 * nenhum, porque o saldo de uma das contas passa a mentir sem nada acusar.
 */
export const DELETE = handler(
  { params: movimentacaoParamSchema, requerModulo: "financeiro" },
  controller.excluir,
);
