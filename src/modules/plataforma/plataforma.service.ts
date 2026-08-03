import { logger } from "@/shared/utils/logger";
import * as repo from "@/modules/plataforma/plataforma.repository";
import type { Entitlements, Modulo, Plano } from "@/modules/plataforma/plataforma.types";

/** Regra de negocio da plataforma. Nao conhece HTTP nem Supabase. */

/**
 * O que a empresa pode usar hoje.
 *
 * ⚠️ DECISAO A CONFIRMAR: a tabela `assinaturas` esta vazia — nenhuma empresa
 * tem plano. Se falharmos fechado, o sistema inteiro fica inacessivel para
 * todos. Por isso, sem assinatura a empresa cai no plano de menor ordem (hoje
 * "Free", que habilita `financeiro` — exatamente o escopo do VPay), e o
 * resultado vem marcado com `usandoPadrao`, que a UI exibe.
 *
 * Assim que as assinaturas forem cadastradas, trocar este fallback por
 * `modulos: []` e uma tela de "empresa sem plano".
 */
export async function entitlementsDaEmpresa(empresaId: number): Promise<Entitlements> {
  const assinatura = await repo.assinaturaVigente(empresaId);

  if (assinatura) {
    return {
      plano: assinatura.plano,
      modulos: assinatura.plano.modulos,
      assinatura,
      usandoPadrao: false,
    };
  }

  const padrao = await repo.planoPadrao();

  if (!padrao) {
    logger.warn("nenhum plano ativo cadastrado", { empresaId });
    return { plano: null, modulos: [], assinatura: null, usandoPadrao: true };
  }

  return { plano: padrao, modulos: padrao.modulos, assinatura: null, usandoPadrao: true };
}

export async function modulosDaEmpresa(empresaId: number): Promise<Modulo[]> {
  return (await entitlementsDaEmpresa(empresaId)).modulos;
}

/**
 * Catalogo de planos.
 *
 * Lista vazia e estado legitimo (banco novo, ou RLS sem policy), nao erro —
 * lancar aqui derrubava a tela inteira com "Nenhum plano ativo cadastrado". A
 * UI mostra o vazio e explica.
 */
export async function listarPlanos(): Promise<Plano[]> {
  return repo.listarPlanos();
}
