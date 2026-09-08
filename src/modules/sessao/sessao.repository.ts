import { serverClient } from "@/infra/supabase/client";
import { ForbiddenError } from "@/shared/errors/app-error";
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

  /*
   * ⚠️ `new_email` e o endereco que ESPERA confirmacao.
   *
   * Ele vem do proprio Auth (`auth.users.email_change`) e some sozinho quando a
   * troca se conclui ou o link expira. Guardar uma copia disso em `usuarios`
   * seria criar um segundo estado para a mesma coisa, e ele ficaria pendurado
   * para sempre no dia em que a pessoa desistisse.
   */
  return {
    id: user.id,
    email: user.email ?? "",
    nome: null,
    emailPendente: user.new_email ?? null,
  };
}

/** Nome de exibicao, da tabela de perfil. Ausencia nao e erro. */
export async function nomeDoUsuario(usuarioId: string): Promise<string | null> {
  return (await perfilDoUsuario(usuarioId))?.nome ?? null;
}

export type PerfilDoUsuario = {
  nome: string | null;
  /** URL publica da foto. Nula cai nas iniciais. */
  foto: string | null;
  nascimento: string | null;
  whatsapp: string | null;
  instagram: string | null;
  pronome: string | null;
  funcao: string | null;
  ativo: boolean;
  /**
   * Pessoa do CLIENTE, nao da casa.
   *
   * Externo nao administra empresa nenhuma: `empresas_do_usuario()` o ignora de
   * proposito, e o que ele enxerga sao as proprias cobrancas, pelo portal.
   */
  externo: boolean;
  /**
   * Ve as areas ainda EM DESENVOLVIMENTO.
   *
   * ⚠️ Nao e permissao, e ESTAGIO. Suprimentos, Estoque, Social, Plataforma e os
   * Favoritos estao pela metade; o primeiro cliente vai testar o sistema, e o
   * que esta em obra nao pode aparecer no menu dele.
   *
   * ⚠️ NAO substitui o modulo do plano. Social e Estoque continuam presos ao que
   * a empresa assinou; esta marca e um segundo portao, e os dois precisam abrir.
   * O dia em que Social ficar pronto, o que se tira e este portao.
   */
  interno: boolean;
};

export async function perfilDoUsuario(usuarioId: string): Promise<PerfilDoUsuario | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("nome, foto, nascimento, whatsapp, instagram, pronome, funcao, ativo, externo, interno")
    .eq("fkUser", usuarioId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    nome: data.nome,
    foto: data.foto,
    nascimento: data.nascimento,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    pronome: data.pronome,
    funcao: data.funcao,
    ativo: data.ativo ?? true,
    externo: data.externo ?? false,
    /* Na duvida, NAO ve: quem cai aqui sem a coluna preenchida e alguem de
       fora, e mostrar area em obra a um cliente e pior que esconder um atalho
       de quem trabalha na casa. */
    interno: data.interno ?? false,
  };
}

/**
 * Grava o nome que a pessoa escolheu para si.
 *
 * ⚠️ Sob RLS, com o token dela — nunca service role. A policy de `usuarios` e
 * quem garante que ninguem renomeie outra pessoa; o `eq` aqui e clareza de
 * intencao, e nao a protecao.
 */
export type DadosDoPerfil = {
  nome: string;
  nascimento: string | null;
  whatsapp: string | null;
  instagram: string | null;
  pronome: string | null;
  funcao: string | null;
};

export async function salvarPerfil(usuarioId: string, dados: DadosDoPerfil): Promise<void> {
  const supabase = await serverClient();

  /*
   * ⚠️ Pede a linha de volta (`select`) e confere que veio uma.
   *
   * Update barrado por RLS nao e erro no PostgREST: sao zero linhas e silencio.
   * Sem esta conferencia, a tela diria "nome salvo" para uma gravacao que nunca
   * aconteceu — que e o pior dos dois mundos.
   */
  const { data, error } = await supabase
    .from("usuarios")
    .update(dados)
    .eq("fkUser", usuarioId)
    .select("fkUser");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new ForbiddenError("Nao foi possivel salvar o seu cadastro.");
  }
}

