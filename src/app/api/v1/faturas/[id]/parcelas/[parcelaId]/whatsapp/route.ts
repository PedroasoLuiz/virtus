import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import {
  enviarParcelaWhatsappBodySchema,
  parcelaParamSchema,
} from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/parcelas/:parcelaId/whatsapp
 *
 * Manda a cobrança pelo WhatsApp, com o modelo aprovado na Meta. Rota própria e
 * não um parâmetro do `enviar`: o e-mail exige nota ou boleto anexados, este
 * não, e as duas regras num endpoint só ficariam decidindo por `if`.
 */

export const POST = handler(
  {
    body: enviarParcelaWhatsappBodySchema,
    params: parcelaParamSchema,
    requerModulo: "financeiro",
  },
  controller.enviarParcelaPorWhatsapp,
);
