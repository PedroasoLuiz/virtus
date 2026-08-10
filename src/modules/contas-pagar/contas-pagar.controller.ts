import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { AppError } from "@/shared/errors/app-error";
import { metaDePaginacao } from "@/shared/utils/paginacao";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/contas-pagar/contas-pagar.service";
import {
  baixaSchema,
  bancoDaListaSchema,
  cartaoDaBaixaSchema,
  faturaDeCartaoSchema,
  contaDetalheSchema,
  contaResumoSchema,
  parcelaAPagarSchema,
  tipoDeDocumentoSchema,
  type AtualizarContaBody,
  type CriarBaixaBody,
  type CriarCartaoBody,
  type CriarContaBody,
  type ParcelaParam,
  type RedefinirParcelasBody,
  type SubstituirLancamentosBody,
  type ParcelasAPagarQuery,
  type TipoDocumentoQuery,
  type IdParam,
  type ListarQuery,
} from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui.
 */

export async function listar({ query, ctx }: Entrada<undefined, ListarQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const { page, perPage, ...filtro } = query;

  const { itens, total } = await service.listarContas(empresaId, filtro, { page, perPage });

  return ok(
    itens.map((c) => contaResumoSchema.parse(c)),
    metaDePaginacao({ page, perPage }, total),
  );
}

