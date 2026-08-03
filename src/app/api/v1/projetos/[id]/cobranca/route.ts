import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { cobrarDemandasBodySchema, idParamSchema } from "@/modules/projetos/projetos.schema";

/**
 * /api/v1/projetos/:id/cobranca — um lote de tarefas concluídas vira UM ticket.
 *
 * A rota pende do PROJETO e não da tarefa: o ticket é do projeto, e o lote
 * inteiro precisa ser do mesmo. Pendurada na tarefa, o corpo teria de carregar
 * as outras e a URL mentiria sobre o que está sendo cobrado.
 */

export const POST = handler(
  { body: cobrarDemandasBodySchema, params: idParamSchema, requerModulo: "os" },
  controller.gerarTicketDasDemandas,
);
