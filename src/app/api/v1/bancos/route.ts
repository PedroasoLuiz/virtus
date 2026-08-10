import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";

/**
 * /api/v1/bancos — a lista de bancos.
 *
 * ⚠️ Fora de `/contas-pagar` de propósito: banco não pertence ao contas a pagar.
 * A conta bancária e o cartão usam a mesma lista, e uma rota aninhada obrigaria
 * o cadastro de conta a pedir bancos por um endereço que fala de despesa.
 *
 * ⚠️ Devolve os do SISTEMA mais os da empresa. Quem recorta é a policy, e não
 * um filtro aqui.
 */
export const GET = handler({ requerModulo: "financeiro" }, controller.bancos);
