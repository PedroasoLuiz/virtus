import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { idParamSchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/cancelamento — a conta deixa de ser cobrável.
 *
 * Rota própria e não um status, porque `cancelada` é coluna separada no banco: a
 * conta guarda o status em que estava quando foi cancelada, e isso importa para
 * saber se ela chegou a ser emitida.
 *
 * Existe porque a falta dela custava caro: sem cancelamento, a saída para uma
 * conta que não seria recebida era dar baixa com valor zero, o que deixa no
 * extrato um lançamento de R$ 0,00 e marca como recebido um dinheiro que nunca
 * entrou.
 */
export const PUT = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.cancelar,
);
