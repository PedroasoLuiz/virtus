import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  criarContaBodySchema,
  listarQuerySchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/** /api/v1/contas-pagar — o que a empresa deve. */

export const GET = handler(
  { query: listarQuerySchema, requerModulo: "financeiro" },
  controller.listar,
);

/*
 * ⚠️ `idempotente`: esta rota cria divida.
 *
 * Mandando `Idempotency-Key`, o mesmo envio grava uma vez so. O caso real nao e
 * o duplo clique — a tela trava o botao —, e sim a resposta que se perde depois
 * de a conta ja ter sido gravada: quem clica de novo criaria a mesma divida duas
 * vezes, e as duas seriam pagas.
 */
export const POST = handler(
  { body: criarContaBodySchema, requerModulo: "financeiro", idempotente: true },
  controller.criar,
);
