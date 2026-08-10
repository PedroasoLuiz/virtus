import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { criarCartaoBodySchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/cartoes — os cartões que a baixa pode usar.
 *
 * ⚠️ O cartão é forma de BAIXA, e não atributo da conta a pagar. Por isso a rota
 * mora aqui e não num módulo de cartões: quem pergunta é a tela de pagar.
 */
export const GET = handler({ requerModulo: "financeiro" }, controller.cartoes);

/**
 * ⚠️ O corpo NAO tem CVV, e o schema recusa número com mais de 4 dígitos.
 * Guardar CVV é proibido sem exceção, e o PAN completo exige cifragem que este
 * sistema não tem — a borda é o primeiro lugar onde isso se impede.
 */
export const POST = handler(
  { body: criarCartaoBodySchema, requerModulo: "financeiro" },
  controller.criarCartao,
);
