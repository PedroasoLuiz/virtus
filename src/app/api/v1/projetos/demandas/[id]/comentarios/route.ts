import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { comentarioBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/demandas/:id/comentarios */

export const POST = handler(
  { body: comentarioBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.comentar,
);
