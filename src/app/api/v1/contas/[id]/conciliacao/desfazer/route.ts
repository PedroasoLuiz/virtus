import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/conciliacao/conciliacao.controller";
import { contaParamSchema, desfazerBodySchema } from "@/modules/conciliacao/conciliacao.schema";

export const POST = handler(
  { params: contaParamSchema, body: desfazerBodySchema, requerModulo: "financeiro" },
  controller.desfazer,
);
