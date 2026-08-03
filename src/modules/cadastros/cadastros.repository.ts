import { serverClient } from "@/infra/supabase/client";
import type { CentroCustoRow, ServicoRow } from "@/infra/supabase/database.types";
import { doBanco, paraBanco } from "@/shared/utils/money";
import {
  normalizarTipo,
  type CentroCusto,
  type CentroCustoNovo,
  type Servico,
  type ServicoNovo,
} from "@/modules/cadastros/cadastros.types";

/**
 * Unica porta de acesso a servicos e centro de custo.
 *
 * Um repositorio para os dois porque sao a mesma forma de dado. Quando um
 * ganhar regra propria, vira modulo separado.
 */

const COLUNAS_SERVICO = "id, descricao, valor, cnae, fkCentroCusto, ativo, deletado";
const COLUNAS_CENTRO = "id, descricao, tipo, ativo";

// ── Servicos ────────────────────────────────────────────────────────────────

export async function listarServicos(empresaId: number): Promise<Servico[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("servicos")
    .select(COLUNAS_SERVICO)
    .eq("fkEmpresa", empresaId)
    .order("descricao", { ascending: true });

  if (error) throw error;

  // `deletado` e exclusao logica: registro apagado nao volta na listagem.
  return (data ?? []).filter((l) => l.deletado !== true).map(paraServico);
}

export async function buscarServico(empresaId: number, id: number): Promise<Servico | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("servicos")
    .select(COLUNAS_SERVICO)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? paraServico(data) : null;
}

export async function criarServico(
  empresaId: number,
  usuarioId: string,
  entrada: ServicoNovo,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("servicos")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      descricao: entrada.descricao,
      valor: paraBanco(entrada.valor),
      cnae: entrada.cnae ?? null,
      fkCentroCusto: entrada.centroCustoId ?? null,
      ativo: entrada.ativo ?? true,
      deletado: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function atualizarServico(
  empresaId: number,
  id: number,
  usuarioId: string,
  entrada: Partial<ServicoNovo>,
): Promise<void> {
  const supabase = await serverClient();

  const campos: Partial<ServicoRow> = {
    updated_at: new Date().toISOString(),
    fkUserModificacao: usuarioId,
  };
  if (entrada.descricao !== undefined) campos.descricao = entrada.descricao;
  if (entrada.valor !== undefined) campos.valor = paraBanco(entrada.valor);
  if (entrada.cnae !== undefined) campos.cnae = entrada.cnae;
  if (entrada.centroCustoId !== undefined) campos.fkCentroCusto = entrada.centroCustoId;
  if (entrada.ativo !== undefined) campos.ativo = entrada.ativo;

  const { error } = await supabase
    .from("servicos")
    .update(campos)
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/** Exclusao logica: o historico de faturas aponta para o servico. */
export async function excluirServico(empresaId: number, id: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("servicos")
    .update({ deletado: true, ativo: false, updated_at: new Date().toISOString() })
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

// ── Centro de custo ─────────────────────────────────────────────────────────

export async function listarCentrosDeCusto(empresaId: number): Promise<CentroCusto[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("centrodecusto")
    .select(COLUNAS_CENTRO)
    .eq("fkEmpresa", empresaId)
    .order("descricao", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(paraCentro);
}

export async function buscarCentro(empresaId: number, id: number): Promise<CentroCusto | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("centrodecusto")
    .select(COLUNAS_CENTRO)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? paraCentro(data) : null;
}

export async function criarCentro(
  empresaId: number,
  usuarioId: string,
  entrada: CentroCustoNovo,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("centrodecusto")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      descricao: entrada.descricao,
      tipo: entrada.tipo,
      ativo: entrada.ativo ?? true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function atualizarCentro(
  empresaId: number,
  id: number,
  usuarioId: string,
  entrada: Partial<CentroCustoNovo>,
): Promise<void> {
  const supabase = await serverClient();

  const campos: Partial<CentroCustoRow> = {
    updated_at: new Date().toISOString(),
    fkUserModificacao: usuarioId,
  };
  if (entrada.descricao !== undefined) campos.descricao = entrada.descricao;
  if (entrada.tipo !== undefined) campos.tipo = entrada.tipo;
  if (entrada.ativo !== undefined) campos.ativo = entrada.ativo;

  const { error } = await supabase
    .from("centrodecusto")
    .update(campos)
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

// ── Traducao linha -> dominio ───────────────────────────────────────────────

function paraServico(l: Partial<ServicoRow> & { id: number }): Servico {
  return {
    id: l.id,
    descricao: l.descricao ?? "",
    valor: doBanco(l.valor),
    cnae: l.cnae ?? null,
    centroCustoId: l.fkCentroCusto ?? null,
    ativo: l.ativo ?? true,
  };
}

function paraCentro(l: Partial<CentroCustoRow> & { id: number }): CentroCusto {
  return {
    id: l.id,
    descricao: l.descricao ?? "",
    tipo: normalizarTipo(l.tipo ?? null),
    ativo: l.ativo ?? true,
  };
}
