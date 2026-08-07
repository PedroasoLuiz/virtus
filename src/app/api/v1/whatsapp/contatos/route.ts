import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { contatosQuerySchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/contatos — a agenda de quem pode receber conversa nova.
 *
 * ⚠️ Por `contaId`, e nao por empresa. A resposta diz, em cada linha, se aquele
 * telefone JA tem conversa neste numero: sem isso a tela abriria uma segunda
 * conversa com quem ja estava na caixa de entrada, e o historico ficaria partido
 * em dois.
 *
 * ⚠️ A busca e do SERVIDOR. Uma base de cinco mil clientes mandaria cinco mil
 * linhas por abertura de tela para desenhar as vinte que cabem, e o filtro por
 * tecla ainda rodaria em cima disso no navegador de quem esta atendendo.
 */

export const GET = handler(
  { query: contatosQuerySchema, requerModulo: "financeiro" },
  controller.listarContatos,
);
