import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { metaDePaginacao } from "@/shared/utils/paginacao";
import * as service from "@/modules/clientes/clientes.service";
import {
  clienteSchema,
  contagemSchema,
  bancarioSchema,
  contatoSchema,
  enderecoSchema,
  usuarioComAcessoSchema,
  type AtualizarBancarioBody,
  type AtualizarClienteBody,
  type AtualizarContatoBody,
  type AtualizarEnderecoBody,
  type ContagemQuery,
  type ContatoIdParam,
  type CriarClienteBody,
  type CriarBancarioBody,
  type CriarContatoBody,
  type CriarEnderecoBody,
  type DefinirUsuariosBody,
  type FilhoIdParam,
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

export async function contagem({ query, ctx }: Entrada<undefined, ContagemQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const total = await service.contagemPorPapel(empresaId, query.inativos);

  return ok(contagemSchema.parse(total));
}

export async function listarContatos({
  params,
  ctx,
}: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const contatos = await service.contatosDaPessoa(empresaId, params.id);

  return ok(contatos.map((c) => contatoSchema.parse(c)));
}

export async function criarContato({
  body,
  params,
  ctx,
}: Entrada<CriarContatoBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  const contato = await service.criarContato(empresaId, ctx.usuarioId, params.id, {
    tipo: body.tipo,
    valor: body.valor,
    rotulo: body.rotulo?.trim() || null,
    responsavel: body.responsavel?.trim() || null,
  });

  return created(contatoSchema.parse(contato));
}

export async function atualizarContato({
  body,
  params,
  ctx,
}: Entrada<AtualizarContatoBody, undefined, ContatoIdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  const contato = await service.atualizarContato(empresaId, params.id, params.contatoId, {
    valor: body.valor,
    rotulo: body.rotulo?.trim() || null,
    responsavel: body.responsavel?.trim() || null,
  });

  return ok(contatoSchema.parse(contato));
}

export async function excluirContato({
  params,
  ctx,
}: Entrada<undefined, undefined, ContatoIdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.excluirContato(empresaId, params.id, params.contatoId);

  return ok({ id: params.contatoId });
}

export async function listarEnderecos({
  params,
  ctx,
}: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const enderecos = await service.enderecosDaPessoa(empresaId, params.id);

  return ok(enderecos.map((e) => enderecoSchema.parse(e)));
}

export async function criarEndereco({
  body,
  params,
  ctx,
}: Entrada<CriarEnderecoBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.criarEndereco(empresaId, ctx.usuarioId, params.id, {
    cep: body.cep?.trim() || null,
    logradouro: body.logradouro?.trim() || null,
    numero: body.numero?.trim() || null,
    complemento: body.complemento?.trim() || null,
    bairro: body.bairro?.trim() || null,
    cidade: body.cidade?.trim() || null,
    uf: body.uf?.trim().toUpperCase() || null,
    principal: body.principal,
  });

  return created({ id: params.id });
}

export async function enderecoPrincipal({
  params,
  ctx,
}: Entrada<undefined, undefined, FilhoIdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.definirEnderecoPrincipal(empresaId, params.id, params.filhoId);

  return ok({ id: params.filhoId });
}

export async function atualizarEndereco({
  body,
  params,
  ctx,
}: Entrada<AtualizarEnderecoBody, undefined, FilhoIdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.atualizarEndereco(empresaId, params.id, params.filhoId, {
    cep: body.cep?.trim() || null,
    logradouro: body.logradouro?.trim() || null,
    numero: body.numero?.trim() || null,
    complemento: body.complemento?.trim() || null,
    bairro: body.bairro?.trim() || null,
    cidade: body.cidade?.trim() || null,
    uf: body.uf?.trim().toUpperCase() || null,
  });

  return ok({ id: params.filhoId });
}

export async function excluirEndereco({
  params,
  ctx,
}: Entrada<undefined, undefined, FilhoIdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.excluirEndereco(empresaId, params.id, params.filhoId);

  return ok({ id: params.filhoId });
}

export async function listarBancarios({
  params,
  ctx,
}: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const dados = await service.bancariosDaPessoa(empresaId, params.id);

  return ok(dados.map((d) => bancarioSchema.parse(d)));
}

export async function criarBancario({
  body,
  params,
  ctx,
}: Entrada<CriarBancarioBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.criarBancario(empresaId, ctx.usuarioId, params.id, {
    banco: body.banco?.trim() || null,
    agencia: body.agencia?.trim() || null,
    conta: body.conta?.trim() || null,
    tipo: body.tipo ?? null,
    titular: body.titular?.trim() || null,
    documento: body.documento?.replace(/\D/g, "") || null,
    pixTipo: body.pixTipo ?? null,
    pixChave: body.pixChave?.trim() || null,
    principal: body.principal,
  });

  return created({ id: params.id });
}

export async function atualizarBancario({
  body,
  params,
  ctx,
}: Entrada<AtualizarBancarioBody, undefined, FilhoIdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.atualizarBancario(empresaId, params.id, params.filhoId, {
    banco: body.banco?.trim() || null,
    agencia: body.agencia?.trim() || null,
    conta: body.conta?.trim() || null,
    tipo: body.tipo ?? null,
    titular: body.titular?.trim() || null,
    documento: body.documento?.replace(/\D/g, "") || null,
    pixTipo: body.pixTipo ?? null,
    pixChave: body.pixChave?.trim() || null,
  });

  return ok({ id: params.filhoId });
}

export async function excluirBancario({
  params,
  ctx,
}: Entrada<undefined, undefined, FilhoIdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.excluirBancario(empresaId, params.id, params.filhoId);

  return ok({ id: params.filhoId });
}

export async function listarAcesso({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const { comAcesso, disponiveis } = await service.acessoDaPessoa(empresaId, params.id);

  return ok({
    comAcesso: comAcesso.map((u) => usuarioComAcessoSchema.parse(u)),
    disponiveis: disponiveis.map((u) => usuarioComAcessoSchema.parse(u)),
  });
}

export async function definirAcesso({
  body,
  params,
  ctx,
}: Entrada<DefinirUsuariosBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.definirUsuariosDaPessoa(empresaId, ctx.usuarioId, params.id, body.usuarios);

  return ok({ usuarios: body.usuarios });
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
