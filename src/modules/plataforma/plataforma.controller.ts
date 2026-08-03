import type { Entrada } from "@/shared/http/handler";
import { ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/plataforma/plataforma.service";

/** Traduz HTTP <-> servico. */

export async function planoAtual({ ctx }: Entrada<undefined, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const entitlements = await service.entitlementsDaEmpresa(empresaId);

  return ok({
    plano: entitlements.plano && {
      nome: entitlements.plano.nome,
      modulos: entitlements.plano.modulos,
      limites: entitlements.plano.limites,
    },
    modulos: entitlements.modulos,
    usandoPadrao: entitlements.usandoPadrao,
  });
}

export async function listarPlanos() {
  const planos = await service.listarPlanos();
  return ok(
    planos.map((p) => ({
      nome: p.nome,
      descricao: p.descricao,
      precoMensal: p.precoMensal,
      precoAnual: p.precoAnual,
      destaque: p.destaque,
      modulos: p.modulos,
      limites: p.limites,
    })),
  );
}
