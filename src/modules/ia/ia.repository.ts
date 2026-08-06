import { anonClient, serverClient } from "@/infra/supabase/client";
import { CONFIG_IA_PADRAO, type ConfigIA, type CredencialIA } from "@/modules/ia/ia.types";

/** Unica porta de acesso aos dados de configuracao de IA. */

export async function listarProvedores(empresaId: number): Promise<ConfigIA[]> {
  const supabase = await serverClient();

  const [{ data, error }, teste] = await Promise.all([
    supabase.rpc("ia_provedores_da_empresa", { p_empresa: empresaId }),
    supabase.rpc("ia_numero_teste", { p_empresa: empresaId }),
  ]);

  if (error) throw error;
  if (teste.error) throw teste.error;

  /*
   * `?? null` em tudo que pode faltar.
   *
   * O PostgREST guarda o desenho das funcoes em cache. Recriar uma delas com
   * coluna nova faz a chamada voltar SEM essa coluna ate o cache recarregar, e
   * ai o campo chega `undefined` — que o Zod recusa, porque `nullable` aceita
   * nulo e nao ausencia. O sintoma vira "Dados invalidos" num lugar que nao tem
   * nada de invalido.
   */
  return (data ?? []).map((l) => ({
    provedor: (l.provedor ?? "gemini") as ConfigIA["provedor"],
    modelo: l.modelo ?? CONFIG_IA_PADRAO.modelo,
    ativo: l.ativo ?? false,
    temChave: l.tem_chave ?? false,
    ordem: l.ordem ?? 1,
    numeroTeste: (teste.data as string | null) ?? null,
  }));
}

export async function salvarProvedor(
  empresaId: number,
  entrada: {
    provedor: string;
    modelo: string;
    ativo: boolean;
    ordem: number;
    chave: string | null;
  },
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("ia_salvar_provedor", {
    p_empresa: empresaId,
    p_provedor: entrada.provedor,
    p_modelo: entrada.modelo,
    p_ativo: entrada.ativo,
    p_ordem: entrada.ordem,
    p_chave: entrada.chave,
  });

  if (error) throw error;
}

export async function salvarNumeroTeste(
  empresaId: number,
  numero: string | null,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("ia_salvar_numero_teste", {
    p_empresa: empresaId,
    p_numero: numero,
  });

  if (error) throw error;
}

/** Marca o principal e renumera os demais, tudo dentro do banco. */
export async function definirPrincipal(empresaId: number, provedor: string): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("ia_definir_principal", {
    p_empresa: empresaId,
    p_provedor: provedor,
  });

  if (error) throw error;
}

export async function removerProvedor(empresaId: number, provedor: string): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("ia_remover_provedor", {
    p_empresa: empresaId,
    p_provedor: provedor,
  });

  if (error) throw error;
}

/**
 * Credencial em claro, para o servidor falar com o provedor.
 *
 * ⚠️ Roda no webhook, que nao tem sessao — por isso o portao e o segredo global,
 * o mesmo que protege a ingestao. Devolve `null` quando a empresa nao tem chave
 * ou desligou o bot, e nesse caso ninguem responde nada.
 */
export async function credenciais(
  segredo: string,
  empresaId: number,
): Promise<CredencialIA[]> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("ia_credenciais", {
    p_segredo: segredo,
    p_empresa: empresaId,
  });

  if (error) throw error;

  return (data ?? []).map((l) => ({
    provedor: l.provedor as CredencialIA["provedor"],
    modelo: l.modelo,
    chave: l.chave,
    numeroTeste: l.numero_teste,
    ordem: l.ordem ?? 1,
  }));
}
