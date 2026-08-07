import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { removerVinculoQuerySchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/modelos/solicitacao — em que pé está o modelo pedido.
 *
 * ⚠️ A tela chama isto em laço enquanto o modelo está em análise, e para assim
 * que ele é aprovado ou recusado. O serviço tem a mesma trava do lado de cá:
 * pedido já resolvido responde com o que está gravado, sem sair para a Meta.
 */

export const GET = handler(
  { query: removerVinculoQuerySchema, requerModulo: "financeiro" },
  controller.conferirSolicitacao,
);
