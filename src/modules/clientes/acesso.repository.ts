import { serverClient } from "@/infra/supabase/client";
import type { UsuarioDaPessoa } from "@/modules/clientes/clientes.types";

/** Quem enxerga os dados desta pessoa pelo portal do cliente. */

/**
 * Quem pode ver os dados desta pessoa no portal.
 *
 * ⚠️ `usuarios` e visivel por `usuarios_visiveis()`: um usuario de outra empresa
 * volta sem nome em vez de vazar. A tela mostra o proprio uuid nesse caso, que e
 * feio e honesto.
 */
export async function usuariosDaPessoa(clienteId: number): Promise<UsuarioDaPessoa[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuariosxclientes")
    .select("fkUser")
    .eq("fkCliente", clienteId);

  if (error) throw error;

  const ids = (data ?? []).map((l) => l.fkUser as string);
  if (ids.length === 0) return [];

  const { data: pessoas, error: erroNomes } = await supabase
    .from("usuarios")
    .select("fkUser, nome, email")
    .in("fkUser", ids);

  if (erroNomes) throw erroNomes;

  return ids.map((id) => {
    const u = (pessoas ?? []).find((x) => x.fkUser === id);

    return {
      id,
      nome: (u?.nome as string | null) || null,
      email: (u?.email as string | null) || null,
    };
  });
}

export async function definirUsuariosDaPessoa(
  clienteId: number,
  usuarioId: string,
  usuarios: string[],
): Promise<void> {
  const supabase = await serverClient();

  const tinha = (await usuariosDaPessoa(clienteId)).map((u) => u.id);
  const sair = tinha.filter((id) => !usuarios.includes(id));
  const entrar = usuarios.filter((id) => !tinha.includes(id));

  if (sair.length > 0) {
    const { error } = await supabase
      .from("usuariosxclientes")
      .delete()
      .eq("fkCliente", clienteId)
      .in("fkUser", sair);

    if (error) throw error;
  }

  if (entrar.length > 0) {
    const { error } = await supabase.from("usuariosxclientes").insert(
      entrar.map((id) => ({
        fkCliente: clienteId,
        fkUser: id,
        fkUserCriacao: usuarioId,
      })),
    );

    if (error) throw error;
  }
}
