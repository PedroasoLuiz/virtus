import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/atendimento/personas.controller";
import { personaParamSchema } from "@/modules/atendimento/personas.schema";

/** /api/v1/atendimento/personas/:id */

export const DELETE = handler(
  { params: personaParamSchema, requerModulo: "financeiro" },
  controller.excluir,
);
