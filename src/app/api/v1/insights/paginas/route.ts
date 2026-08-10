import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";
import { ligarPaginasBodySchema } from "@/modules/insights/insights.schema";

/** /api/v1/insights/paginas — as Paginas ligadas, com o Instagram de cada uma. */
export const GET = handler({ requerModulo: "financeiro" }, controller.listarPaginas);

export const POST = handler(
  { body: ligarPaginasBodySchema, requerModulo: "financeiro" },
  controller.ligarPaginas,
);
