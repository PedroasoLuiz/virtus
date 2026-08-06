import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/ia/ia.controller";
import { salvarNumeroTesteBodySchema } from "@/modules/ia/ia.schema";

/**
 * /api/v1/ia/numero-teste — a trava que limita o bot a numeros escolhidos.
 *
 * Rota propria porque o valor e da EMPRESA, e nao de um provedor: salvar junto
 * com a chave faria a trava depender de qual credencial foi editada por ultimo.
 */

export const PUT = handler(
  { body: salvarNumeroTesteBodySchema, requerModulo: "financeiro" },
  controller.salvarNumeroTeste,
);
