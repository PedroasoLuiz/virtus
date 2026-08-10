import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";
import { painelQuerySchema } from "@/modules/insights/insights.schema";

/**
 * /api/v1/insights/painel?cliente=&de=&ate= — tudo que a Meta sabe do cliente.
 *
 * ⚠️ O recorte e o CLIENTE, e nao a conta de anuncio nem a Pagina. Uma rota por
 * origem obrigaria a tela a orquestrar tres chamadas e a decidir sozinha o que
 * fazer quando uma delas falha — decisao de negocio, que mora no servico.
 *
 * ⚠️ Busca AO VIVO na Meta a cada chamada. Sem cache do Next: a resposta depende
 * do token, e um cache compartilhado serviria dado de um cliente para outro.
 */
export const GET = handler(
  { query: painelQuerySchema, requerModulo: "social" },
  controller.painel,
);
