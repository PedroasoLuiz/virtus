import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";

/**
 * /api/v1/whatsapp/webhook — chamado pela Meta, nunca pelo aplicativo.
 *
 * `auth: false` porque quem chama nao tem sessao. A autenticacao existe, so nao
 * e a nossa: o GET responde ao handshake com o verify token, e o POST confere a
 * assinatura HMAC do corpo com o App Secret antes de olhar o conteudo.
 *
 * Sem `body` schema de proposito: o controller precisa do corpo CRU para
 * conferir o HMAC, e o `handler` so consome o corpo quando ha schema.
 */

export const GET = handler({ auth: false }, controller.verificarWebhook);

export const POST = handler({ auth: false }, controller.receberWebhook);