export async function obter({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

export async function listarTiposDeDocumento({ ctx }: Entrada<undefined, undefined, unknown>) {
  // A empresa e exigida para a RLS recortar; a consulta em si nao a usa.
  empresaObrigatoria(ctx);
  const tipos = await service.listarTiposDeDocumento();
  return ok(tipos.map((t) => tipoDeDocumentoSchema.parse(t)));
}

export async function obterBaixa({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  return ok(baixaSchema.parse(await service.obterBaixa(empresaId, params.id)));
}

export async function bancos({ ctx }: Entrada<undefined, undefined, unknown>) {
  // A empresa e exigida para a RLS recortar; a consulta em si nao a usa.
  empresaObrigatoria(ctx);
  const lista = await service.listarBancos();
  return ok(lista.map((b) => bancoDaListaSchema.parse(b)));
}

export async function criarCartao({ body, ctx }: Entrada<CriarCartaoBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.criarCartao(empresaId, ctx.usuarioId, {
    apelido: body.apelido,
    bandeira: body.bandeira ?? null,
    ultimosDigitos: body.ultimosDigitos ?? null,
    diaFechamento: body.diaFechamento,
    diaVencimento: body.diaVencimento,
    limite: centavos(body.limite),
    bancoId: body.bancoId ?? null,
    fornecedorId: body.fornecedorId ?? null,
    contaBancariaId: body.contaBancariaId ?? null,
  });

  const lista = await service.cartoesDaEmpresa(empresaId);
  return created(lista.map((c) => cartaoDaBaixaSchema.parse(c)));
}

export async function faturas({ ctx }: Entrada<undefined, undefined, unknown>) {
  const lista = await service.faturasDoCartao(empresaObrigatoria(ctx));
  return ok(lista.map((f) => faturaDeCartaoSchema.parse(f)));
}

export async function fecharFatura({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const contaId = await service.fecharFatura(empresaId, ctx.usuarioId, params.id);
  return created(contaDetalheSchema.parse(await service.obterConta(empresaId, contaId)));
}

export async function cartoes({ ctx }: Entrada<undefined, undefined, unknown>) {
  const lista = await service.cartoesDaEmpresa(empresaObrigatoria(ctx));
  return ok(lista.map((c) => cartaoDaBaixaSchema.parse(c)));
}

export async function parcelasAPagar({
  query,
  ctx,
}: Entrada<undefined, ParcelasAPagarQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const parcelas = await service.parcelasAPagar(empresaId, query.fornecedorId);
  return ok(parcelas.map((p) => parcelaAPagarSchema.parse(p)));
}

export async function criarBaixa({ body, ctx }: Entrada<CriarBaixaBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);

  /*
   * ⚠️ Montado campo a campo, e por isso se confere contra o schema. Foi assim
   * que `dataCredito` e `taxa` sumiram no caminho do lado que recebe: estavam no
   * corpo e no servico, e o controller nao as copiava.
   */
  const id = await service.registrarBaixa(empresaId, ctx.usuarioId, {
    fornecedorId: body.fornecedorId,
    data: body.data,
    tipo: body.tipo,
    contaBancariaId: body.contaBancariaId ?? null,
    cartaoId: body.cartaoId ?? null,
    observacoes: body.observacoes ?? null,
    destinos: body.destinos.map((d) => ({
      parcelaId: d.parcelaId,
      valor: centavos(d.valor),
      juros: centavos(d.juros),
      multa: centavos(d.multa),
      quitar: d.quitar,
    })),
  });

  return created(baixaSchema.parse(await service.obterBaixa(empresaId, id)));
}

export async function redefinirParcelas({
  body,
  params,
  ctx,
}: Entrada<RedefinirParcelasBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.redefinirParcelasDaConta(
    empresaId,
    ctx.usuarioId,
    params.id,
    body.parcelas.map((p) => ({
      id: p.id,
      vencimento: p.vencimento,
      valor: centavos(p.valor),
    })),
  );

  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

export async function atualizar({
  body,
  params,
  ctx,
}: Entrada<AtualizarContaBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.atualizarObservacoes(empresaId, ctx.usuarioId, params.id, body.observacoes ?? null);
  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

export async function substituirLancamentos({
  body,
  params,
  ctx,
}: Entrada<SubstituirLancamentosBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.substituirLancamentos(
    empresaId,
    ctx.usuarioId,
    params.id,
    body.lancamentos.map((l) => ({
      descricao: l.descricao,
      valor: centavos(l.valor),
      centroCustoId: l.centroCustoId ?? null,
    })),
  );

  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

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

  await service.anexarDocumentoDaParcela(
    empresaId,
    ctx.usuarioId,
    params.id,
    params.parcelaId,
    query.tipo,
    arquivo,
  );
  return created(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

export async function removerDocumento({
  params,
  query,
  ctx,
}: Entrada<undefined, TipoDocumentoQuery, ParcelaParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.removerDocumentoDaParcela(
    empresaId,
    ctx.usuarioId,
    params.id,
    params.parcelaId,
    query.tipo,
  );
  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

/** Redireciona para a URL assinada, valida por uma hora. */
export async function abrirDocumento({
  params,
  query,
  ctx,
}: Entrada<undefined, TipoDocumentoQuery, ParcelaParam>) {
  return Response.redirect(
    await service.linkDoDocumentoDaParcela(
      empresaObrigatoria(ctx),
      params.id,
      params.parcelaId,
      query.tipo,
    ),
    302,
  );
}

export async function anexar({ params, ctx, req }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const form = await req.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File)) {
    throw new AppError("VALIDATION_ERROR", 422, "Envie o arquivo no campo `arquivo`");
  }

  await service.anexarNaConta(empresaId, ctx.usuarioId, params.id, arquivo);
  return created(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

export async function removerAnexo({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; anexoId: number }>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.removerAnexoDaConta(empresaId, params.id, params.anexoId);
  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
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

export async function criar({ body, ctx }: Entrada<CriarContaBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);

  /*
   * ⚠️ O objeto do servico e montado campo a campo, entao ele se confere contra
   * o schema. Foi assim que `dataCredito` e `taxa` sumiram no caminho do lado
   * que recebe: estavam no corpo e no servico, e o controller nao as copiava.
   */
  const id = await service.criarConta(empresaId, ctx.usuarioId, {
    fornecedorId: body.fornecedorId,
    descricao: body.descricao ?? null,
    emissao: body.emissao,
    documento: body.documento,
    tipoDocumentoId: body.tipoDocumentoId,
    lancamentos: body.lancamentos.map((l) => ({
      descricao: l.descricao,
      valor: centavos(l.valor),
      centroCustoId: l.centroCustoId ?? null,
    })),
    origem: body.origem
      ? {
          tipo: body.origem.tipo,
          ordemId: body.origem.ordemId ?? null,
          contratoId: body.origem.contratoId ?? null,
        }
      : undefined,
    observacoes: body.observacoes ?? null,
    parcelas: body.parcelas.map((p) => ({
      vencimento: p.vencimento,
      valor: centavos(p.valor),
    })),
  });

  return created(contaDetalheSchema.parse(await service.obterConta(empresaId, id)));
}
