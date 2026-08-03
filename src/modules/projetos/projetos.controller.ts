import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/projetos/projetos.service";
import type {
  AlternarItemBody,
  AnexoBody,
  ComentarioBody,
  CobrarDemandasBody,
  GerarTicketBody,
  ItemBody,
  AtualizarDemandaBody,
  AtualizarProjetoBody,
  CriarDemandaBody,
  CriarProjetoBody,
  IdParam,
} from "@/modules/projetos/projetos.schema";

/** Traduz HTTP <-> servico de projetos. */

export async function obterProjeto({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.obterProjeto(empresaObrigatoria(ctx), params.id));
}

export async function criarProjeto({ body, ctx }: Entrada<CriarProjetoBody, undefined, unknown>) {
  return created(await service.criarProjeto(empresaObrigatoria(ctx), ctx.usuarioId, body));
}

export async function atualizarProjeto({
  body,
  params,
  ctx,
}: Entrada<AtualizarProjetoBody, undefined, IdParam>) {
  return ok(
    await service.atualizarProjeto(empresaObrigatoria(ctx), ctx.usuarioId, params.id, body),
  );
}

// ── Demandas ────────────────────────────────────────────────────────────────

export async function criarDemanda({
  body,
  params,
  ctx,
}: Entrada<CriarDemandaBody, undefined, IdParam>) {
  return created(
    await service.criarDemanda(empresaObrigatoria(ctx), ctx.usuarioId, params.id, body),
  );
}

export async function atualizarDemanda({
  body,
  params,
  ctx,
}: Entrada<AtualizarDemandaBody, undefined, IdParam>) {
  return ok(
    await service.atualizarDemanda(empresaObrigatoria(ctx), ctx.usuarioId, params.id, body),
  );
}

export async function excluirProjeto({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.excluirProjeto(empresaObrigatoria(ctx), params.id));
}

export async function contratosDisponiveis({
  params,
  ctx,
}: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.contratosDisponiveis(empresaObrigatoria(ctx), params.id));
}

export async function vincularContrato({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; contratoId: number }>) {
  return created(
    await service.vincularContrato(
      empresaObrigatoria(ctx),
      ctx.usuarioId,
      params.id,
      params.contratoId,
    ),
  );
}

export async function desvincularContrato({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; contratoId: number }>) {
  return ok(
    await service.desvincularContrato(empresaObrigatoria(ctx), params.id, params.contratoId),
  );
}

export async function ticketsDisponiveis({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.ticketsDisponiveis(empresaObrigatoria(ctx), params.id));
}

export async function vincularTicket({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; ticketId: number }>) {
  return created(
    await service.vincularTicket(empresaObrigatoria(ctx), ctx.usuarioId, params.id, params.ticketId),
  );
}

export async function desvincularTicket({
  params,
  ctx,
}: Entrada<undefined, undefined, { id: number; ticketId: number }>) {
  return ok(
    await service.desvincularTicket(empresaObrigatoria(ctx), params.id, params.ticketId),
  );
}

export async function excluirDemanda({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.excluirDemanda(empresaObrigatoria(ctx), params.id));
}

// ── Checklist e comentarios ─────────────────────────────────────────────────

export async function criarItem({ body, params, ctx }: Entrada<ItemBody, undefined, IdParam>) {
  return created(
    await service.criarItem(empresaObrigatoria(ctx), ctx.usuarioId, params.id, body.descricao),
  );
}

export async function alternarItem({
  body,
  params,
  ctx,
}: Entrada<AlternarItemBody, undefined, IdParam>) {
  return ok(await service.alternarItem(empresaObrigatoria(ctx), params.id, body.feito));
}

export async function excluirItem({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.excluirItem(empresaObrigatoria(ctx), params.id));
}

export async function comentar({ body, params, ctx }: Entrada<ComentarioBody, undefined, IdParam>) {
  return created(
    await service.comentar(empresaObrigatoria(ctx), ctx.usuarioId, params.id, body.texto),
  );
}

export async function anexar({ body, params, ctx }: Entrada<AnexoBody, undefined, IdParam>) {
  return created(await service.anexar(empresaObrigatoria(ctx), ctx.usuarioId, params.id, body));
}

export async function excluirAnexo({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.excluirAnexo(empresaObrigatoria(ctx), params.id));
}

// ── Ponte com o dinheiro ────────────────────────────────────────────────────

export async function gerarTicketDoProjeto({
  body,
  params,
  ctx,
}: Entrada<GerarTicketBody, undefined, IdParam>) {
  return created(
    await service.gerarTicketDoProjeto(
      empresaObrigatoria(ctx),
      ctx.usuarioId,
      params.id,
      centavos(body.valor),
      body.titulo ?? null,
    ),
  );
}

export async function gerarTicketDasDemandas({
  body,
  params,
  ctx,
}: Entrada<CobrarDemandasBody, undefined, IdParam>) {
  return created(
    await service.gerarTicketDasDemandas(
      empresaObrigatoria(ctx),
      ctx.usuarioId,
      params.id,
      body.demandas,
    ),
  );
}
