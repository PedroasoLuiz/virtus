import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { criarFaturaBodySchema, listarQuerySchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas
 *
 * Declara metodo, schema e produto exigido. Nenhuma logica — o equivalente ao
 * `*.routes.js` de um Express.
 */

export const GET = handler(
  { query: listarQuerySchema, requerModulo: "financeiro" },
  controller.listar,
);

export const POST = handler(
  { body: criarFaturaBodySchema, requerModulo: "financeiro" },
  controller.criar,
);
