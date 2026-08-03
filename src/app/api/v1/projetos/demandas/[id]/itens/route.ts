import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { idParamSchema, itemBodySchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/demandas/:id/itens — checklist da tarefa. */

export const POST = handler(
  { body: itemBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.criarItem,
);
