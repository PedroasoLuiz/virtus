import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";

/** /api/v1/contas-bancarias — onde o dinheiro entra. */

export const GET = handler({ requerModulo: "financeiro" }, controller.contasBancarias);
