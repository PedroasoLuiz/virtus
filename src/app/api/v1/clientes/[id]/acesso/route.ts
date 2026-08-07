import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { definirUsuariosBodySchema, idParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/acesso — quem enxerga os dados desta pessoa.
 *
 * ⚠️ E o acesso do PORTAL, e nao permissao de sistema. Quem esta aqui ve as
 * faturas, os tickets e os documentos deste cadastro pelo portal do cliente; nao
 * ganha nada dentro do sistema da empresa.
 *
 * ⚠️ Vincular alguem a uma pessoa e dar acesso a dado financeiro de terceiro. Por
 * isso a lista de candidatos sai de `usuarios_visiveis()`: ninguem consegue dar
 * acesso a um usuario que nem enxerga.
 */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.listarAcesso,
);

export const PUT = handler(
  { body: definirUsuariosBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.definirAcesso,
);
