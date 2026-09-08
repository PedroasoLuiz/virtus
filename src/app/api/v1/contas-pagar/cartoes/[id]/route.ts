import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  cartaoAtivoBodySchema,
  idParamSchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/** /api/v1/contas-pagar/cartoes/:id */

/**
 * Muda o cartao: liga/desliga, e escolhe quem recebe o pagamento da fatura.
 *
 * ⚠️ Chega so o que MUDOU. O interruptor da lista manda `ativo`; o seletor de
 * fornecedor manda `fornecedorId`. Mandar o cadastro inteiro faria um gesto de
 * um campo carregar tudo o mais que estivesse na tela.
 *
 * ⚠️ O FORNECEDOR importa: e ele que vira o credor da conta a pagar quando o
 * ciclo fecha. Sem ele, o fechamento recusa — antes o sistema inventava um
 * cliente com o nome do banco, e a conta nascia no nome de um cadastro que
 * ninguem reconhecia.
 */
export const PATCH = handler(
  {
    body: cartaoAtivoBodySchema,
    params: idParamSchema,
    requerModulo: "financeiro",
  },
  controller.atualizarCartao,
);

/**
 * ⚠️ So o cartao que nunca teve fatura. Com fatura, as compras ja contaram na
 * DRE e o historico ficaria sem dono — nesse caso o caminho e inativar.
 */
export const DELETE = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.excluirCartao,
);
