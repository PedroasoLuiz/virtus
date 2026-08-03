"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import { COOKIE_EMPRESA } from "@/shared/auth/contexto";
import { serverEnv } from "@/infra/config/env";
import * as service from "@/modules/sessao/sessao.service";
import { loginSchema, selecionarEmpresaSchema } from "@/modules/sessao/sessao.schema";

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
