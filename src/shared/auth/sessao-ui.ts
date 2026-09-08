import { supabaseConfigurado } from "@/infra/config/env";
import { contextoAtual, type Contexto } from "@/shared/auth/contexto";
import { entitlementsDaEmpresa } from "@/modules/plataforma/plataforma.service";
import { empresasDisponiveis, usuarioLogado } from "@/modules/sessao/sessao.service";
import type { Entitlements } from "@/modules/plataforma/plataforma.types";
import { CONTEXTO_DEMO } from "@/shared/demo/dados-demo";
import { visaoDoUsuario } from "@/modules/preferencias/preferencias.repository";
import { VISAO_PADRAO, type Visao } from "@/modules/preferencias/preferencias.types";

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
  /**
   * Como as telas com quadro devem abrir.
   *
   * ⚠️ Lida no SERVIDOR e entregue junto da sessao, e nao buscada pela tela. A
   * pagina precisa nascer no modo certo: pedindo depois, ela abriria em tabela e
   * saltaria para kanban quando o JavaScript subisse, em toda navegacao.
   *
   * ⚠️ Vem de graca no `Promise.all` que a sessao ja fazia — e uma consulta a
   * mais em paralelo, e nao um tempo a mais na tela.
   */
  /**
   * Ve as areas ainda em desenvolvimento: Suprimentos, Estoque, Social,
   * Plataforma e os Favoritos.
   *
   * ⚠️ Nao e permissao, e ESTAGIO. Nao substitui o modulo do plano — os dois
   * portoes precisam abrir.
   */
  interno: boolean;
  visao: Visao;
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
      /* Na demonstracao vale TUDO: e a vitrine do produto, e esconder metade
         dela seria mostrar menos do que existe. */
      interno: true,
      visao: VISAO_PADRAO,
      demo: true,
    };
  }


  const ctx = await contextoAtual({ exigirSessao: true });
  const [usuario, empresas, visao] = await Promise.all([
    usuarioLogado(),
    empresasDisponiveis(ctx.usuarioId),
    visaoDoUsuario(),
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
    interno: usuario?.interno ?? false,
    visao,
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
