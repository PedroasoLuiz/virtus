import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas/contas.controller";
import { contaBodySchema } from "@/modules/contas/contas.schema";

/** /api/v1/contas — contas bancárias e caixas da empresa. */

export const GET = handler({ requerModulo: "financeiro" }, controller.listar);

export const POST = handler(
  { body: contaBodySchema, requerModulo: "financeiro" },
  controller.criar,
);
