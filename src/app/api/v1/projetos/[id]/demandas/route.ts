import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { criarDemandaBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/:id/demandas */

export const POST = handler(
  { body: criarDemandaBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.criarDemanda,
);
