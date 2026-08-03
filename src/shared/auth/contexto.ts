import { cookies } from "next/headers";
import { supabaseConfigurado } from "@/infra/config/env";
import { serverClient } from "@/infra/supabase/client";
import { AppError, ForbiddenError, UnauthorizedError } from "@/shared/errors/app-error";
import { buscarAcesso, type Acesso } from "@/shared/auth/acesso.repository";
import { modulosDaEmpresa } from "@/modules/plataforma/plataforma.service";
import type { Modulo } from "@/modules/plataforma/plataforma.types";

/**
 * Contexto da requisicao: quem e o usuario, em qual empresa ele esta operando e
 * a quais produtos essa empresa tem direito.
 *
 * Vive em `shared/` e nao num modulo porque e transversal: nao existe operacao
 * no sistema que dispense tenant. Nenhum modulo e dono dele. O modulo
 * `plataforma` cuida do CRUD de produtos e assinaturas e reusa o mesmo
 * repositorio de acesso — a regra continua sendo uma so implementacao.
 */

export const COOKIE_EMPRESA = "vpay_empresa";

export type Contexto = {
  usuarioId: string;
  email: string;
  /** Empresa ativa. Null so em rota publica ou antes de escolher a empresa. */
  empresaId: number | null;
  /** Modulos liberados pelo plano da empresa ativa. */
  modulos: Modulo[];
};

export const CONTEXTO_ANONIMO: Contexto = {
  usuarioId: "",
  email: "",
  empresaId: null,
  modulos: [],
};

type Opcoes = {
  exigirSessao: boolean;
  /** Modulo exigido pela rota, ex: "financeiro". */
  requerModulo?: Modulo;
};

export async function contextoAtual({ exigirSessao, requerModulo }: Opcoes): Promise<Contexto> {
  if (!supabaseConfigurado) {
    // Falha explicita e distinguivel de "credencial errada": o operador precisa
    // saber que falta configuracao, nao ficar caçando um bug de login.
    throw new AppError(
      "INTERNAL",
      503,
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (exigirSessao) throw new UnauthorizedError();
    return CONTEXTO_ANONIMO;
  }

  const empresaId = await empresaSelecionada();
  const acesso = empresaId ? await buscarAcesso(user.id, empresaId) : null;

  if (empresaId && !acesso) {
    // Cookie aponta para empresa que o usuario nao acessa (ou nao existe).
    // Tratado como 403 e nao 404 de proposito: nao confirmamos a existencia
    // de uma empresa de outro tenant.
    throw new ForbiddenError("Sem acesso a esta empresa");
  }

  const ctx: Contexto = {
    usuarioId: user.id,
    email: user.email ?? "",
    empresaId,
    modulos: empresaId ? await modulosDaEmpresa(empresaId) : [],
  };

  if (requerModulo) garantirModulo(ctx, requerModulo);

  return ctx;
}

/** Empresa ativa e requisito de quase toda operacao — este helper evita o `if` repetido. */
export function empresaObrigatoria(ctx: Contexto): number {
  if (ctx.empresaId == null) {
    throw new ForbiddenError("Nenhuma empresa selecionada");
  }
  return ctx.empresaId;
}

export function garantirModulo(ctx: Contexto, modulo: Modulo): void {
  if (!ctx.modulos.includes(modulo)) {
    throw new ForbiddenError(`O plano da empresa nao inclui o modulo "${modulo}"`);
  }
}

async function empresaSelecionada(): Promise<number | null> {
  const store = await cookies();
  const bruto = store.get(COOKIE_EMPRESA)?.value;
  if (!bruto) return null;
  const id = Number(bruto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export type { Acesso };
