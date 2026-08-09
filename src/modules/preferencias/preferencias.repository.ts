import { serverClient } from "@/infra/supabase/client";
import { ehVisao, VISAO_PADRAO, type Visao } from "@/modules/preferencias/preferencias.types";

/**
 * Unica porta de acesso a `usuariopreferencias`.
 *
 * A RLS escopa pelo proprio `auth.uid()`, entao nenhuma consulta aqui precisa
 * filtrar por usuario: a policy ja o faz, e um filtro a mais so daria a
 * impressao de que ela e opcional.
 */

export async function visaoDoUsuario(): Promise<Visao> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuariopreferencias")
    .select("visao")
    .maybeSingle();

  /*
   * ⚠️ Falha em silencio, e devolve o padrao.
   *
   * Preferencia de interface nao derruba tela: sem ela a pagina abre em tabela,
   * que e o que acontecia antes de existir preferencia nenhuma. Propagar o erro
   * faria uma listagem inteira deixar de carregar por causa de um gosto.
   */
  if (error || !data) return VISAO_PADRAO;

  return ehVisao(data.visao) ? data.visao : VISAO_PADRAO;
}

export async function gravarVisao(usuarioId: string, visao: Visao): Promise<void> {
  const supabase = await serverClient();

  // Upsert porque a linha so nasce no primeiro clique: quem nunca trocou de
  // visao nao tem preferencia gravada, e um UPDATE ali nao acertaria nada.
  const { error } = await supabase
    .from("usuariopreferencias")
    .upsert({ fkUser: usuarioId, visao, updated_at: new Date().toISOString() });

  if (error) throw error;
}
