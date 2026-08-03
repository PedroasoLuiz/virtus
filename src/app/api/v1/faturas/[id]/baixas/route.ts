import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { baixaBodySchema, idParamSchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/baixas — registra o recebimento.
 *
 * O corpo traz o valor POR PARCELA, e não um total que o servidor divide: um PIX
 * de 3.000 pode cobrir 1.000 de uma e 2.000 de outra, e só quem recebeu sabe.
 */

export const POST = handler(
  { body: baixaBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.registrarBaixa,
);
