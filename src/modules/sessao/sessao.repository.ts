import { serverClient } from "@/infra/supabase/client";
import type { EmpresaDoUsuario, UsuarioAutenticado } from "@/modules/sessao/sessao.types";

/**
 * Unica porta de acesso ao Supabase Auth e ao vinculo usuario<->empresa.
 *
 * Usa sempre o `serverClient` (nunca o admin): e ele que grava os cookies de
 * sessao. Trocar por outro client aqui quebraria o login silenciosamente.
 */

export type ErroCredencial = "invalida" | "nao-confirmado" | "bloqueado";

export type ResultadoAutenticacao =
  | { ok: true; usuario: UsuarioAutenticado }
  | { ok: false; motivo: ErroCredencial };

export async function autenticar(email: string, senha: string): Promise<ResultadoAutenticacao> {
  const supabase = await serverClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    // O Supabase devolve "Invalid login credentials" tanto para e-mail
    // inexistente quanto para senha errada — de proposito, para nao permitir
    // enumeracao de usuarios. Mantemos essa indistincao.
    if (error.code === "email_not_confirmed") return { ok: false, motivo: "nao-confirmado" };
    return { ok: false, motivo: "invalida" };
  }

  if (!data.user) return { ok: false, motivo: "invalida" };

  return {
    ok: true,
    usuario: {
      id: data.user.id,
      email: data.user.email ?? email,
      nome: null,
    },
  };
}

export async function encerrar(): Promise<void> {
  const supabase = await serverClient();
  await supabase.auth.signOut();
}

export async function usuarioAtual(): Promise<UsuarioAutenticado | null> {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? "", nome: null };
}

/** Nome de exibicao, da tabela de perfil. Ausencia nao e erro. */
export async function nomeDoUsuario(usuarioId: string): Promise<string | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("nome, ativo")
    .eq("fkUser", usuarioId)
    .maybeSingle();

  if (error || !data) return null;
  return data.nome;
}

/** Empresas as quais o usuario tem acesso. Base do seletor de tenant. */
export async function empresasDoUsuario(usuarioId: string): Promise<EmpresaDoUsuario[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuariosxempresas")
    .select("empresas!inner(id, fantasia, razaosocial, logo, ativo)")
    .eq("fkUser", usuarioId);

  if (error) throw error;

  type LinhaEmpresa = {
    id: number;
    fantasia: string | null;
    razaosocial: string | null;
    logo: string | null;
    ativo: boolean | null;
  };

  const vistas = new Set<number>();

  return (data ?? [])
    .map((linha) => linha.empresas as unknown as LinhaEmpresa)
    .filter((e) => e.ativo !== false)
    // O banco tem vinculo duplicado para alguns usuarios; a tela nao deve
    // mostrar a mesma empresa duas vezes.
    .filter((e) => (vistas.has(e.id) ? false : (vistas.add(e.id), true)))
    .map((e) => ({
      id: e.id,
      nome: e.fantasia ?? e.razaosocial ?? `Empresa ${e.id}`,
      razaoSocial: e.razaosocial,
      logo: e.logo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function enviarRecuperacaoDeSenha(email: string, redirectTo: string): Promise<void> {
  const supabase = await serverClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });
}
