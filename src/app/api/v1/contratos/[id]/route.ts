import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contratos/contratos.controller";
import { atualizarContratoBodySchema, idParamSchema } from "@/modules/contratos/contratos.schema";

/** /api/v1/contratos/:id */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.obterContrato,
);

export const PATCH = handler(
  { body: atualizarContratoBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.atualizarContrato,
);
