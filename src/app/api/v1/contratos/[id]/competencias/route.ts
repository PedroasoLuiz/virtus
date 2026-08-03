import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contratos/contratos.controller";
import { idParamSchema } from "@/modules/contratos/contratos.schema";

/** /api/v1/contratos/:id/competencias — o botão "gerar competência". */

export const POST = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.gerarCompetencia,
);
