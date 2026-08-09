import type { Entrada } from "@/shared/http/handler";
import { noContent, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { centavos } from "@/shared/utils/money";
import * as service from "@/modules/conciliacao/conciliacao.service";
import type {
  ConciliarBody,
  ContaParam,
  DesfazerBody,
  ImportarBody,
  LoteBody,
  PeriodoQuery,
} from "@/modules/conciliacao/conciliacao.schema";

/** Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui. */

export async function painel({ params, query, ctx }: Entrada<undefined, PeriodoQuery, ContaParam>) {
  const empresaId = empresaObrigatoria(ctx);
  return ok(await service.painel(empresaId, params.id, query.de, query.ate));
}

export async function importar({ body, params, ctx }: Entrada<ImportarBody, undefined, ContaParam>) {
  const empresaId = empresaObrigatoria(ctx);

  return ok(
    await service.importar(
      empresaId,
      params.id,
      body.linhas.map((l) => ({ ...l, valor: centavos(l.valor) })),
    ),
  );
}

export async function conciliar({ body, params, ctx }: Entrada<ConciliarBody, undefined, ContaParam>) {
  const empresaId = empresaObrigatoria(ctx);
  await service.conciliar(empresaId, params.id, body.linhaId, body.pagamentoId);
  return noContent();
}

export async function desfazer({ body, ctx }: Entrada<DesfazerBody, undefined, ContaParam>) {
  await service.desfazer(empresaObrigatoria(ctx), body.linhaId);
  return noContent();
}

export async function conciliarVarios({
  body,
  params,
  ctx,
}: Entrada<LoteBody, undefined, ContaParam>) {
  const empresaId = empresaObrigatoria(ctx);
  return ok({ conciliadas: await service.conciliarVarios(empresaId, params.id, body.pares) });
}
