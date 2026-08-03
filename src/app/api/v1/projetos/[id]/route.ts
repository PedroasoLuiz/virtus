import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { atualizarProjetoBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/:id */

export const GET = handler({ params: idParamSchema, requerModulo: "os" }, controller.obterProjeto);

export const PATCH = handler(
  { body: atualizarProjetoBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.atualizarProjeto,
);

export const DELETE = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.excluirProjeto,
);
