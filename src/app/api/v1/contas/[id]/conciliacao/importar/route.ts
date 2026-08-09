import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/conciliacao/conciliacao.controller";
import { contaParamSchema, importarBodySchema } from "@/modules/conciliacao/conciliacao.schema";

/** Recebe as linhas que o navegador leu do OFX. Ver `conciliacao.schema`. */
export const POST = handler(
  { params: contaParamSchema, body: importarBodySchema, requerModulo: "financeiro" },
  controller.importar,
);
