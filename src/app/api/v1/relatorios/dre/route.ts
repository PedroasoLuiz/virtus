import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/dre/dre.controller";
import { dreQuerySchema } from "@/modules/dre/dre.schema";

/** /api/v1/relatorios/dre?ano=2026 */
export const GET = handler(
  { query: dreQuerySchema, requerModulo: "financeiro" },
  controller.dre,
);
