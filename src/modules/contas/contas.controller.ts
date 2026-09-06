import type { z } from "zod";
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
  type SituacaoBody,
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

export async function definirSituacao({
  body,
  params,
  ctx,
}: Entrada<SituacaoBody, undefined, IdParam>) {
  const conta = await service.definirSituacaoDaConta(
    empresaObrigatoria(ctx),
    ctx.usuarioId,
    params.id,
    body.ativo,
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

  /*
   * ⚠️ O tipo passa pela ENTRADA do schema antes do `parse`.
   *
   * `parse` recebe `unknown`, entao um campo que o servico devolve e o schema
   * nao declara e DESCARTADO em silencio — a tela recebe a resposta sem ele e
   * nada acusa. Foi o que aconteceu com o `documento`: o extrato passou a saber
   * de que titulo era cada linha, e a tela continuou sem mostrar. Amarrado ao
   * `z.input`, o proximo campo esquecido vira erro do `tsc`.
   */
  const saida: z.input<typeof extratoSchema> = extrato;

  return ok(extratoSchema.parse(saida));
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
    aceitaCartao: body.aceitaCartao,
    /*
     * ⚠️ Taxa so vale onde ha cartao.
     *
     * Desmarcar "aceita cartao" e deixar 3,5% gravado deixaria a conta com um
     * numero que nada le, esperando alguem religar a caixa e descobrir uma taxa
     * que nunca foi revista.
     */
    taxaDebito: body.aceitaCartao ? (body.taxaDebito ?? null) : null,
    taxaCredito: body.aceitaCartao ? (body.taxaCredito ?? null) : null,
    taxaParcelado: body.aceitaCartao ? (body.taxaParcelado ?? null) : null,
    prazoCreditoDias: body.aceitaCartao ? (body.prazoCreditoDias ?? null) : null,
    tarifaBoleto: body.tarifaBoleto == null ? null : centavos(body.tarifaBoleto),
  };
}
