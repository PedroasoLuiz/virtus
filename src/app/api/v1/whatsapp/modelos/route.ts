import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { contaIdQuerySchema } from "@/modules/whatsapp/whatsapp.schema";

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
