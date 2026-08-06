import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/atendimento/personas.controller";
import { salvarPersonaBodySchema } from "@/modules/atendimento/personas.schema";

/** /api/v1/atendimento/personas */

export const GET = handler({ requerModulo: "financeiro" }, controller.listar);

export const POST = handler(
  { body: salvarPersonaBodySchema, requerModulo: "financeiro" },
  controller.salvar,
);
