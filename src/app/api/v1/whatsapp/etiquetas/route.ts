import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/whatsapp/whatsapp.controller";
import { salvarEtiquetaBodySchema } from "@/modules/whatsapp/whatsapp.schema";

/**
 * /api/v1/whatsapp/etiquetas — como a empresa classifica suas conversas.
 *
 * Da EMPRESA e nao do numero: o mesmo cliente escreve para o financeiro e para o
 * almoxarifado, e "inadimplente" nao muda de significado no caminho.
 */

export const GET = handler({ requerModulo: "financeiro" }, controller.listarEtiquetas);

export const POST = handler(
  { body: salvarEtiquetaBodySchema, requerModulo: "financeiro" },
  controller.criarEtiqueta,
);
