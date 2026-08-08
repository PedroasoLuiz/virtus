import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import {
  criarClienteComCanalSchema,
  listarQuerySchema,
} from "@/modules/clientes/clientes.schema";

/** /api/v1/clientes */

export const GET = handler(
  { query: listarQuerySchema, requerModulo: "financeiro" },
  controller.listar,
);

/**
 * ⚠️ O POST usa o schema COM a exigencia de canal; o PATCH, nao.
 *
 * Cadastro novo sem telefone nem e-mail e um nome solto: a primeira cobranca
 * descobre que nao ha para onde mandar. Ja quem edita mexe no canal pela aba de
 * contatos, e repetir a regra aqui recusaria um salvar de nome so porque o corpo
 * do PATCH nao carrega o telefone.
 */
export const POST = handler(
  { body: criarClienteComCanalSchema, requerModulo: "financeiro" },
  controller.criar,
);
