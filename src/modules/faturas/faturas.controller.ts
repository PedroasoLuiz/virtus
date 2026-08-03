import type { Entrada } from "@/shared/http/handler";
import { created, noContent, ok } from "@/shared/http/response";
import { AppError } from "@/shared/errors/app-error";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { metaDePaginacao } from "@/shared/utils/paginacao";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/faturas/faturas.service";
import {
  faturaResumoSchema,
  faturaSchema,
  type AlterarStatusBody,
  type BaixaBody,
  type CriarFaturaBody,
  type EnviarParcelaBody,
  type IdParam,
  type ListarQuery,
  type ParcelaParam,
  type TipoDocumentoQuery,
} from "@/modules/faturas/faturas.schema";

/**
 * Traduz HTTP <-> servico. Extrai o que precisa da entrada ja validada, chama o
 * servico, devolve a resposta padronizada. Nenhuma decisao de negocio aqui.
 */

export async function listar({ query, ctx }: Entrada<undefined, ListarQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const { page, perPage, ...filtro } = query;

  const { itens, total } = await service.listarFaturas(empresaId, filtro, { page, perPage });

  return ok(
    itens.map((f) => faturaResumoSchema.parse(f)),
    metaDePaginacao({ page, perPage }, total),
  );
}

export async function obter({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const fatura = await service.obterFatura(empresaId, params.id);
  return ok(faturaSchema.parse(fatura));
}

export async function criar({ body, ctx }: Entrada<CriarFaturaBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);

  const resultado = await service.criarFatura(empresaId, ctx.usuarioId, {
    ...body,
    origens: body.origens.map((o) => ({ ...o, valor: centavos(o.valor) })),
  });

  return created(resultado);
}

export async function alterarStatus({
  body,
  params,
  ctx,
}: Entrada<AlterarStatusBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.alterarStatus(empresaId, ctx.usuarioId, params.id, body.status);
  return ok({ id: params.id, status: body.status });
}

export async function adicionarParcela({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.adicionarParcelaNaFatura(empresaId, ctx.usuarioId, params.id);
  const fatura = await service.obterFatura(empresaId, params.id);
  return ok(faturaSchema.parse(fatura));
}

export async function excluirParcela({
  params,
  ctx,
}: Entrada<undefined, undefined, ParcelaParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.excluirParcelaDaFatura(empresaId, ctx.usuarioId, params.id, params.parcelaId);
  return noContent();
}

// ── Documentos da parcela ───────────────────────────────────────────────────

/**
 * Upload de nota fiscal ou boleto.
 *
 * Le `multipart/form-data` do proprio `req`: o handler so sabe ler JSON, e
 * declarar um schema de body aqui faria ele consumir o stream antes de
 * chegarmos no arquivo.
 */
export async function anexarDocumento({
  params,
  query,
  ctx,
  req,
}: Entrada<undefined, TipoDocumentoQuery, ParcelaParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const form = await req.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File)) {
    throw new AppError("VALIDATION_ERROR", 422, "Envie o arquivo no campo `arquivo`");
  }

  await service.anexarDocumento(
    empresaId,
    ctx.usuarioId,
    params.id,
    params.parcelaId,
    query.tipo,
    arquivo,
  );

  return created(faturaSchema.parse(await service.obterFatura(empresaId, params.id)));
}

export async function removerDocumento({
  params,
  query,
  ctx,
}: Entrada<undefined, TipoDocumentoQuery, ParcelaParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.removerDocumento(
    empresaId,
    ctx.usuarioId,
    params.id,
    params.parcelaId,
    query.tipo,
  );

  return ok(faturaSchema.parse(await service.obterFatura(empresaId, params.id)));
}

/**
 * Redireciona para a URL assinada.
 *
 * Redirect e nao JSON: o link vive uma hora, e devolve-lo para a tela guardar
 * criaria uma copia que expira sem avisar. Assim cada clique gera o seu.
 */
export async function abrirDocumento({
  params,
  query,
  ctx,
}: Entrada<undefined, TipoDocumentoQuery, ParcelaParam>) {
  const url = await service.linkDoDocumento(
    empresaObrigatoria(ctx),
    params.id,
    params.parcelaId,
    query.tipo,
  );

  return Response.redirect(url, 302);
}

export async function enviarParcela({
  body,
  params,
  ctx,
}: Entrada<EnviarParcelaBody, undefined, ParcelaParam>) {
  return ok(
    await service.enviarParcelaPorEmail(
      empresaObrigatoria(ctx),
      params.id,
      params.parcelaId,
      body.para,
    ),
  );
}

export async function desvincularTicket({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; ticketId: number }>) {
  return ok(await service.desvincularTicket(empresaObrigatoria(ctx), params.id, params.ticketId));
}

// ── Anexos da conta ─────────────────────────────────────────────────────────

export async function anexarNaConta({ params, ctx, req }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const form = await req.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File)) {
    throw new AppError("VALIDATION_ERROR", 422, "Envie o arquivo no campo `arquivo`");
  }

  await service.anexarNaConta(empresaId, ctx.usuarioId, params.id, arquivo);
  return created(faturaSchema.parse(await service.obterFatura(empresaId, params.id)));
}

export async function removerAnexoDaConta({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; anexoId: number }>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.removerAnexoDaConta(empresaId, params.id, params.anexoId);
  return ok(faturaSchema.parse(await service.obterFatura(empresaId, params.id)));
}

/** Redireciona para a URL assinada, valida por uma hora. */
export async function abrirAnexo({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; anexoId: number }>) {
  return Response.redirect(
    await service.linkDoAnexo(empresaObrigatoria(ctx), params.id, params.anexoId),
    302,
  );
}

export async function excluirConta({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  await service.excluirConta(empresaObrigatoria(ctx), params.id);
  return noContent();
}

export async function contasBancarias({ ctx }: Entrada<undefined, undefined, unknown>) {
  return ok(await service.contasBancarias(empresaObrigatoria(ctx)));
}

export async function registrarBaixa({ body, params, ctx }: Entrada<BaixaBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  const fatura = await service.registrarBaixa(empresaId, ctx.usuarioId, params.id, {
    data: body.data,
    tipo: body.tipo,
    contaBancariaId: body.contaBancariaId ?? null,
    descricao: body.descricao,
    observacoes: body.observacoes,
    destinos: body.destinos.map((d) => ({ parcelaId: d.parcelaId, valor: centavos(d.valor) })),
  });

  return created(faturaSchema.parse(fatura));
}
