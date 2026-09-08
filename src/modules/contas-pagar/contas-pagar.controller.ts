import type { z } from "zod";
import type { Entrada } from "@/shared/http/handler";
import { created, noContent, ok } from "@/shared/http/response";
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
  type CartaoAtivoBody,
  type CompraNoCartaoBody,
  type FaturasQuery,
  type LancamentoParam,
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
  type CancelarParcelaBody,
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

  /*
   * ⚠️ O objeto passa pela ENTRADA do schema antes do `parse`.
   *
   * `parse` recebe `unknown`: um campo que o servico devolve e o schema nao
   * declara e descartado em silencio, e a tela recebe a resposta sem ele. Ja
   * aconteceu tres vezes no projeto, a ultima com o `documento` do extrato.
   */
  const saida: z.input<typeof contaDetalheSchema> = await service.obterConta(empresaId, params.id);

  return ok(contaDetalheSchema.parse(saida));
}

export async function atualizarCartao({
  body,
  params,
  ctx,
}: Entrada<CartaoAtivoBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.atualizarCartao(empresaId, ctx.usuarioId, params.id, {
    ativo: body.ativo,
    fornecedorId: body.fornecedorId,
  });
  return ok(await service.cartoesDaEmpresa(empresaId));
}

export async function excluirCartao({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  await service.excluirCartao(empresaObrigatoria(ctx), params.id);
  return noContent();
}

export async function lancarCompraNoCartao({
  body,
  params,
  ctx,
}: Entrada<CompraNoCartaoBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.lancarCompraNoCartao(empresaId, ctx.usuarioId, {
    cartaoId: params.id,
    fornecedorId: body.fornecedorId,
    descricao: body.descricao,
    dataCompra: body.dataCompra,
    valor: centavos(body.valor),
    centroCustoId: body.centroCustoId ?? null,
    parcelas: body.parcelas,
    competenciaInicial: body.competenciaInicial,
  });

  return created(await service.faturasDoCartao(empresaId, params.id));
}

export async function lancamentosDaFatura({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.lancamentosDaFatura(empresaObrigatoria(ctx), params.id));
}

export async function cancelarLancamentoDaFatura({
  params,
  ctx,
}: Entrada<undefined, undefined, LancamentoParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.definirLancamentoCancelado(
    empresaId,
    ctx.usuarioId,
    params.id,
    params.lancamentoId,
    true,
  );
  return ok(await service.lancamentosDaFatura(empresaId, params.id));
}

export async function reativarLancamentoDaFatura({
  params,
  ctx,
}: Entrada<undefined, undefined, LancamentoParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.definirLancamentoCancelado(
    empresaId,
    ctx.usuarioId,
    params.id,
    params.lancamentoId,
    false,
  );
  return ok(await service.lancamentosDaFatura(empresaId, params.id));
}

export async function removerLancamentoDaFatura({
  params,
  ctx,
}: Entrada<undefined, undefined, LancamentoParam>) {
  await service.removerLancamentoDaFatura(
    empresaObrigatoria(ctx),
    params.id,
    params.lancamentoId,
  );
  return noContent();
}

export async function cancelarConta({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.cancelarConta(empresaId, ctx.usuarioId, params.id);
  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

export async function reativarConta({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.cancelarConta(empresaId, ctx.usuarioId, params.id, false);
  return ok(contaDetalheSchema.parse(await service.obterConta(empresaId, params.id)));
}

export async function excluirConta({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  await service.excluirConta(empresaObrigatoria(ctx), params.id);
  return noContent();
}

export async function cancelarParcela({
  body,
  params,
  ctx,
}: Entrada<CancelarParcelaBody, undefined, ParcelaParam>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.cancelarParcelaDaConta(
    empresaId,
    ctx.usuarioId,
    params.id,
    params.parcelaId,
    body.motivo ?? null,
  );

  return noContent();
}

export async function reativarParcela({ params, ctx }: Entrada<undefined, undefined, ParcelaParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.reativarParcelaDaConta(empresaId, ctx.usuarioId, params.id, params.parcelaId);
  return noContent();
}

export async function estornarBaixa({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  await service.estornarBaixa(empresaObrigatoria(ctx), params.id);
  return noContent();
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

export async function faturas({ query, ctx }: Entrada<undefined, FaturasQuery, unknown>) {
  const lista = await service.faturasDoCartao(empresaObrigatoria(ctx), query.cartaoId);
  return ok(lista.map((f) => faturaDeCartaoSchema.parse(f)));
}

export async function reabrirFatura({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.reabrirFatura(empresaId, ctx.usuarioId, params.id);
  return ok(await service.faturasDoCartao(empresaId));
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
