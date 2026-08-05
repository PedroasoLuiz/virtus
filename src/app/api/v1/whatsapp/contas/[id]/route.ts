import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import {
  ativarContaBodySchema,
  conversaIdParamSchema,
} from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/contas/{id} — liga e desliga um numero.
 *
 * Nao existe DELETE de proposito: `whatsappconversas.fkConta` aponta para aqui,
 * e apagar levaria o historico de conversa junto. Numero desligado some do
 * seletor e para de aceitar envio; o que ja foi dito continua legivel.
 */

export const PUT = handler(
  {
    body: ativarContaBodySchema,
    params: conversaIdParamSchema,
    requerModulo: "financeiro",
  },
  controller.ativarConta,
);
