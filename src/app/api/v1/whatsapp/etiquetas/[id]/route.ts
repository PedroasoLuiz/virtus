import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { etiquetaIdParamSchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/etiquetas/{id}
 *
 * ⚠️ O DELETE apenas DESATIVA. Apagar de verdade levaria junto a classificacao
 * de todas as conversas marcadas, e quem exclui uma etiqueta quer parar de
 * usa-la, nao perder o registro de quem estava nela.
 */

export const DELETE = handler(
  { params: etiquetaIdParamSchema, requerModulo: "financeiro" },
  controller.excluirEtiqueta,
);
