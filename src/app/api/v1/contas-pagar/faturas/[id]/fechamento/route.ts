import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { idParamSchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/faturas/:id/fechamento — fecha a fatura e gera a conta a
 * pagar que a representa.
 *
 * ⚠️ Fechar é MANUAL, e não uma rotina que roda na data de fechamento. A fatura
 * ainda recebe lançamento atrasado depois dela — a nota chega depois —, e uma
 * rotina automática trancaria o ciclo no meio do trabalho de quem estava
 * digitando. Quem fecha decide que acabou.
 *
 * ⚠️ `idempotente`: gera dívida. A resposta perdida faria um segundo clique
 * criar outra conta a pagar para a mesma fatura. O serviço também recusa fatura
 * já fechada, então são duas guardas para o mesmo acidente.
 */
export const POST = handler(
  { params: idParamSchema, requerModulo: "financeiro", idempotente: true },
  controller.fecharFatura,
);
