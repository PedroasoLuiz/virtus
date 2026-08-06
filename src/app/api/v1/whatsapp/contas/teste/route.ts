import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { testarContaBodySchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/contas/teste — pergunta a Meta se as credenciais servem.
 *
 * ⚠️ POST porque o token vai no CORPO. Em query string ele entraria em log de
 * acesso, de proxy e de erro, que e exatamente de onde ele nao pode sair.
 *
 * ⚠️ E uma LEITURA na Meta (`GET /{phone_number_id}`), nao um envio: testar
 * mandando mensagem faria cada cadastro escrever para alguem de verdade.
 */

export const POST = handler(
  { body: testarContaBodySchema, requerModulo: "financeiro" },
  controller.testarConta,
);
