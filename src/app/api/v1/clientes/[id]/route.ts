import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { atualizarClienteBodySchema, idParamSchema } from "@/modules/clientes/clientes.schema";

/** /api/v1/clientes/:id */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.obter,
);

export const PATCH = handler(
  { body: atualizarClienteBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.atualizar,
);
