import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { atualizarTicketBodySchema, idParamSchema } from "@/modules/tickets/tickets.schema";

/** /api/v1/tickets/:id */

export const GET = handler({ params: idParamSchema, requerModulo: "os" }, controller.obterTicket);

/**
 * ⚠️ Apaga de verdade, e o servico recusa quando ja ha conta a receber.
 *
 * A conta guarda o valor que saiu daqui; sumindo o ticket, a composicao dela
 * aponta para um registro que nao existe. Ticket que ja virou cobranca se
 * CANCELA — ele continua na tela, e a memoria fica.
 */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.excluirTicket,
);

export const PATCH = handler(
  { body: atualizarTicketBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.atualizarTicket,
);
