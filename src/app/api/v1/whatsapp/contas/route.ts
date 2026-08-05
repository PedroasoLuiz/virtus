import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { salvarContaBodySchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/contas — os numeros da empresa.
 *
 * O GET nunca devolve token nem app secret: eles vivem no `supabase_vault` e a
 * tela sabe apenas SE estao preenchidos. E isso que permite editar um apelido
 * sem o navegador jamais ter recebido a credencial.
 */

export const GET = handler({ requerModulo: "financeiro" }, controller.listarContas);

export const POST = handler(
  { body: salvarContaBodySchema, requerModulo: "financeiro" },
  controller.salvarConta,
);
