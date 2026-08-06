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
    id: l.id,
    nome: l.nome,
    chaveFinal: l.chave_final ?? null,
    provedor: (l.provedor ?? "gemini") as ConfigIA["provedor"],
    modelo: l.modelo ?? CONFIG_IA_PADRAO.modelo,
    ativo: l.ativo ?? false,
    temChave: l.tem_chave ?? false,
    emUso: l.em_uso ?? 0,
    numeroTeste: (teste.data as string | null) ?? null,
  }));
}

export async function salvarProvedor(
  empresaId: number,
  entrada: {
    id: number | null;
    nome: string;
    provedor: string;
    modelo: string;
    ativo: boolean;
    chave: string | null;
  },
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("ia_salvar_provedor", {
    p_empresa: empresaId,
    p_id: entrada.id,
    p_nome: entrada.nome,
    p_provedor: entrada.provedor,
    p_modelo: entrada.modelo,
    p_ativo: entrada.ativo,
    p_chave: entrada.chave,
  });

  if (error) throw error;
}

/**
 * A chave gravada de uma credencial, para testar sem redigitar.
 *
 * ⚠️ Devolve a chave em CLARO. Existe so para a rota de teste fazer a chamada de
 * saida: nunca pode voltar ao navegador nem entrar em log.
 */
export async function chaveParaTeste(
  id: number,
): Promise<{ provedor: string; modelo: string; chave: string } | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("ia_chave_para_teste", { p_id: id });

  if (error) throw error;

  const linha = data?.[0];
  if (!linha) return null;

  return { provedor: linha.provedor, modelo: linha.modelo, chave: linha.chave };
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

export async function removerProvedor(empresaId: number, id: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("ia_remover_provedor", {
    p_empresa: empresaId,
    p_id: id,
  });

  if (error) throw error;
}

/**
 * A credencial em claro desta CONVERSA. Uma, ou nenhuma.
 *
 * ⚠️ Roda no webhook, que nao tem sessao: por isso o portao e o segredo global,
 * o mesmo que protege a ingestao.
 *
 * ⚠️ Parte da conversa, e nao da empresa, porque a chave e do NUMERO. Lista
 * vazia significa numero sem chave, e ai ninguem responde sozinho: cair na chave
 * de outro setor furaria o rateio, que e o motivo de a escolha existir.
 */
export async function credenciaisDaConversa(
  segredo: string,
  conversaId: number,
): Promise<CredencialIA[]> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("ia_credenciais_da_conversa", {
    p_segredo: segredo,
    p_conversa: conversaId,
  });

  if (error) throw error;

  return (data ?? []).map((l) => ({
    provedor: l.provedor as CredencialIA["provedor"],
    modelo: l.modelo,
    chave: l.chave,
  }));
}
