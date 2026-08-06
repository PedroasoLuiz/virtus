import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/ia/ia.controller";
import { provedorParamSchema } from "@/modules/ia/ia.schema";

/**
 * /api/v1/ia/provedores/:provedor/principal
 *
 * Rota propria porque eleger o principal MEXE nos outros: renumera todos numa
 * transacao. Fosse um campo do salvar, dois provedores empatariam em 1 sempre
 * que alguem editasse um sem lembrar do outro.
 */

export const PUT = handler(
  { params: provedorParamSchema, requerModulo: "financeiro" },
  controller.definirPrincipal,
);
