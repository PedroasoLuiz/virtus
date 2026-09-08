import type { Entrada } from "@/shared/http/handler";
import { created, noContent, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/tickets/tickets.service";
import {
  statusSchema,
  type AtualizarStatusBody,
  type AtualizarTicketBody,
  type CriarTicketBody,
  type CriarStatusBody,
  type FaturaveisQuery,
  type IdParam,
  type MoverTicketBody,
  type ProjetoDoTicketBody,
} from "@/modules/tickets/tickets.schema";

/** Traduz HTTP <-> servico de tickets. */

export async function obterTicket({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.obterTicket(empresaObrigatoria(ctx), params.id));
}

export async function cancelarTicket({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.cancelarTicket(empresaObrigatoria(ctx), ctx.usuarioId, params.id));
}

export async function excluirTicket({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  await service.excluirTicket(empresaObrigatoria(ctx), params.id);
  return noContent();
}

export async function criarTicket({ body, ctx }: Entrada<CriarTicketBody, undefined, unknown>) {
  return created(await service.criarTicket(empresaObrigatoria(ctx), ctx.usuarioId, body));
}

export async function atualizarTicket({
  body,
  params,
  ctx,
}: Entrada<AtualizarTicketBody, undefined, IdParam>) {
  return ok(
    await service.atualizarTicket(empresaObrigatoria(ctx), ctx.usuarioId, params.id, body),
  );
}

export async function definirProjetoDoTicket({
  body,
  params,
  ctx,
}: Entrada<ProjetoDoTicketBody, undefined, IdParam>) {
  return ok(
    await service.definirProjetoDoTicket(
      empresaObrigatoria(ctx),
      params.id,
      body.projetoId ?? null,
    ),
  );
}

// ── Colunas do quadro ───────────────────────────────────────────────────────

export async function listarStatus({ ctx }: Entrada<undefined, undefined, unknown>) {
  const colunas = await service.listarStatus(empresaObrigatoria(ctx));
  return ok(colunas.map((c) => statusSchema.parse(c)));
}

export async function criarStatus({ body, ctx }: Entrada<CriarStatusBody, undefined, unknown>) {
  const coluna = await service.criarStatus(empresaObrigatoria(ctx), ctx.usuarioId, body);
  return created(statusSchema.parse(coluna));
}

export async function atualizarStatus({
  body,
  params,
  ctx,
}: Entrada<AtualizarStatusBody, undefined, IdParam>) {
  const coluna = await service.atualizarStatus(empresaObrigatoria(ctx), params.id, body);
  return ok(statusSchema.parse(coluna));
}

export async function excluirStatus({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  await service.excluirStatus(empresaObrigatoria(ctx), params.id);
  return noContent();
}

export async function moverTicket({
  body,
  params,
  ctx,
}: Entrada<MoverTicketBody, undefined, IdParam>) {
  return ok(await service.moverTicket(empresaObrigatoria(ctx), params.id, body.statusId));
}

/**
 * Tickets com saldo em aberto, para montar uma conta a receber.
 *
 * Pagina grande e sem paginacao na tela: quem esta faturando um cliente precisa
 * ver TUDO o que esta em aberto de uma vez — dividido em paginas, sobra ticket
 * para tras e o cliente recebe duas cobrancas no mesmo mes.
 */
export async function listarFaturaveis({ query, ctx }: Entrada<undefined, FaturaveisQuery, unknown>) {
  const pagina = await service.listarTickets(
    empresaObrigatoria(ctx),
    { somenteFaturaveis: true, clienteId: query.clienteId },
    { page: 1, perPage: 200 },
  );

  return ok(pagina.itens);
}
