import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { alternarItemBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/** /api/v1/projetos/itens/:id — um item do checklist. */

export const PATCH = handler(
  { body: alternarItemBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.alternarItem,
);

export const DELETE = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.excluirItem,
);
