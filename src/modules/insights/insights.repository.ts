import { serverClient } from "@/infra/supabase/client";
import type { MetaConexaoRow } from "@/infra/supabase/database.types";
import { primeiroPreenchido } from "@/shared/utils/texto";
import type { Acesso, Conexao, Pagina } from "@/modules/insights/insights.types";

/**
 * Unica porta de acesso as conexoes com a Meta.
 *
 * ⚠️ O TOKEN nunca sai daqui em struct de dominio. Ele e lido por funcao propria
 * e usado na mesma requisicao. Devolve-lo junto do acesso o faria viajar por
 * service, controller e schema, e bastaria um schema de saida esquecido para ele
 * chegar ao navegador.
 *
 * ⚠️ O segredo mora no ACESSO, e nao na conexao. Uma copia por conta de anuncio
 * — que era o modelo anterior — fazia a renovacao alcancar so a conta que alguem
 * abrisse, e as outras venciam com a copia velha.
 */

const COLUNAS = 'id, "adAccountId", nome, "fkCliente", "fkAcesso", ativo';

export async function listar(empresaId: number): Promise<Conexao[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("metaconexoes")
    .select(COLUNAS)
    .eq("fkEmpresa", empresaId)
    .order("nome", { ascending: true });

  if (error) throw error;

  /*
   * O nome do cliente vem em consulta PROPRIA, e nao por embed.
   *
   * `database.types.ts` e escrito a mao e declara `Relationships: []`, entao o
   * cliente do Supabase nao resolve o vinculo e o resultado inteiro perde o
   * tipo. Uma consulta a mais numa lista curta e barata.
   */
  const nomes = await nomesDosClientes((data ?? []).map((c) => c.fkCliente));

  return (data ?? []).map((c) => ({
    id: c.id,
    adAccountId: c.adAccountId,
    nome: c.nome,
    clienteId: c.fkCliente,
    clienteNome: c.fkCliente == null ? null : (nomes.get(c.fkCliente) ?? null),
    acessoId: c.fkAcesso,
    ativo: c.ativo,
  }));
}

export async function listarAcessos(empresaId: number): Promise<Acesso[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("metaacessos")
    .select('id, nome, "expiraEm", ativo')
    .eq("fkEmpresa", empresaId)
    .order("id", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    expiraEm: a.expiraEm,
    ativo: a.ativo,
  }));
}

export async function buscarAcesso(empresaId: number, id: number): Promise<Acesso | null> {
  const acessos = await listarAcessos(empresaId);
  return acessos.find((a) => a.id === id) ?? null;
}

async function nomesDosClientes(ids: (number | null)[]): Promise<Map<number, string | null>> {
  const alvos = [...new Set(ids.filter((i): i is number => i != null))];
  const mapa = new Map<number, string | null>();
  if (alvos.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao, nomefantasia")
    .in("id", alvos);

  if (error) throw error;
  for (const c of data ?? []) {
    mapa.set(c.id, primeiroPreenchido(c.nomefantasia, c.razao));
  }
  return mapa;
}

export async function buscarPorId(empresaId: number, id: number): Promise<Conexao | null> {
  const conexoes = await listar(empresaId);
  return conexoes.find((c) => c.id === id) ?? null;
}

/**
 * O token de um acesso, para uso IMEDIATO no servidor.
 *
 * ⚠️ Passa pela funcao `SECURITY DEFINER` do banco, que confere o tenant antes de
 * decifrar. O papel da aplicacao nao tem acesso ao vault — e nao deve ter: dando
 * acesso direto, qualquer acesso de qualquer empresa viraria legivel.
 */
export async function tokenDoAcesso(acessoId: number): Promise<string | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("meta_token_do_acesso", {
    p_acesso: acessoId,
  });

  if (error) throw error;
  return (data as string | null) ?? null;
}

