import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import {
  idParamSchema,
  observacoesBodySchema,
} from "@/modules/faturas/faturas.schema";

/**
 * As observacoes da conta a receber.
 *
 * ⚠️ Rota propria, e nao um update da conta inteira. O texto se corrige a
 * qualquer momento; competencia, tickets e parcelamento nao — eles ja geraram
 * parcela, baixa e documento. Com um endpoint unico, corrigir uma frase ficaria
 * a um campo de distancia de reescrever o acordo.
 *
 * ⚠️ E vale em conta cancelada ou baixada. Conta encerrada e a que mais precisa
 * de explicacao para quem for ler depois: o dinheiro esta fechado, a memoria
 * nao.
 */
export const PUT = handler(
  {
    body: observacoesBodySchema,
    params: idParamSchema,
    requerModulo: "financeiro",
  },
  controller.definirObservacoes,
);
