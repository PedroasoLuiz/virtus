import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { conversaIdParamSchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/conversas/{id} — detalhes do contato.
 *
 * Separado de `/mensagens` porque abrir a conversa MARCA COMO LIDA, e consultar
 * os cadastros ligados ao telefone nao pode ter esse efeito: seria um clique em
 * "detalhes" zerando um contador que ninguem leu.
 */

export const GET = handler(
  { params: conversaIdParamSchema, requerModulo: "financeiro" },
  controller.detalhar,
);
