import { ForbiddenError, UnauthorizedError, ValidationError } from "@/shared/errors/app-error";
import * as repo from "@/modules/sessao/sessao.repository";
import type {
  EmpresaDoUsuario,
  ResultadoLogin,
  UsuarioAutenticado,
} from "@/modules/sessao/sessao.types";

/**
 * Regra de negocio da sessao. Nao conhece HTTP nem cookie — quem grava cookie e
 * a camada de acao (`sessao.actions.ts`).
 */

export async function entrar(email: string, senha: string): Promise<ResultadoLogin> {
  const auth = await repo.autenticar(email, senha);

  if (!auth.ok) {
    if (auth.motivo === "nao-confirmado") {
      throw new UnauthorizedError("E-mail ainda nao confirmado. Verifique sua caixa de entrada.");
    }
    throw new UnauthorizedError("E-mail ou senha incorretos.");
  }

  const perfil = await repo.perfilDoUsuario(auth.usuario.id);
  const usuario: UsuarioAutenticado = {
    ...auth.usuario,
    nome: perfil?.nome ?? null,
    externo: perfil?.externo ?? false,
  };

  /*
   * Externo vai para o portal, e a pergunta sobre empresa nem se faz.
   *
   * Ele nao administra empresa nenhuma: `empresas_do_usuario()` o ignora, entao
   * a checagem logo abaixo o barraria com "nao esta vinculado a nenhuma
   * empresa" — verdade tecnica e mentira pratica, porque o acesso dele existe,
   * so nao e por empresa. O escopo dele e por CLIENTE, e quem responde por isso
   * sao as policies do portal.
   */
  if (usuario.externo) {
    return { proximo: "portal", usuario };
  }

  const empresas = await repo.empresasDoUsuario(usuario.id);

  if (empresas.length === 0) {
    // Credencial valida, mas sem tenant: autenticado e nao autorizado. A sessao
    // e encerrada para nao deixar o usuario preso numa casca sem dados.
    await repo.encerrar();
    throw new ForbiddenError(
      "Seu usuario nao esta vinculado a nenhuma empresa. Fale com o administrador.",
    );
  }

  // Com uma empresa so, perguntar seria uma tela a mais sem decisao nenhuma.
  if (empresas.length === 1) {
    return { proximo: "app", usuario, empresaId: empresas[0].id };
  }

  return { proximo: "escolher-empresa", usuario, empresas };
}

export async function sair(): Promise<void> {
  await repo.encerrar();
}

export async function empresasDisponiveis(usuarioId: string): Promise<EmpresaDoUsuario[]> {
  return repo.empresasDoUsuario(usuarioId);
}

/**
 * Valida a troca de empresa antes de gravar o cookie.
 *
 * Sem esta checagem, editar o cookie no navegador daria acesso ao tenant de
 * outra empresa — a RLS barraria a leitura, mas a aplicacao ficaria num estado
 * inconsistente e confuso.
 */
export async function escolherEmpresa(usuarioId: string, empresaId: number): Promise<void> {
  const empresas = await repo.empresasDoUsuario(usuarioId);

  if (!empresas.some((e) => e.id === empresaId)) {
    throw new ForbiddenError("Sem acesso a esta empresa");
  }
}

/** Um quarto de mega: o suficiente para um recorte de 256px em JPEG. */
const TETO_DA_FOTO = 256 * 1024;

/**
 * Troca a foto de perfil.
 *
 * ⚠️ O teto e conferido AQUI tambem, e nao so no navegador. O recorte que a tela
 * faz ja entrega algo pequeno, mas quem chama a acao pode ser qualquer coisa —
 * e um bucket publico sem teto e um deposito de arquivo alheio.
 */
export async function trocarFoto(usuarioId: string, arquivo: File): Promise<string> {
  if (arquivo.size > TETO_DA_FOTO) {
    throw new ValidationError("A imagem ficou grande demais. Recorte de novo.");
  }

  const url = await repo.subirFoto(usuarioId, arquivo);
  await repo.definirFoto(usuarioId, url);
  return url;
}

/**
 * Volta as iniciais.
 *
 * ⚠️ Apaga so o cadastro, e nao o arquivo. O caminho e fixo por usuario: a
 * proxima foto cobre esta, e apagar no storage seria uma segunda chamada que
 * pode falhar sozinha e deixar o cadastro apontando para nada.
 */
