import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import {
  dividirParcelaBodySchema,
  idParamSchema,
  redefinirParcelasBodySchema,
} from "@/modules/faturas/faturas.schema";

/** /api/v1/faturas/:id/parcelas */

/**
 * O PUT grava o cronograma INTEIRO, do jeito que a tela desenhou.
 *
 * ⚠️ Substitui o POST como caminho principal. Dividir uma parcela ao meio resolve
 * um caso; quem vendeu 10.000 e combinou 2.000 num dia, 1.200 no outro e o resto
 * depois precisa digitar o cronograma, e nao chegar nele por divisoes sucessivas.
 */
export const PUT = handler(
  { params: idParamSchema, body: redefinirParcelasBodySchema, requerModulo: "financeiro" },
  controller.redefinirParcelas,
);

export const POST = handler(
  { params: idParamSchema, body: dividirParcelaBodySchema, requerModulo: "financeiro" },
  controller.adicionarParcela,
);
