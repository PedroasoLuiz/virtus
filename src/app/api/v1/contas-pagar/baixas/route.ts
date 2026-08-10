import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { criarBaixaBodySchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/baixas — o dinheiro que saiu.
 *
 * Não fica pendurada numa conta de propósito: um pagamento pode cobrir parcelas
 * de várias contas, e uma rota `/contas-pagar/:id/...` obrigaria a partir o PIX
 * em tantos lançamentos quantas fossem as contas. O extrato do banco mostra um
 * só. Mesma decisão da rota de recebimentos.
 */

/*
 * ⚠️ `idempotente`: esta rota mexe em dinheiro.
 *
 * O caso real não é o duplo clique — a tela trava o botão —, e sim a resposta
 * que se perde depois de a baixa já ter sido gravada: quem clica de novo estaria
 * criando um segundo pagamento sobre as mesmas parcelas, e o extrato mostraria
 * duas saídas onde houve uma.
 */
export const POST = handler(
  { body: criarBaixaBodySchema, requerModulo: "financeiro", idempotente: true },
  controller.criarBaixa,
);