export async function removerFoto(usuarioId: string): Promise<void> {
  await repo.definirFoto(usuarioId, null);
}

/**
 * Pede a troca do e-mail de acesso.
 *
 * ⚠️ O que segura esta troca e o LINK, e nao uma senha.
 *
 * O campo e livre, por decisao de produto. Quem confirma e quem abre a caixa do
 * endereco novo: sem esse clique nada muda, e a conta continua entrando pelo
 * e-mail antigo. E por isso que digitar errado nao tranca ninguem do lado de
 * fora, e por isso que apontar para o e-mail de outra pessoa nao toma a conta
 * dela.
 *
 * ⚠️ Recusa trocar para o MESMO endereco. O Supabase aceita e manda o link, e a
 * pessoa fica esperando uma confirmacao que nao muda nada.
 */
export async function pedirTrocaDeEmail(
  emailAtual: string,
  novo: string,
  voltarPara: string,
): Promise<void> {
  if (novo.toLowerCase() === emailAtual.toLowerCase()) {
    throw new ValidationError("Este ja e o seu e-mail.");
  }

  const resultado = await repo.pedirTrocaDeEmail(novo, voltarPara);
  if (!resultado.ok) {
    throw new ValidationError(resultado.erro ?? "Nao foi possivel pedir a troca.");
  }
}

/**
 * Registra o pedido de exclusao de dados do titular.
 *
 * ⚠️ Um pedido aberto por vez. O banco tem indice unico para isso, mas a checagem
 * aqui existe para a pessoa receber uma frase em vez de um erro de duplicidade.
 */
export async function pedirExclusaoDeDados(
  usuarioId: string,
  motivo: string | null,
): Promise<void> {
  const atual = await repo.pedidoDeExclusao(usuarioId);
  if (atual?.aberta) {
    throw new ValidationError("Voce ja tem um pedido em analise.");
  }

  await repo.abrirPedidoDeExclusao(motivo);
}

/** Salva o proprio cadastro: nome e os dados que a pessoa conta sobre si. */
export async function editarPerfil(
  usuarioId: string,
  dados: repo.DadosDoPerfil,
): Promise<void> {
  await repo.salvarPerfil(usuarioId, dados);
}

/**
 * Troca a propria senha, provando a atual.
 *
 * ⚠️ Confere a senha atual REAUTENTICANDO. Nao ha no Supabase um "verifique
 * esta senha" que nao emita sessao; entrar de novo com o mesmo e-mail e o
 * caminho que existe, e ele tem o efeito util de renovar a sessao antes da
 * troca. Se a senha atual estiver errada, nada e alterado.
 */
export async function alterarSenha(
  email: string,
  atual: string,
  nova: string,
): Promise<void> {
  const conferida = await repo.autenticar(email, atual);
  if (!conferida.ok) throw new UnauthorizedError("Senha atual incorreta.");

  const resultado = await repo.trocarSenha(nova);
  if (!resultado.ok) {
    throw new ValidationError(resultado.erro ?? "Nao foi possivel alterar a senha.");
  }
}

export async function usuarioLogado(): Promise<UsuarioAutenticado | null> {
  const usuario = await repo.usuarioAtual();
  if (!usuario) return null;

  const perfil = await repo.perfilDoUsuario(usuario.id);
  return {
    ...usuario,
    nome: perfil?.nome ?? null,
    foto: perfil?.foto ?? null,
    nascimento: perfil?.nascimento ?? null,
    whatsapp: perfil?.whatsapp ?? null,
    instagram: perfil?.instagram ?? null,
    pronome: perfil?.pronome ?? null,
    funcao: perfil?.funcao ?? null,
    externo: perfil?.externo ?? false,
    interno: perfil?.interno ?? false,
  };
}

export async function recuperarSenha(email: string, redirectTo: string): Promise<void> {
  // Sempre retorna sucesso, mesmo para e-mail inexistente: confirmar quais
  // e-mails existem seria um oraculo de enumeracao de usuarios.
  await repo.enviarRecuperacaoDeSenha(email, redirectTo);
}
