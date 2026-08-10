import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { parcelasAPagarQuerySchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/parcelas-abertas?fornecedorId= — o que a empresa deve a
 * um fornecedor, de todas as contas dele.
 *
 * ⚠️ Por FORNECEDOR e não por conta: um pagamento cobre parcelas de várias
 * contas do mesmo recebedor, e pedir conta a conta faria a tela montar a
 * carteira somando respostas.
 */
export const GET = handler(
  { query: parcelasAPagarQuerySchema, requerModulo: "financeiro" },
  controller.parcelasAPagar,
);
