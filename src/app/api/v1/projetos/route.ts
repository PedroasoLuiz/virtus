import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { criarProjetoBodySchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos */

export const POST = handler(
  { body: criarProjetoBodySchema, requerModulo: "os" },
  controller.criarProjeto,
);
