import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { idParamSchema } from "@/modules/projetos/projetos.schema";

/**
 * /api/v1/projetos/:id/cobranca/disponiveis — tickets que podem ser vinculados.
 *
 * Já filtrados pelo cliente do projeto: a lista inteira da empresa faria
 * procurar o ticket certo no meio de dezenas que nunca poderiam entrar.
 */

export const GET = handler(
  { params: idParamSchema, requerModulo: "os" },
  controller.ticketsDisponiveis,
);
