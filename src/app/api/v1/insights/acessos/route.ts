import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/insights/insights.controller";

/** /api/v1/insights/acessos — os logins da Meta, sem os segredos deles. */
export const GET = handler({ requerModulo: "financeiro" }, controller.listarAcessos);
