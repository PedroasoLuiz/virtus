import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import {
  removerVinculoQuerySchema,
  salvarVinculoBodySchema,
  vinculosQuerySchema,
} from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/vinculos — qual modelo do cliente atende cada finalidade.
 *
 * ⚠️ Sempre por `contaId`. Modelo pertence a WABA, e um vinculo por empresa
 * mandaria um numero usar o nome de modelo que so existe no outro.
 */

export const GET = handler(
  { query: vinculosQuerySchema, requerModulo: "financeiro" },
  controller.listarVinculos,
);

export const PUT = handler(
  { body: salvarVinculoBodySchema, requerModulo: "financeiro" },
  controller.salvarVinculo,
);

export const DELETE = handler(
  { query: removerVinculoQuerySchema, requerModulo: "financeiro" },
  controller.removerVinculo,
);
