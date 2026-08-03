import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { enviarParcelaBodySchema, parcelaParamSchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/parcelas/:parcelaId/enviar
 *
 * Manda a parcela ao cliente com nota fiscal e boleto ANEXADOS. Link não serve:
 * o bucket é privado e a URL assinada vive uma hora — inútil num e-mail que será
 * aberto amanhã.
 */

export const POST = handler(
  { body: enviarParcelaBodySchema, params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.enviarParcela,
);
