import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/conciliacao/conciliacao.controller";
import { contaParamSchema, loteBodySchema } from "@/modules/conciliacao/conciliacao.schema";

/**
 * Grava de uma vez os pares que a pessoa conferiu na tela.
 *
 * ⚠️ Recebe os PARES, e nao um "aceite tudo que casou". Ver `conciliarVarios`:
 * a tela marca, a pessoa desmarca o que nao serve, e o servidor grava so o que
 * ela afirmou — conferindo cada par contra o banco antes.
 */
export const POST = handler(
  { params: contaParamSchema, body: loteBodySchema, requerModulo: "financeiro" },
  controller.conciliarVarios,
);
