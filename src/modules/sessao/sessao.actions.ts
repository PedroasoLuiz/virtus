"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import { COOKIE_EMPRESA } from "@/shared/auth/contexto";
import { serverEnv } from "@/infra/config/env";
import * as service from "@/modules/sessao/sessao.service";
import * as repo from "@/modules/sessao/sessao.repository";
import type { PedidoDeExclusao } from "@/modules/sessao/sessao.repository";
import {
  alterarSenhaSchema,
  editarPerfilSchema,
  loginSchema,
  selecionarEmpresaSchema,
  trocarEmailSchema,
} from "@/modules/sessao/sessao.schema";

/**
 * Fronteira HTTP do modulo de sessao.
 *
 * Server Actions em vez de route handlers porque login precisa gravar cookie e
 * redirecionar no mesmo passo — e a Action faz isso sem round-trip de JSON.
 * O papel e o mesmo de um controller: validar, chamar o servico, traduzir o
 * resultado. Nenhuma regra de negocio aqui.
 */

export type EstadoFormulario = { erro: string | null };

const TRINTA_DIAS = 60 * 60 * 24 * 30;

export async function loginAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const entrada = loginSchema.safeParse({
    email: form.get("email"),
    senha: form.get("senha"),
  });

  if (!entrada.success) {
    return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos" };
  }

  let destino: string;

  try {
    const resultado = await service.entrar(entrada.data.email, entrada.data.senha);

    if (resultado.proximo === "app") {
      await gravarEmpresa(resultado.empresaId);
      destino = "/";
    } else if (resultado.proximo === "portal") {
      // Sem gravar empresa: o portal nao tem tenant ativo, ele responde por
      // cliente. Gravar uma empresa aqui daria ao externo um cookie de tenant
      // que ele nao deveria carregar.
      destino = "/portal";
    } else {
      destino = "/selecionar-empresa";
    }
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };

    logger.error("falha inesperada no login", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel entrar agora. Tente novamente." };
  }

  // `redirect` lanca uma excecao de controle do Next: precisa ficar FORA do
  // try/catch, senao o catch acima a engoliria e o login travaria na tela.
  redirect(destino);
}

export async function selecionarEmpresaAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const entrada = selecionarEmpresaSchema.safeParse({ empresaId: form.get("empresaId") });

  if (!entrada.success) {
    return { erro: "Selecione uma empresa" };
  }

  try {
    const usuario = await service.usuarioLogado();
    if (!usuario) return { erro: "Sessao expirada. Entre novamente." };

    await service.escolherEmpresa(usuario.id, entrada.data.empresaId);
    await gravarEmpresa(entrada.data.empresaId);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao selecionar empresa", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel trocar de empresa." };
  }

  redirect("/");
}

/**
 * Salva o nome do proprio usuario.
 *
 * ⚠️ `revalidatePath("/", "layout")` porque o nome aparece na CASCA — no avatar
 * do topo e no cartao do perfil, que sao renderizados no layout. Sem isso, a
 * pessoa salvava e continuava vendo o nome velho ate recarregar a pagina.
 */
export async function editarPerfilAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const entrada = editarPerfilSchema.safeParse({
    nome: form.get("nome"),
    nascimento: form.get("nascimento"),
    whatsapp: form.get("whatsapp"),
    instagram: form.get("instagram"),
    pronome: form.get("pronome"),
    funcao: form.get("funcao"),
  });
  if (!entrada.success) {
    return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos" };
  }

  try {
    const usuario = await service.usuarioLogado();
    if (!usuario) return { erro: "Sessao expirada. Entre novamente." };

    await service.editarPerfil(usuario.id, entrada.data);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao editar perfil", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel salvar agora." };
  }

  revalidatePath("/", "layout");
  return { erro: null };
}

/**
 * Troca a foto de perfil, ou a remove.
 *
 * ⚠️ `revalidatePath("/", "layout")` porque o avatar mora na CASCA. Sem isso, a
 * pessoa escolhe a foto e continua vendo as iniciais ate recarregar.
 */
export async function trocarFotoAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const arquivo = form.get("foto");

  try {
    const usuario = await service.usuarioLogado();
    if (!usuario) return { erro: "Sessao expirada. Entre novamente." };

    if (arquivo instanceof File && arquivo.size > 0) {
      await service.trocarFoto(usuario.id, arquivo);
    } else {
      await service.removerFoto(usuario.id);
    }
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao trocar a foto", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel salvar a foto agora." };
  }

  revalidatePath("/", "layout");
  return { erro: null };
}

export async function alterarSenhaAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const entrada = alterarSenhaSchema.safeParse({
    atual: form.get("atual"),
    nova: form.get("nova"),
  });

  if (!entrada.success) {
    return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos" };
  }

  try {
    const usuario = await service.usuarioLogado();
    if (!usuario) return { erro: "Sessao expirada. Entre novamente." };

    await service.alterarSenha(usuario.email, entrada.data.atual, entrada.data.nova);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao alterar senha", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel alterar a senha agora." };
  }

  return { erro: null };
}

