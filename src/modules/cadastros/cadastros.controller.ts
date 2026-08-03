import type { Entrada } from "@/shared/http/handler";
import { created, noContent, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/cadastros/cadastros.service";
import {
  centroSchema,
  servicoSchema,
  type AtualizarCentroBody,
  type AtualizarServicoBody,
  type CriarCentroBody,
  type CriarServicoBody,
  type IdParam,
} from "@/modules/cadastros/cadastros.schema";

/** Traduz HTTP <-> servico. */

// ── Servicos ────────────────────────────────────────────────────────────────

export async function listarServicos({ ctx }: Entrada<undefined, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const servicos = await service.listarServicos(empresaId);
  return ok(servicos.map((s) => servicoSchema.parse(s)));
}

export async function criarServico({ body, ctx }: Entrada<CriarServicoBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const servico = await service.criarServico(empresaId, ctx.usuarioId, {
    ...body,
    valor: centavos(body.valor),
  });
  return created(servicoSchema.parse(servico));
}

export async function atualizarServico({
  body,
  params,
  ctx,
}: Entrada<AtualizarServicoBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const servico = await service.atualizarServico(empresaId, ctx.usuarioId, params.id, {
    ...body,
    valor: body.valor === undefined ? undefined : centavos(body.valor),
  });
  return ok(servicoSchema.parse(servico));
}

export async function excluirServico({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.excluirServico(empresaId, params.id);
  return noContent();
}

// ── Centro de custo ─────────────────────────────────────────────────────────

export async function listarCentros({ ctx }: Entrada<undefined, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const centros = await service.listarCentros(empresaId);
  return ok(centros.map((c) => centroSchema.parse(c)));
}

export async function criarCentro({ body, ctx }: Entrada<CriarCentroBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const centro = await service.criarCentro(empresaId, ctx.usuarioId, body);
  return created(centroSchema.parse(centro));
}

export async function atualizarCentro({
  body,
  params,
  ctx,
}: Entrada<AtualizarCentroBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const centro = await service.atualizarCentro(empresaId, ctx.usuarioId, params.id, body);
  return ok(centroSchema.parse(centro));
}
