import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/tickets/tickets.controller";
import { faturaveisQuerySchema } from "@/modules/tickets/tickets.schema";

/**
 * /api/v1/tickets/faturaveis?clienteId=1 — os que ainda têm saldo em aberto.
 *
 * Rota própria e não um filtro da listagem: a listagem é renderizada no
 * servidor e nunca precisou de GET. Esta existe para a tela de conta a receber,
 * que escolhe o cliente e precisa da lista sem recarregar a página.
 */

export const GET = handler(
  { query: faturaveisQuerySchema, requerModulo: "os" },
  controller.listarFaturaveis,
);
