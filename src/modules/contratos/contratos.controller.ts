import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/contratos/contratos.service";
import type {
  AtualizarContratoBody,
  CriarContratoBody,
  IdParam,
} from "@/modules/contratos/contratos.schema";

/** Traduz HTTP <-> servico de contratos. */

export async function obterContrato({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.obterContrato(empresaObrigatoria(ctx), params.id));
}

export async function criarContrato({ body, ctx }: Entrada<CriarContratoBody, undefined, unknown>) {
  return created(
    await service.criarContrato(empresaObrigatoria(ctx), ctx.usuarioId, {
      ...body,
      valor: centavos(body.valor),
    }),
  );
}

export async function atualizarContrato({
  body,
  params,
  ctx,
}: Entrada<AtualizarContratoBody, undefined, IdParam>) {
  return ok(
    await service.atualizarContrato(empresaObrigatoria(ctx), ctx.usuarioId, params.id, {
      ...body,
      valor: body.valor === undefined ? undefined : centavos(body.valor),
    }),
  );
}

export async function gerarCompetencia({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  return ok(await service.gerarCompetencia(empresaObrigatoria(ctx), ctx.usuarioId, params.id));
}
