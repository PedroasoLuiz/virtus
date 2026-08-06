import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/ia/ia.controller";
import { salvarProvedorBodySchema } from "@/modules/ia/ia.schema";

/**
 * /api/v1/ia/config — os provedores de IA da empresa.
 *
 * O GET nunca devolve a chave: ela vive no `supabase_vault` e a tela sabe apenas
 * se existe. Mesma mecanica das contas de WhatsApp.
 *
 * Continua em `/config` e nao virou `/provedores` para nao quebrar quem ja
 * tenha a tela aberta durante o deploy. O corpo e que mudou.
 */

export const GET = handler({ requerModulo: "financeiro" }, controller.listar);

export const PUT = handler(
  { body: salvarProvedorBodySchema, requerModulo: "financeiro" },
  controller.salvar,
);
