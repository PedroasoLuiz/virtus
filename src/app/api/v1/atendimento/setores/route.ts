import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/atendimento/personas.controller";

/** /api/v1/atendimento/setores — para escolher o setor de uma persona. */

export const GET = handler({ requerModulo: "financeiro" }, controller.listarSetores);
