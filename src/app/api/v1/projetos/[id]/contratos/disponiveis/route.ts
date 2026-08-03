import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/:id/contratos/disponiveis — os que ainda podem cobrir o projeto. */

export const GET = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.contratosDisponiveis,
);
