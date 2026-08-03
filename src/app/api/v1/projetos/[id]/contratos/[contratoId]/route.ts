import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/projetos/projetos.controller";
import { projetoContratoParamSchema } from "@/modules/projetos/projetos.schema";

/**
 * /api/v1/projetos/:id/contratos/:contratoId
 *
 * O contrato PODE servir a vários projetos — um retainer cobre o ano inteiro —,
 * então vincular aqui não o tira de lugar nenhum.
 */

export const POST = handler(
  { params: projetoContratoParamSchema, requerModulo: "os" },
  controller.vincularContrato,
);

export const DELETE = handler(
  { params: projetoContratoParamSchema, requerModulo: "os" },
  controller.desvincularContrato,
);