/**
 * Pede a troca do e-mail de acesso.
 *
 * ⚠️ NAO troca nada agora: o Supabase manda um link para o endereco NOVO e a
 * troca so acontece quando alguem clica nele. E o que impede tomar a conta de
 * outra pessoa digitando o e-mail dela, e tambem o que impede alguem se trancar
 * para fora com um endereco digitado errado.
 *
 * ⚠️ Quando o Auth finalmente troca, `usuarios.email` acompanha sozinho: ha um
 * gatilho em `auth.users` que espelha a coluna. Nao ha nada a gravar aqui.
 */
export async function pedirTrocaDeEmail(
  novo: string,
  voltarPara: string,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await serverClient();

  const { error } = await supabase.auth.updateUser(
    { email: novo },
    { emailRedirectTo: voltarPara },
  );

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/**
 * Troca a senha da conta.
 *
 * ⚠️ Quem valida a nova senha e o Supabase Auth, e nao nos: a politica de forca
 * mora la, e uma segunda regra aqui divergiria dela no primeiro ajuste.
 */
export async function trocarSenha(nova: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await serverClient();

  const { error } = await supabase.auth.updateUser({ password: nova });

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/** O bucket publico da casa, o mesmo onde vive a marca das empresas. */
const BUCKET = "virtusmind";

/**
 * Sobe a foto e devolve a URL publica.
 *
 * ⚠️ Caminho FIXO por usuario (`Usuarios/<fkUser>/foto.jpg`), com `upsert`.
 *
 * Nome novo a cada troca acumularia uma foto morta por vez que a pessoa mudasse
 * de ideia, e o bucket e publico: elas ficariam acessiveis para sempre. Com
 * caminho fixo, a nova cobre a antiga e nao sobra rastro.
 *
 * ⚠️ A URL leva `?v=` com a hora da subida. O CDN do Storage guarda a resposta
 * pelo caminho, e sem isso a foto trocada continuaria aparecendo a antiga ate o
 * cache expirar — o que, para quem acabou de escolher a imagem, se le como
 * "nao salvou".
 */
export async function subirFoto(usuarioId: string, arquivo: File): Promise<string> {
  const supabase = await serverClient();
  const caminho = `Usuarios/${usuarioId}/foto.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { upsert: true, contentType: "image/jpeg" });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Grava (ou apaga, com `null`) a URL da foto no cadastro. */
export async function definirFoto(usuarioId: string, url: string | null): Promise<void> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuarios")
    .update({ foto: url })
    .eq("fkUser", usuarioId)
    .select("fkUser");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new ForbiddenError("Nao foi possivel salvar a sua foto.");
  }
}

export type PedidoDeExclusao = {
  aberta: boolean;
  abertaEm: string;
  situacao: "ABERTA" | "ATENDIDA" | "RECUSADA";
  resposta: string | null;
};

/**
 * O ultimo pedido de exclusao desta pessoa, se houver.
 *
 * ⚠️ O mais RECENTE, e nao o aberto: um pedido ja respondido tambem precisa
 * aparecer, senao quem foi recusado clica de novo achando que nada aconteceu.
 */
export async function pedidoDeExclusao(usuarioId: string): Promise<PedidoDeExclusao | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("solicitacoesdedados")
    .select("created_at, situacao, resposta")
    .eq("fkUser", usuarioId)
    .eq("tipo", "EXCLUSAO")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    aberta: data.situacao === "ABERTA",
    abertaEm: data.created_at,
    situacao: data.situacao,
    resposta: data.resposta,
  };
}

/**
 * Abre o pedido.
 *
 * ⚠️ `fkUser` NAO vai no corpo: a coluna tem `default auth.uid()` e a policy
 * exige que seja o proprio. Mandando do cliente, o campo viraria uma promessa a
 * conferir; vindo do banco, ele nao tem como estar errado.
 */
export async function abrirPedidoDeExclusao(motivo: string | null): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("solicitacoesdedados")
    .insert({ tipo: "EXCLUSAO", motivo });

  if (error) throw error;
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
