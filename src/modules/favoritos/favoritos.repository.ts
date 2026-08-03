import { serverClient } from "@/infra/supabase/client";

/**
 * Telas fixadas no topo do menu, por usuario e empresa.
 *
 * A policy da tabela restringe a `fkUser = auth.uid()`, entao o proprio banco
 * garante que ninguem le nem escreve favorito de outra pessoa — o repositorio
 * nao precisa filtrar por usuario.
 */

export async function listar(empresaId: number): Promise<string[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("menufavoritos")
    .select("rota")
    .eq("fkEmpresa", empresaId)
    .order("ordem", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((l) => l.rota);
}

export async function favoritar(
  usuarioId: string,
  empresaId: number,
  rota: string,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("menufavoritos")
    .insert({ fkUser: usuarioId, fkEmpresa: empresaId, rota });

  // 23505 = unique violation. Favoritar duas vezes e idempotente, nao erro.
  if (error && error.code !== "23505") throw error;
}

export async function desfavoritar(empresaId: number, rota: string): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("menufavoritos")
    .delete()
    .eq("fkEmpresa", empresaId)
    .eq("rota", rota);

  if (error) throw error;
}
