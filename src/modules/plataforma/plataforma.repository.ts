import { serverClient } from "@/infra/supabase/client";
import type { PlanoRow } from "@/infra/supabase/database.types";
import {
  MODULOS,
  type Assinatura,
  type Modulo,
  type Plano,
  type StatusAssinatura,
} from "@/modules/plataforma/plataforma.types";

/**
 * Unica porta de acesso a planos e assinaturas.
 *
 * Traduz linha de tabela em entidade de dominio: as sete colunas `modulo_*`
 * viram uma lista `modulos`, que e como o resto do sistema raciocina.
 */

// String literal unica de proposito: o supabase-js infere o tipo do resultado a
// partir do texto do select, e concatenar com `+` derruba essa inferencia.
const COLUNAS_PLANO =
  "id, nome, descricao, ativo, preco_mensal, preco_anual, destaque, ordem, max_usuarios, max_empresas, max_clientes, max_faturas_mes, max_os_mes, max_storage_mb, modulo_financeiro, modulo_os, modulo_manutencao, modulo_estoque, modulo_crm, modulo_contratos, modulo_chat";

const COLUNAS_ASSINATURA =
  "id, fkEmpresa, fkPlano, status, periodicidade, inicio, fim, trial_fim, cancelada_em";

export async function listarPlanos(): Promise<Plano[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("planos")
    .select(COLUNAS_PLANO)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(paraPlano);
}

export async function buscarPlano(planoId: number): Promise<Plano | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("planos")
    .select(COLUNAS_PLANO)
    .eq("id", planoId)
    .maybeSingle();

  if (error) throw error;
  return data ? paraPlano(data) : null;
}

/**
 * Assinatura vigente da empresa.
 *
 * Nao usa embed do PostgREST (`planos!inner`) de proposito: foi exatamente um
 * embed sem FK correspondente que derrubou a tela antes. Duas consultas custam
 * o mesmo aqui e nao dependem de constraint existir.
 */
export async function assinaturaVigente(empresaId: number): Promise<Assinatura | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("assinaturas")
    .select(COLUNAS_ASSINATURA)
    .eq("fkEmpresa", empresaId)
    .in("status", ["ativa", "trial"])
    .order("inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  if (data.fim && data.fim < hoje) return null;

  const plano = await buscarPlano(data.fkPlano);
  if (!plano) return null;

  return {
    id: data.id,
    empresaId: data.fkEmpresa,
    plano,
    status: data.status as StatusAssinatura,
    periodicidade: data.periodicidade,
    inicio: data.inicio,
    fim: data.fim,
    trialFim: data.trial_fim,
    canceladaEm: data.cancelada_em,
  };
}

/** Plano de menor ordem entre os ativos. Base do padrao — ver o servico. */
export async function planoPadrao(): Promise<Plano | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("planos")
    .select(COLUNAS_PLANO)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? paraPlano(data) : null;
}

export async function atualizarStatus(
  assinaturaId: number,
  status: StatusAssinatura,
  canceladaEm: string | null,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("assinaturas")
    .update({
      status,
      cancelada_em: canceladaEm,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assinaturaId);

  if (error) throw error;
}

// ── Traducao linha -> dominio ───────────────────────────────────────────────

function paraPlano(linha: Partial<PlanoRow> & { id: number; nome: string }): Plano {
  // As colunas `modulo_*` sao lidas dinamicamente: acrescentar um modulo novo
  // ao banco exige apenas uma entrada em MODULOS, sem mexer aqui.
  const registro = linha as unknown as Record<string, unknown>;
  const modulos = MODULOS.filter((m) => registro[`modulo_${m}`] === true) as Modulo[];

  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao ?? null,
    precoMensal: linha.preco_mensal ?? null,
    precoAnual: linha.preco_anual ?? null,
    destaque: linha.destaque ?? false,
    ordem: linha.ordem ?? 0,
    modulos,
    limites: {
      usuarios: linha.max_usuarios ?? null,
      empresas: linha.max_empresas ?? null,
      clientes: linha.max_clientes ?? null,
      faturasMes: linha.max_faturas_mes ?? null,
      osMes: linha.max_os_mes ?? null,
      storageMb: linha.max_storage_mb ?? null,
    },
  };
}
