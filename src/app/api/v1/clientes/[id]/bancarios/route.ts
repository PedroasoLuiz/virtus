import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { criarBancarioBodySchema, idParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/bancarios — para onde o dinheiro vai.
 *
 * ⚠️ Nao e conta bancaria da EMPRESA. Aquelas tem saldo, limite e extrato, e
 * entram no fluxo de caixa; estas sao dado de terceiro, para preencher um
 * pagamento — e nunca para conciliar.
 */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.listarBancarios,
);

export const POST = handler(
  { body: criarBancarioBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.criarBancario,
);
