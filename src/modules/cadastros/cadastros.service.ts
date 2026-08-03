import { ConflictError, NotFoundError } from "@/shared/errors/app-error";
import * as repo from "@/modules/cadastros/cadastros.repository";
import type {
  CentroCusto,
  CentroCustoNovo,
  Servico,
  ServicoNovo,
} from "@/modules/cadastros/cadastros.types";

/** Regra de negocio dos cadastros simples. */

// ── Servicos ────────────────────────────────────────────────────────────────

export async function listarServicos(empresaId: number): Promise<Servico[]> {
  return repo.listarServicos(empresaId);
}

export async function obterServico(empresaId: number, id: number): Promise<Servico> {
  const servico = await repo.buscarServico(empresaId, id);
  if (!servico) throw new NotFoundError("Servico nao encontrado");
  return servico;
}

export async function criarServico(
  empresaId: number,
  usuarioId: string,
  entrada: ServicoNovo,
): Promise<Servico> {
  await garantirDescricaoInedita(empresaId, entrada.descricao, null);
  const id = await repo.criarServico(empresaId, usuarioId, entrada);
  return obterServico(empresaId, id);
}

export async function atualizarServico(
  empresaId: number,
  usuarioId: string,
  id: number,
  entrada: Partial<ServicoNovo>,
): Promise<Servico> {
  // Garante que o registro e desta empresa antes de escrever.
  await obterServico(empresaId, id);
  if (entrada.descricao) await garantirDescricaoInedita(empresaId, entrada.descricao, id);

  await repo.atualizarServico(empresaId, id, usuarioId, entrada);
  return obterServico(empresaId, id);
}

export async function excluirServico(empresaId: number, id: number): Promise<void> {
  await obterServico(empresaId, id);
  await repo.excluirServico(empresaId, id);
}

/**
 * Duas linhas com a mesma descricao viram ambiguidade na hora de montar a
 * fatura — quem escolhe o servico nao tem como saber qual e qual.
 */
async function garantirDescricaoInedita(
  empresaId: number,
  descricao: string,
  ignorarId: number | null,
): Promise<void> {
  const existentes = await repo.listarServicos(empresaId);
  const alvo = descricao.trim().toLowerCase();

  if (existentes.some((s) => s.id !== ignorarId && s.descricao.trim().toLowerCase() === alvo)) {
    throw new ConflictError(`Ja existe um servico com a descricao "${descricao}"`);
  }
}

// ── Centro de custo ─────────────────────────────────────────────────────────

export async function listarCentros(empresaId: number): Promise<CentroCusto[]> {
  return repo.listarCentrosDeCusto(empresaId);
}

export async function obterCentro(empresaId: number, id: number): Promise<CentroCusto> {
  const centro = await repo.buscarCentro(empresaId, id);
  if (!centro) throw new NotFoundError("Centro de custo nao encontrado");
  return centro;
}

export async function criarCentro(
  empresaId: number,
  usuarioId: string,
  entrada: CentroCustoNovo,
): Promise<CentroCusto> {
  const id = await repo.criarCentro(empresaId, usuarioId, entrada);
  return obterCentro(empresaId, id);
}

export async function atualizarCentro(
  empresaId: number,
  usuarioId: string,
  id: number,
  entrada: Partial<CentroCustoNovo>,
): Promise<CentroCusto> {
  await obterCentro(empresaId, id);
  await repo.atualizarCentro(empresaId, id, usuarioId, entrada);
  return obterCentro(empresaId, id);
}
