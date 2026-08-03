import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contratos/contratos.controller";
import { criarContratoBodySchema } from "@/modules/contratos/contratos.schema";

/** /api/v1/contratos */

export const POST = handler(
  { body: criarContratoBodySchema, requerModulo: "financeiro" },
  controller.criarContrato,
);
