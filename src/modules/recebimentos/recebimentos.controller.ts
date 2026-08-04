import type { Entrada } from "@/shared/http/handler";
import { created, noContent, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { metaDePaginacao } from "@/shared/utils/paginacao";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/recebimentos/recebimentos.service";
import {
  carteiraSchema,
  recebimentoResumoSchema,
  recebimentoSchema,
  type CriarRecebimentoBody,
  type IdParam,
  type ListarQuery,
  type ParcelasAbertasQuery,
} from "@/modules/recebimentos/recebimentos.schema";

/**
 * Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui.
 */

export async function listar({ query, ctx }: Entrada<undefined, ListarQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const { page, perPage, ...filtro } = query;

  const { itens, total } = await service.listarRecebimentos(empresaId, filtro, { page, perPage });

  return ok(
    itens.map((r) => recebimentoResumoSchema.parse(r)),
    metaDePaginacao({ page, perPage }, total),
  );
}

export async function obter({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  return ok(recebimentoSchema.parse(await service.obterRecebimento(empresaId, params.id)));
}

export async function parcelasEmAberto({
  query,
  ctx,
}: Entrada<undefined, ParcelasAbertasQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  return ok(carteiraSchema.parse(await service.carteiraDoCliente(empresaId, query.clienteId)));
}

export async function estornar({ params, ctx }: Entrada<undefined, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.estornarRecebimento(empresaId, ctx.usuarioId, params.id);
  return noContent();
}

export async function criar({ body, ctx }: Entrada<CriarRecebimentoBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);

  const recebimento = await service.registrarRecebimento(empresaId, ctx.usuarioId, {
    clienteId: body.clienteId,
    data: body.data,
    tipo: body.tipo,
    contaBancariaId: body.contaBancariaId,
    observacoes: body.observacoes,
    destinos: body.destinos.map((d) => ({
      parcelaId: d.parcelaId,
      valor: centavos(d.valor),
      juros: centavos(d.juros),
      multa: centavos(d.multa),
      quitar: d.quitar,
    })),
  });

  return created(recebimentoSchema.parse(recebimento));
}
