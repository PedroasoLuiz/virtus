import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { anexoBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/demandas/:id/anexos */

export const POST = handler(
  { body: anexoBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.anexar,
);
