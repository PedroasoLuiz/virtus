import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/ia/ia.controller";
import { testarProvedorBodySchema } from "@/modules/ia/ia.schema";

/**
 * /api/v1/ia/provedores/teste — bate na porta do provedor sem gravar nada.
 *
 * ⚠️ POST, e nao GET, embora nao mude nada aqui dentro: a chave vai no CORPO. Em
 * query string ela entraria em log de acesso, de proxy e de erro, que e
 * exatamente o lugar de onde ela nao pode sair depois.
 *
 * ⚠️ Faz uma chamada paga, minuscula, ao provedor. Fica atras da mesma sessao e
 * do mesmo modulo do resto: sem isso, seria uma forma de terceiro gastar a cota
 * de uma chave que nem e dele.
 */

export const POST = handler(
  { body: testarProvedorBodySchema, requerModulo: "financeiro" },
  controller.testar,
);
