import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { atualizarDemandaBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/demandas/:id */

export const PATCH = handler(
  { body: atualizarDemandaBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.atualizarDemanda,
);

export const DELETE = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.excluirDemanda,
);
