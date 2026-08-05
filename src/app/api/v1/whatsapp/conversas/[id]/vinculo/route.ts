import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import {
  conversaIdParamSchema,
  vincularBodySchema,
} from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/conversas/{id}/vinculo
 *
 * Liga a conversa a um cadastro guardando o telefone em `clientescontatos`. Nao
 * escreve o vinculo direto: quem escreve e o gatilho no banco, para a regra de
 * "casamento unico" existir num lugar so.
 */

export const POST = handler(
  {
    body: vincularBodySchema,
    params: conversaIdParamSchema,
    requerModulo: "financeiro",
  },
  controller.vincular,
);
