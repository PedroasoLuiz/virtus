import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { idParamSchema } from "@/modules/tickets/tickets.schema";

/**
 * Cancela o ticket.
 *
 * ⚠️ Rota propria, e nao um campo do PATCH. Cancelar solta as origens — as
 * tarefas voltam a poder ser cobradas e o vinculo com o projeto sai — e isso
 * nao pode ficar a um campo de distancia de corrigir um titulo.
 *
 * ⚠️ E vale em ticket FATURADO, desde que a conta nao tenha baixa. Ver o
 * servico: com dinheiro ja recebido, cancelar deixaria um pagamento apontando
 * para uma cobranca que o sistema passou a dizer que nao existe.
 */
export const POST = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.cancelarTicket,
);
