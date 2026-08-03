import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/cadastros/cadastros.controller";
import { atualizarCentroBodySchema, idParamSchema } from "@/modules/cadastros/cadastros.schema";

/** /api/v1/centro-custo/:id */

export const PATCH = handler(
  { body: atualizarCentroBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.atualizarCentro,
);
