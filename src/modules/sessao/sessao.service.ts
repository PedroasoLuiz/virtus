import { ForbiddenError, UnauthorizedError } from "@/shared/errors/app-error";
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

  const nome = await repo.nomeDoUsuario(auth.usuario.id);
  const usuario: UsuarioAutenticado = { ...auth.usuario, nome };

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

export async function usuarioLogado(): Promise<UsuarioAutenticado | null> {
  const usuario = await repo.usuarioAtual();
  if (!usuario) return null;
  return { ...usuario, nome: await repo.nomeDoUsuario(usuario.id) };
}

export async function recuperarSenha(email: string, redirectTo: string): Promise<void> {
  // Sempre retorna sucesso, mesmo para e-mail inexistente: confirmar quais
  // e-mails existem seria um oraculo de enumeracao de usuarios.
  await repo.enviarRecuperacaoDeSenha(email, redirectTo);
}
