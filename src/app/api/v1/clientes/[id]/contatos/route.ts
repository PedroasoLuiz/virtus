import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { criarContatoBodySchema, idParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/contatos — telefones e e-mails da pessoa.
 *
 * ⚠️ Lista propria, e nao mais um campo em `clientes`. Uma empresa tem o e-mail
 * do financeiro, o do comercial e o telefone de cada um: guardar UM de cada
 * obrigava a escolher qual perder. `clientes.contato` e `clientes.email`
 * continuam existindo e passam a significar o PRINCIPAL, que e o que a cobranca
 * usa.
 */

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  controller.listarContatos,
);

export const POST = handler(
  { body: criarContatoBodySchema, params: idParamSchema, requerModulo: "financeiro" },
  controller.criarContato,
);
