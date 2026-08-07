import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { dispararParaContatoBodySchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/conversas/nova — falar primeiro com alguem.
 *
 * ⚠️ So por MODELO. Toda conversa nascia de uma mensagem recebida, e por isso o
 * envio de texto livre podia contar com a janela de 24 horas aberta. Aqui nao ha
 * janela nenhuma: o contato nunca escreveu, e modelo aprovado e a unica coisa
 * que a Meta deixa sair nesse caso.
 *
 * Cria a conversa e manda numa chamada so. Em duas, um envio que falhasse
 * deixaria uma conversa vazia no painel a cada tentativa.
 */

export const POST = handler(
  { body: dispararParaContatoBodySchema, requerModulo: "financeiro" },
  controller.dispararParaContato,
);
