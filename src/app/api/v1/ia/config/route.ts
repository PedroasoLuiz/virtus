import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/ia/ia.controller";
import { salvarConfigIABodySchema } from "@/modules/ia/ia.schema";

/**
 * /api/v1/ia/config — chave e modelo do provedor de IA da empresa.
 *
 * O GET nunca devolve a chave: ela vive no `supabase_vault` e a tela sabe apenas
 * se existe. Mesma mecanica das contas de WhatsApp.
 */

export const GET = handler({ requerModulo: "financeiro" }, controller.obter);

export const PUT = handler(
  { body: salvarConfigIABodySchema, requerModulo: "financeiro" },
  controller.salvar,
);
