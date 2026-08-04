import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/recebimentos/recebimentos.controller";
import { parcelasAbertasQuerySchema } from "@/modules/recebimentos/recebimentos.schema";

/**
 * /api/v1/recebimentos/parcelas-abertas?clienteId= — o que este cliente deve.
 *
 * Atravessa todas as contas dele, porque é assim que o dinheiro chega: o cliente
 * paga o que combinou, não o que está numa conta específica.
 */

export const GET = handler(
  { query: parcelasAbertasQuerySchema, requerModulo: "financeiro" },
  controller.parcelasEmAberto,
);
