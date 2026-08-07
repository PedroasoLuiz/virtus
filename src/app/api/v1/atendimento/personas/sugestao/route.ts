import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/atendimento/personas.controller";
import { sugestaoDePersonaBodySchema } from "@/modules/atendimento/personas.schema";

/**
 * /api/v1/atendimento/personas/sugestao — um rascunho de persona, escrito pela IA.
 *
 * ⚠️ Devolve TEXTO, e não grava nada. O rascunho cai nos campos do formulário e
 * a pessoa revisa antes de salvar: um modelo escrevendo direto no banco seria
 * autorizar a IA a definir o que ela mesma pode fazer.
 *
 * ⚠️ Gasta a chave da empresa. Fica atrás da mesma sessão e do mesmo módulo do
 * resto, senão seria uma forma de terceiro consumir a cota de quem paga.
 */

export const POST = handler(
  { body: sugestaoDePersonaBodySchema, requerModulo: "financeiro" },
  controller.sugerir,
);
