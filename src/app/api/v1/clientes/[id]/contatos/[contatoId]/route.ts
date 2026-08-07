import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { contatoIdParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/contatos/{contatoId}
 *
 * ⚠️ O DELETE apenas DESATIVA. O telefone que saiu do cadastro e o mesmo que
 * aparece numa conversa antiga do WhatsApp e num envio de cobranca de tres meses
 * atras: apagando, aquele historico perde a referencia de quem era.
 */

export const DELETE = handler(
  { params: contatoIdParamSchema, requerModulo: "financeiro" },
  controller.excluirContato,
);
