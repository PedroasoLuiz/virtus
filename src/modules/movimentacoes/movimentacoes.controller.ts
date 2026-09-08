import type { Entrada } from "@/shared/http/handler";
import { noContent, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { centavos } from "@/shared/utils/money";
import { dadosDaEmpresa } from "@/modules/empresa/empresa.repository";
import * as service from "@/modules/movimentacoes/movimentacoes.service";
import type {
  CriarMovimentacaoBody,
  MovimentacaoParam,
  PeriodoQuery,
} from "@/modules/movimentacoes/movimentacoes.schema";

/** Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui. */

export async function listar({ query, ctx }: Entrada<undefined, PeriodoQuery, undefined>) {
  const empresaId = empresaObrigatoria(ctx);
  return ok(await service.listar(empresaId, query.de, query.ate));
}

export async function criar({ body, ctx }: Entrada<CriarMovimentacaoBody, undefined, undefined>) {
  const empresaId = empresaObrigatoria(ctx);

  /*
   * ⚠️ A RAZAO SOCIAL vai junto: ela e o `nome` das duas pontas, e e o que o
   * extrato mostra como historico.
   *
   * Numa transferencia entre contas proprias quem esta dos dois lados e a
   * propria empresa — nao ha cliente nem fornecedor a nomear. E o mesmo valor
   * que as 55 transferencias ja gravadas trazem.
   */
  const empresa = await dadosDaEmpresa(empresaId);

  const id = await service.criar(
    empresaId,
    ctx.usuarioId,
    { ...body, valor: centavos(body.valor), observacoes: body.observacoes ?? null },
    empresa.razaoSocial ?? "Transferência entre contas",
  );

  return ok({ id });
}

export async function excluir({ params, ctx }: Entrada<undefined, undefined, MovimentacaoParam>) {
  await service.excluir(empresaObrigatoria(ctx), params.id);
  return noContent();
}