/**
 * Pede a troca do e-mail de acesso.
 *
 * ⚠️ `revalidatePath` mesmo sem o e-mail ter mudado.
 *
 * O endereco da conta continua sendo o antigo ate os dois links serem abertos,
 * mas o Auth passou a guardar o PENDENTE (`new_email`), e a gaveta mostra esse
 * pendente num campo bloqueado. Sem recarregar a casca, a pessoa pediria a troca
 * e o campo so apareceria na proxima visita, como se o pedido nao tivesse saido.
 */
export async function trocarEmailAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const entrada = trocarEmailSchema.safeParse({ novo: form.get("novo") });

  if (!entrada.success) {
    return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos" };
  }

  try {
    const usuario = await service.usuarioLogado();
    if (!usuario) return { erro: "Sessao expirada. Entre novamente." };

    await service.pedirTrocaDeEmail(
      usuario.email,
      entrada.data.novo,
      `${serverEnv().APP_URL}/login`,
    );
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao pedir troca de e-mail", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel pedir a troca agora." };
  }

  revalidatePath("/", "layout");
  return { erro: null };
}

/**
 * O ultimo pedido de exclusao desta pessoa.
 *
 * ⚠️ Acao de LEITURA, chamada so quando a aba abre. Levar isto para a sessao
 * custaria uma consulta em toda abertura de tela para um dado que quase ninguem
 * olha.
 */
export async function meuPedidoDeExclusaoAction(): Promise<PedidoDeExclusao | null> {
  const usuario = await service.usuarioLogado();
  if (!usuario) return null;

  try {
    return await repo.pedidoDeExclusao(usuario.id);
  } catch (err) {
    logger.error("falha ao ler o pedido de exclusao", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Abre o pedido de exclusao de dados (LGPD).
 *
 * ⚠️ Nao apaga nada. O que ela faz e registrar o pedido, com data, para alguem
 * responder: a pessoa assina lancamento fiscal que a empresa e obrigada a
 * guardar, e um botao que apagasse na hora deixaria movimentacao de dinheiro sem
 * autor.
 */
export async function pedirExclusaoAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const motivo = String(form.get("motivo") ?? "").trim() || null;

  try {
    const usuario = await service.usuarioLogado();
    if (!usuario) return { erro: "Sessao expirada. Entre novamente." };

    await service.pedirExclusaoDeDados(usuario.id, motivo);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao pedir exclusao de dados", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel registrar o pedido agora." };
  }

  revalidatePath("/", "layout");
  return { erro: null };
}

/**
 * Assume outra empresa e NAO redireciona.
 *
 * ⚠️ Existe separada de `selecionarEmpresaAction` por causa de quem a chama.
 *
 * Aquela nasceu para o formulario da tela de selecao, onde o `redirect` no fim e
 * o que leva a pessoa para dentro do sistema. Chamada de dentro de um menu ou de
 * uma gaveta, com `await` direto, o redirecionamento volta para o cliente como
 * uma resposta que ele nao esperava daquela chamada e a tela quebra com "an
 * unexpected response was received from the server".
 *
 * Aqui a acao so grava o cookie e responde. Quem chamou decide o que fazer
 * depois, que no caso e recarregar a tela em que a pessoa ja estava.
 */
export async function assumirEmpresaAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const entrada = selecionarEmpresaSchema.safeParse({ empresaId: form.get("empresaId") });
  if (!entrada.success) return { erro: "Selecione uma empresa" };

  try {
    const usuario = await service.usuarioLogado();
    if (!usuario) return { erro: "Sessao expirada. Entre novamente." };

    await service.escolherEmpresa(usuario.id, entrada.data.empresaId);
    await gravarEmpresa(entrada.data.empresaId);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao assumir empresa", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Nao foi possivel trocar de empresa." };
  }

  /* A empresa ativa decide o que TODA tela mostra: o cache do layout e de tudo
     que ele carregou precisa cair junto com o cookie. */
  revalidatePath("/", "layout");
  return { erro: null };
}

export async function logoutAction(): Promise<void> {
  await service.sair();
  const store = await cookies();
  store.delete(COOKIE_EMPRESA);
  redirect("/login");
}

export async function recuperarSenhaAction(
  _anterior: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { erro: "Informe o e-mail" };

  try {
    await service.recuperarSenha(email, `${serverEnv().APP_URL}/login`);
  } catch (err) {
    logger.error("falha ao enviar recuperacao", {
      erro: err instanceof Error ? err.message : String(err),
    });
  }

  // Mensagem identica com e-mail existente ou nao — ver sessao.service.
  return { erro: null };
}

async function gravarEmpresa(empresaId: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_EMPRESA, String(empresaId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRINTA_DIAS,
  });
}
