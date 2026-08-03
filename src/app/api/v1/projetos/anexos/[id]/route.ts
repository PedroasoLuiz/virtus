import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/anexos/:id */

export const DELETE = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.excluirAnexo,
);
