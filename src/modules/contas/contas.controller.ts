import type { Entrada } from "@/shared/http/handler";
import { created, noContent, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/contas/contas.service";
import {
  contaSchema,
  extratoSchema,
  type ConciliacaoBody,
  type ConciliacaoParam,
  type ContaBody,
  type ExtratoQuery,
  type IdParam,
} from "@/modules/contas/contas.schema";
import type { DataISO } from "@/shared/utils/datas";

/** Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui. */

export async function listar({ ctx }: Entrada<undefined, undefined, unknown>) {
  const contas = await service.listarContas(empresaObrigatoria(ctx));
  return ok(contas.map((c) => contaSchema.parse(c)));
}

export async function obter({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(contaSchema.parse(await service.obterConta(empresaObrigatoria(ctx), params.id)));
}

export async function criar({ body, ctx }: Entrada<ContaBody, undefined, unknown>) {
  const conta = await service.criarConta(empresaObrigatoria(ctx), ctx.usuarioId, paraDominio(body));
  return created(contaSchema.parse(conta));
}

export async function atualizar({ body, params, ctx }: Entrada<ContaBody, undefined, IdParam>) {
  const conta = await service.atualizarConta(
    empresaObrigatoria(ctx),
    ctx.usuarioId,
    params.id,
    paraDominio(body),
  );

  return ok(contaSchema.parse(conta));
}

export async function excluir({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  await service.excluirConta(empresaObrigatoria(ctx), params.id);
  return noContent();
}

export async function extrato({
  query,
  params,
  ctx,
}: Entrada<undefined, ExtratoQuery, IdParam>) {
  const extrato = await service.extratoDaConta(
    empresaObrigatoria(ctx),
    params.id,
    query.de as DataISO,
    query.ate as DataISO,
  );

  return ok(extratoSchema.parse(extrato));
}

export async function conciliar({
  body,
  params,
  ctx,
}: Entrada<ConciliacaoBody, undefined, ConciliacaoParam>) {
  await service.conciliar(
    empresaObrigatoria(ctx),
    ctx.usuarioId,
    params.id,
    params.pagamentoId,
    body.conciliado,
  );

  return noContent();
}

function paraDominio(body: ContaBody) {
  return {
    apelido: body.apelido ?? null,
    banco: body.banco ?? null,
    agencia: body.agencia ?? null,
    conta: body.conta ?? null,
    tipo: body.tipo ?? null,
    ativo: body.ativo,
    limite: centavos(body.limite),
    saldoInicial: centavos(body.saldoInicial),
  };
}
