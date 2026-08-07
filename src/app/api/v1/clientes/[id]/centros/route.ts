import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { definirCentrosBodySchema, idParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/centros — em que centros esta pessoa entra.
 *
 * ⚠️ Diferente do `centroCustoId` de `clientes`, que e o PADRAO da pessoa. Este e
 * a lista do que ela pode usar: uma construtora que atende tres obras aparece nas
 * tres, e o padrao so decide qual vem preenchido.
 */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.listarCentrosDaPessoa,
);

export const PUT = handler(
  { body: definirCentrosBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.definirCentrosDaPessoa,
);
