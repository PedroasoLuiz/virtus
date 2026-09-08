import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/relatorios/relatorios.controller";
import { relatorioQuerySchema } from "@/modules/relatorios/relatorios.schema";

/** /api/v1/relatorios/parcelas?lado=receber&de=2026-09-01&ate=2026-09-30 */
export const GET = handler(
  { query: relatorioQuerySchema, requerModulo: "financeiro" },
  controller.parcelas,
);
