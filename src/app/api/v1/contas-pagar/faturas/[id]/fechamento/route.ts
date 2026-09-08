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

/**
 * Reabre a fatura.
 *
 * ⚠️ Apaga a conta a pagar que o fechamento gerou, e por isso recusa quando ela
 * ja tem parcela paga: dinheiro que saiu do banco nao volta porque alguem
 * reabriu um ciclo. Quem barra e o proprio `excluirConta`.
 *
 * Para nota que chegou atrasada o caminho costuma ser outro: lancar no ciclo
 * SEGUINTE com a data real. A despesa entra atrasada, que e a verdade, e nada do
 * que ja fechou se mexe. Reabrir e para quem fechou sem querer.
 */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.reabrirFatura,
);
