import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/cadastros/cadastros.controller";
import { atualizarServicoBodySchema, idParamSchema } from "@/modules/cadastros/cadastros.schema";

/** /api/v1/servicos/:id */

export const PATCH = handler(
  { body: atualizarServicoBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.atualizarServico,
);

export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.excluirServico,
);
