import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { ticketParamSchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/tickets/:ticketId — tira o ticket da conta.
 *
 * O ticket continua existindo; o que sai é o vínculo, e com ele o saldo volta a
 * ficar disponível. Se era o único, a conta inteira é apagada: conta sem origem
 * não cobra nada.
 */

export const DELETE = handler(
  { params: ticketParamSchema, requerModulo: "financeiro" },
  controller.desvincularTicket,
);
