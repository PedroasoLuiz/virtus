import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { contagemQuerySchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/contagem — quantas pessoas ha em cada papel.
 *
 * ⚠️ Separado da listagem porque muda em ritmo DIFERENTE. A lista se refaz a
 * cada tecla da busca, a cada pagina e a cada troca de ordem; a contagem so
 * depende de incluir ou nao os inativos. Junto, ela seria recontada dezenas de
 * vezes por minuto para dar sempre o mesmo numero.
 */

export const GET = handler(
  { query: contagemQuerySchema, requerModulo: "financeiro" },
  controller.contagem,
);
