import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import { faturasQuerySchema } from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/faturas — os ciclos de cartão, do mais recente para trás.
 *
 * ⚠️ `cartaoId` filtra. Sem ele vem tudo, que é o que a tela de baixas quer; a
 * tela de faturas manda sempre, porque ali a pergunta é "o que este cartão
 * cobra", e misturar dois cartões numa lista de competências faria a mesma
 * competência aparecer duas vezes sem dizer de quem é.
 */
export const GET = handler(
  { query: faturasQuerySchema, requerModulo: "financeiro" },
  controller.faturas,
);
