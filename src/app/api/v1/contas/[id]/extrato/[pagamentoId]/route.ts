import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas/contas.controller";
import {
  conciliacaoBodySchema,
  conciliacaoParamSchema,
} from "@/modules/contas/contas.schema";

/**
 * Marca (ou desmarca) um lançamento como conferido no extrato do banco.
 *
 * PUT e não PATCH porque o corpo traz o estado inteiro do que se altera: o
 * lançamento passa a ser conciliado, ou passa a não ser. Não há atualização
 * parcial de um booleano.
 */
export const PUT = handler(
  {
    body: conciliacaoBodySchema,
    params: conciliacaoParamSchema,
    requerModulo: "financeiro",
  },
  controller.conciliar,
);
