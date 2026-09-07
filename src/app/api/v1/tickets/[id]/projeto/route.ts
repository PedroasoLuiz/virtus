import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import {
  idParamSchema,
  projetoDoTicketBodySchema,
} from "@/modules/tickets/tickets.schema";

/**
 * A obra do ticket.
 *
 * ⚠️ Rota propria, e nao um campo do PATCH do ticket. O PATCH recusa ticket
 * encerrado — valor, cliente e servicos ja viraram cobranca paga e nao podem
 * mudar por baixo de quem recebeu o documento. A obra nao e nada disso: e
 * classificacao, nao sai em documento e nao entra na DRE.
 *
 * E e o ticket antigo, ja recebido, o que mais precisa dela: fechado antes de
 * existirem projetos, ficaria sem obra para sempre.
 */
export const PUT = handler(
  {
    body: projetoDoTicketBodySchema,
    params: idParamSchema,
    requerModulo: "os",
  },
  controller.definirProjetoDoTicket,
);
