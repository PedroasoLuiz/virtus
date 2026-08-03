import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/plataforma/plataforma.controller";

/** /api/v1/plano — plano vigente e modulos liberados da empresa ativa. */
export const GET = handler({}, controller.planoAtual);
