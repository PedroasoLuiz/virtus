import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { criarEnderecoBodySchema, idParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/enderecos
 *
 * ⚠️ Lista, e nao um endereco so. Obra tem canteiro, empresa tem matriz e filial,
 * e a entrega raramente e no mesmo lugar da cobranca. O PRINCIPAL e o que a nota
 * fiscal usa — e o primeiro cadastrado ja nasce assim, porque "nenhum principal"
 * e um estado que nao serve a ninguem.
 */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.listarEnderecos,
);

export const POST = handler(
  { body: criarEnderecoBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.criarEndereco,
);
