import type { Paginacao, Pagina } from "@/shared/utils/paginacao";
import * as repo from "@/modules/contas-pagar/contas-pagar.repository";
import { NotFoundError } from "@/shared/errors/app-error";
import type { ContaPagarResumo, FiltroContas } from "@/modules/contas-pagar/contas-pagar.types";

/** Regra de negocio de contas a pagar. */

export async function listarContas(
  empresaId: number,
  filtro: FiltroContas,
  paginacao: Paginacao,
): Promise<Pagina<ContaPagarResumo>> {
  return repo.listar(empresaId, filtro, paginacao);
}

export async function obterConta(empresaId: number, id: number) {
  const conta = await repo.buscarPorId(empresaId, id);
  if (!conta) throw new NotFoundError("Conta a pagar nao encontrada");
  return conta;
}
