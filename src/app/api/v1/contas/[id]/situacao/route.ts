import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas/contas.controller";
import { idParamSchema, situacaoBodySchema } from "@/modules/contas/contas.schema";

/**
 * Liga e desliga a conta.
 *
 * ⚠️ Rota propria, e nao o PUT do cadastro. Quem chama e a listagem, que carrega
 * so o que a tabela mostra; o PUT grava o cadastro inteiro e completa o que
 * falta com os `default` do schema — saldo de partida em zero, cartao desligado,
 * taxas nulas. Um clique no interruptor apagaria tudo isso em silencio.
 */
export const PUT = handler(
  { body: situacaoBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.definirSituacao,
);
