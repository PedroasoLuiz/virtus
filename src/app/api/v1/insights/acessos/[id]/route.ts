import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";
import { idParamSchema, renovarAcessoBodySchema } from "@/modules/insights/insights.schema";

/**
 * /api/v1/insights/acessos/:id — renova o token.
 *
 * ⚠️ E o UNICO lugar do sistema que ainda recebe token da tela, e vale para
 * todas as contas daquele acesso de uma vez. Era isso que o modelo anterior nao
 * conseguia fazer: com uma copia do segredo por conta, renovar significava
 * repetir o gesto conta a conta.
 */
export const PATCH = handler(
  { body: renovarAcessoBodySchema, params: idParamSchema, requerModulo: "social" },
  controller.renovarAcesso,
);
