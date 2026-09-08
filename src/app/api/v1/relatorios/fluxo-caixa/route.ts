import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/fluxo-caixa/fluxo-caixa.controller";
import { projecaoQuerySchema } from "@/modules/fluxo-caixa/fluxo-caixa.schema";

/** /api/v1/relatorios/fluxo-caixa?ate=2027-09-30 */
export const GET = handler(
  { query: projecaoQuerySchema, requerModulo: "financeiro" },
  controller.projecao,
);
