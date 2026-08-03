import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { criarClienteBodySchema, listarQuerySchema } from "@/modules/clientes/clientes.schema";

/** /api/v1/clientes */

export const GET = handler(
  { query: listarQuerySchema, requerModulo: "financeiro" },
  controller.listar,
);

export const POST = handler(
  { body: criarClienteBodySchema, requerModulo: "financeiro" },
  controller.criar,
);
