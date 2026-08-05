import { anonClient, serverClient } from "@/infra/supabase/client";
import { CONFIG_IA_PADRAO, type ConfigIA, type CredencialIA } from "@/modules/ia/ia.types";

/** Unica porta de acesso aos dados de configuracao de IA. */

export async function buscarConfig(empresaId: number): Promise<ConfigIA> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("ia_config_da_empresa", {
    p_empresa: empresaId,
  });

  if (error) throw error;

  const linha = data?.[0];
  if (!linha) return CONFIG_IA_PADRAO;

  /*
   * `?? null` em tudo que pode faltar.
   *
   * O PostgREST guarda o desenho das funcoes em cache. Recriar uma delas com
   * coluna nova faz a chamada voltar SEM essa coluna ate o cache recarregar, e
   * ai o campo chega `undefined` — que o Zod recusa, porque `nullable` aceita
   * nulo e nao ausencia. O sintoma vira "Dados invalidos" num lugar que nao tem
   * nada de invalido.
   */
  return {
    provedor: "gemini",
    modelo: linha.modelo ?? CONFIG_IA_PADRAO.modelo,
    ativo: linha.ativo ?? false,
    temChave: linha.tem_chave ?? false,
    numeroTeste: linha.numero_teste ?? null,
  };
}

export async function salvarConfig(
  empresaId: number,
  entrada: {
    modelo: string;
    ativo: boolean;
    chave: string | null;
    numeroTeste: string | null;
  },
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("ia_salvar_config", {
    p_empresa: empresaId,
    p_modelo: entrada.modelo,
    p_ativo: entrada.ativo,
    p_chave: entrada.chave,
    p_numero_teste: entrada.numeroTeste,
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
export async function credencial(
  segredo: string,
  empresaId: number,
): Promise<CredencialIA | null> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("ia_credencial", {
    p_segredo: segredo,
    p_empresa: empresaId,
  });

  if (error) throw error;

  const linha = data?.[0];
  if (!linha) return null;

  return {
    provedor: "gemini",
    modelo: linha.modelo,
    chave: linha.chave,
    numeroTeste: linha.numero_teste,
  };
}
