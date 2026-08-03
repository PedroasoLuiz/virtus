import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/cadastros/cadastros.controller";
import { criarServicoBodySchema } from "@/modules/cadastros/cadastros.schema";

/** /api/v1/servicos */

export const GET = handler({ requerModulo: "financeiro" }, controller.listarServicos);

export const POST = handler(
  { body: criarServicoBodySchema, requerModulo: "financeiro" },
  controller.criarServico,
);
