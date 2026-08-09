import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/conciliacao/conciliacao.controller";
import {
  conciliarBodySchema,
  contaParamSchema,
  periodoQuerySchema,
} from "@/modules/conciliacao/conciliacao.schema";

/**
 * /api/v1/contas/:id/conciliacao — o que o banco diz contra o que foi lancado.
 *
 * Pendurado na CONTA porque conciliacao sem conta e uma pergunta pela metade: as
 * duas listas que ela compara sao as daquela conta, e o vinculo so faz sentido
 * dentro dela.
 */

export const GET = handler(
  { params: contaParamSchema, query: periodoQuerySchema, requerModulo: "financeiro" },
  controller.painel,
);

export const POST = handler(
  { params: contaParamSchema, body: conciliarBodySchema, requerModulo: "financeiro" },
  controller.conciliar,
);
