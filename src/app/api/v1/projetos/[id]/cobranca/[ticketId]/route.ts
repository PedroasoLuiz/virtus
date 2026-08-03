import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { projetoTicketParamSchema } from "@/modules/projetos/projetos.schema";

/**
 * /api/v1/projetos/:id/cobranca/:ticketId — solta o ticket do projeto.
 *
 * O ticket NÃO é apagado: o que sai é o vínculo. É o passo que destrava excluir
 * o projeto, e o único jeito de desfazer uma cobrança gerada por engano sem
 * cancelar o ticket.
 */

export const DELETE = handler(
  { params: projetoTicketParamSchema, requerModulo: "os" },
  controller.desvincularTicket,
);

/** Prende ao projeto um ticket que ja existe — o caminho de quem cobrou antes. */
export const POST = handler(
  { params: projetoTicketParamSchema, requerModulo: "os" },
  controller.vincularTicket,
);