/**
 * Cria ou renova um acesso, com o segredo no vault.
 *
 * ⚠️ Uma chamada so, do lado do banco. Gravando a linha aqui e o segredo depois,
 * uma falha no meio deixaria acesso sem token — que aparece na lista e falha em
 * toda consulta, sem dizer por que.
 *
 * ⚠️ `acessoId` preenchido SUBSTITUI o segredo no lugar, e e isso que faz a
 * renovacao valer para todas as contas daquele acesso de uma vez.
 */
export async function guardarAcesso(
  empresaId: number,
  entrada: { acessoId: number | null; nome: string | null; token: string; expiraEm: string | null },
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("meta_guardar_acesso", {
    p_empresa: empresaId,
    p_acesso: entrada.acessoId,
    p_nome: entrada.nome,
    p_token: entrada.token,
    p_expira: entrada.expiraEm,
  });

  if (error) throw error;
  return Number(data);
}

/** Liga uma conta de anuncio a um acesso. Sem segredo: ele mora no acesso. */
export async function ligarConta(
  empresaId: number,
  acessoId: number,
  conta: { adAccountId: string; nome: string | null; clienteId: number | null },
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("meta_ligar_conta", {
    p_empresa: empresaId,
    p_acesso: acessoId,
    p_conta: conta.adAccountId,
    p_nome: conta.nome,
    p_cliente: conta.clienteId,
  });

  if (error) throw error;
  return Number(data);
}

/**
 * Muda o que NAO e segredo numa conexao: cliente e se esta ativa.
 *
 * ⚠️ Nao existe caminho para trocar token por aqui, e o nome tambem nao se edita:
 * ele e o da Meta e se atualiza sozinho ao buscar contas.
 */
export async function atualizar(
  empresaId: number,
  id: number,
  mudancas: { clienteId?: number | null; ativo?: boolean },
): Promise<void> {
  const supabase = await serverClient();

  const patch: Partial<MetaConexaoRow> = { updated_at: new Date().toISOString() };
  if ("clienteId" in mudancas) patch.fkCliente = mudancas.clienteId;
  if ("ativo" in mudancas) patch.ativo = mudancas.ativo;

  const { error } = await supabase
    .from("metaconexoes")
    .update(patch)
    // ⚠️ A RLS ja recorta por empresa; o filtro repete isso de proposito. Uma
    // policy afrouxada um dia nao pode virar edicao de conexao alheia.
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/** As Paginas ligadas, com o Instagram de cada uma. */
export async function listarPaginas(empresaId: number): Promise<Pagina[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("metapaginas")
    .select('id, "pageId", nome, "igUserId", "igUsername", "fkCliente", "fkAcesso", ativo')
    .eq("fkEmpresa", empresaId)
    .order("nome", { ascending: true });

  if (error) throw error;

  const nomes = await nomesDosClientes((data ?? []).map((p) => p.fkCliente));

  return (data ?? []).map((p) => ({
    id: p.id,
    pageId: p.pageId,
    nome: p.nome,
    igUserId: p.igUserId,
    igUsername: p.igUsername,
    clienteId: p.fkCliente,
    clienteNome: p.fkCliente == null ? null : (nomes.get(p.fkCliente) ?? null),
    acessoId: p.fkAcesso,
    ativo: p.ativo,
  }));
}

/** Liga uma Pagina a um acesso. Sem segredo: o token da Pagina e derivado na hora. */
export async function ligarPagina(
  empresaId: number,
  acessoId: number,
  pagina: {
    pageId: string;
    nome: string | null;
    igUserId: string | null;
    igUsername: string | null;
    clienteId: number | null;
  },
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("meta_ligar_pagina", {
    p_empresa: empresaId,
    p_acesso: acessoId,
    p_page: pagina.pageId,
    p_nome: pagina.nome,
    p_ig_user: pagina.igUserId,
    p_ig_user_name: pagina.igUsername,
    p_cliente: pagina.clienteId,
  });

  if (error) throw error;
  return Number(data);
}
