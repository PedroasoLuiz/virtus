import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";

/** /api/v1/contas-pagar/faturas — os ciclos de cartão, do mais recente para trás. */
export const GET = handler({ requerModulo: "financeiro" }, controller.faturas);
