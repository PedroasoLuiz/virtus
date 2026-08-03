import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/cadastros/cadastros.controller";
import { criarCentroBodySchema } from "@/modules/cadastros/cadastros.schema";

/** /api/v1/centro-custo */

export const GET = handler({ requerModulo: "financeiro" }, controller.listarCentros);

export const POST = handler(
  { body: criarCentroBodySchema, requerModulo: "financeiro" },
  controller.criarCentro,
);
