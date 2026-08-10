import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";
import {
  atualizarConexaoBodySchema,
  idParamSchema,
} from "@/modules/insights/insights.schema";

/**
 * /api/v1/insights/conexoes/:id — apelido, cliente e situacao.
 *
 * ⚠️ Nao ha DELETE, e e decisao. Desativar guarda de quem eram aquelas metricas;
 * apagar perde o vinculo com o cliente e nao ha como reconstrui-lo depois.
 *
 * ⚠️ E nao ha caminho para trocar token aqui. Isso e o POST da colecao, que
 * chama a funcao do banco com acesso ao vault.
 */
export const PATCH = handler(
  {
    body: atualizarConexaoBodySchema,
    params: idParamSchema,
    requerModulo: "financeiro",
  },
  controller.atualizar,
);
