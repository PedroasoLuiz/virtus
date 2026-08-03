import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { metaDePaginacao } from "@/shared/utils/paginacao";
import * as service from "@/modules/clientes/clientes.service";
import {
  clienteSchema,
  type AtualizarClienteBody,
  type CriarClienteBody,
  type IdParam,
  type ListarQuery,
} from "@/modules/clientes/clientes.schema";

/** Traduz HTTP <-> servico. */

export async function listar({ query, ctx }: Entrada<undefined, ListarQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const { page, perPage, ...filtro } = query;

  const { itens, total } = await service.listarClientes(empresaId, filtro, { page, perPage });

  return ok(
    itens.map((c) => clienteSchema.parse(c)),
    metaDePaginacao({ page, perPage }, total),
  );
}

export async function obter({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const cliente = await service.obterCliente(empresaId, params.id);
  return ok(clienteSchema.parse(cliente));
}

export async function criar({ body, ctx }: Entrada<CriarClienteBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const cliente = await service.criarCliente(empresaId, ctx.usuarioId, {
    ...body,
    papeis: body.papeis,
  });
  return created(clienteSchema.parse(cliente));
}

export async function atualizar({
  body,
  params,
  ctx,
}: Entrada<AtualizarClienteBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const cliente = await service.atualizarCliente(empresaId, ctx.usuarioId, params.id, body);
  return ok(clienteSchema.parse(cliente));
}
