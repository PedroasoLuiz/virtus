import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import {
  conversaIdParamSchema,
  enviarModeloBodySchema,
} from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/conversas/{id}/modelo
 *
 * Separado de `/mensagens` porque a regra e outra: texto livre EXIGE janela
 * aberta, modelo funciona dentro e fora dela. Um endpoint so precisaria de um
 * `if` no corpo para saber qual validacao aplicar.
 */

/**
 * Os modelos que podem sair NESTA conversa.
 *
 * ⚠️ Pela conversa, e nao por `?contaId=`. O painel sabia o id da conta e o
 * mandava na consulta; um campo esquecido no schema da resposta fazia esse id
 * chegar `undefined`, a rota recusava e a tela concluia "nenhum modelo
 * aprovado" — culpando a Meta por um erro nosso. Quem conhece a conta de uma
 * conversa e o servidor, e agora e ele quem resolve.
 */
export const GET = handler(
  { params: conversaIdParamSchema, requerModulo: "financeiro" },
  controller.modelosDaConversa,
);

export const POST = handler(
  {
    body: enviarModeloBodySchema,
    params: conversaIdParamSchema,
    requerModulo: "financeiro",
  },
  controller.enviarModelo,
);
