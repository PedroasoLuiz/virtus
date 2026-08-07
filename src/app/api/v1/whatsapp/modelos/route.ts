import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { contaIdQuerySchema, criarModeloBodySchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/modelos — modelos aprovados da conta.
 *
 * Lidos da Meta a cada chamada, sem copia local: o status muda no painel dela
 * (editar um modelo o tira de APPROVED), e uma copia nossa ficaria oferecendo
 * modelo que ja nao pode ser enviado. Foi o que aconteceu com o `cobranca`.
 */

export const GET = handler(
  { query: contaIdQuerySchema, requerModulo: "financeiro" },
  controller.listarModelos,
);

/**
 * Cria no catalogo da Meta o modelo sugerido de uma finalidade.
 *
 * ⚠️ Escreve na conta da EMPRESA, la fora, e o que ela cria fica sujeito a
 * revisao e conta contra o teto de modelos da WABA. Por isso passa pela mesma
 * sessao e pelo mesmo modulo do resto, e nao e uma rota aberta.
 */
export const POST = handler(
  { body: criarModeloBodySchema, requerModulo: "financeiro" },
  controller.criarModelo,
);
