import { supabaseConfigurado } from "@/infra/config/env";
import { contextoAtual, type Contexto } from "@/shared/auth/contexto";
import { entitlementsDaEmpresa } from "@/modules/plataforma/plataforma.service";
import { empresasDisponiveis, usuarioLogado } from "@/modules/sessao/sessao.service";
import type { Entitlements } from "@/modules/plataforma/plataforma.types";
import { CONTEXTO_DEMO } from "@/shared/demo/dados-demo";

/**
 * Sessao para as telas (Server Components).
 *
 * Difere do `contextoAtual` da API: aqui a ausencia de sessao nao e excecao, e
 * um estado de tela — o middleware ja redirecionou quem nao tem sessao.
 */

export type SessaoUI = {
  ctx: Contexto;
  entitlements: Entitlements;
  empresaNome: string | null;
  usuarioNome: string | null;
  /** Mais de uma empresa disponivel: habilita "trocar de empresa" no menu. */
  podeTrocarEmpresa: boolean;
  /**
   * Pessoa do cliente, nao da casa. Vai para o portal.
   *
   * Fica aqui e nao no `Contexto` porque e decisao de TELA: a API nao precisa
   * saber quem e externo, ja que a RLS responde por cliente sozinha.
   */
  externo: boolean;
  demo: boolean;
};

const SEM_PLANO: Entitlements = {
  plano: null,
  modulos: [],
  assinatura: null,
  usandoPadrao: true,
};

export async function sessaoUI(): Promise<SessaoUI> {
  if (!supabaseConfigurado) {
    return {
      ctx: CONTEXTO_DEMO,
      entitlements: { ...SEM_PLANO, modulos: ["financeiro"] },
      empresaNome: "Empresa de demonstração",
      usuarioNome: "Demonstração",
      podeTrocarEmpresa: false,
      externo: false,
      demo: true,
    };
  }


  const ctx = await contextoAtual({ exigirSessao: true });
  const [usuario, empresas] = await Promise.all([
    usuarioLogado(),
    empresasDisponiveis(ctx.usuarioId),
  ]);

  const entitlements = ctx.empresaId ? await entitlementsDaEmpresa(ctx.empresaId) : SEM_PLANO;
  const atual = empresas.find((e) => e.id === ctx.empresaId) ?? null;

  return {
    ctx,
    entitlements,
    empresaNome: atual?.nome ?? null,
    usuarioNome: usuario?.nome ?? null,
    podeTrocarEmpresa: empresas.length > 1,
    externo: usuario?.externo ?? false,
    demo: false,
  };
}

/**
 * Empresa ativa para as telas.
 *
 * Existe para eliminar o `ctx.empresaId!` espalhado pelas paginas — o `!`
 * mentia: sem empresa, a consulta ia ao banco com `fkEmpresa=eq.null` e
 * estourava um erro cru do Postgres na cara do usuario.
 */
export function empresaDaTela(sessao: SessaoUI): number | null {
  return sessao.ctx.empresaId;
}
