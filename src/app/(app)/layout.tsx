import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { COOKIE_SIDEBAR } from "@/components/layout/cookies";
import { listar as listarFavoritos } from "@/modules/favoritos/favoritos.repository";
import { HidrataFavoritos } from "@/components/layout/hidrata-favoritos";
import { Topbar } from "@/components/layout/topbar";
import { sessaoUI } from "@/shared/auth/sessao-ui";
import { Avisos } from "@/components/ui/avisos";
import { PainelWhatsapp } from "@/components/whatsapp/painel";

/**
 * Casca do app.
 *
 * Barra lateral com fundo proprio e divisoria a direita; topo e area de
 * trabalho no cinza de fundo. Branco so na tabela e nos cards. A pagina nunca rola: o scroll vive dentro
 * da area de tabela.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoUI();

  /*
   * Usuario externo nao entra no sistema, vai para o portal.
   *
   * A RLS ja o deixaria de maos vazias — `empresas_do_usuario()` nao devolve
   * nada para ele —, mas o resultado seria um sistema inteiro em branco, com
   * menu, telas e nenhum dado. Redirecionar e dizer a verdade: este nao e o
   * lugar dele.
   *
   * ⚠️ Isto NAO e a protecao. A protecao e a RLS; se este redirect sumisse, ele
   * continuaria sem ver dado nenhum.
   */
  if (sessao.externo) redirect("/portal");

  const recolhida = (await cookies()).get(COOKIE_SIDEBAR)?.value === "1";

  // Favorito e dado, nao preferencia de navegador: vive na tabela
  // `menufavoritos`, isolada por RLS. Falha aqui nao pode derrubar o menu.
  const favoritos = sessao.ctx.empresaId
    ? await listarFavoritos(sessao.ctx.empresaId).catch(() => [])
    : [];

  return (
    // `Avisos` envolve a casca inteira: aviso disparado de qualquer tela cai no
    // mesmo canto, e nao ha um provider por pagina para manter em sincronia.
    <Avisos>
      <div
        style={{
          display: "flex",
          height: "100dvh",
          overflow: "hidden",
          background: "var(--sidebar-bg)",
        }}
      >
      <HidrataFavoritos rotas={favoritos} />
      <Sidebar
        modulos={sessao.entitlements.modulos}
        empresa={sessao.empresaNome}
        recolhidaInicial={recolhida}
        email={sessao.ctx.email}
        usuarioNome={sessao.usuarioNome}
        podeTrocarEmpresa={sessao.podeTrocarEmpresa}
        whatsapp={!sessao.demo}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar aviso={sessao.demo ? "demo" : null} />
        <main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</main>
        </div>
      </div>

      {/*
        O painel fica na RAIZ da casca. Quem o ABRE mora no rodape da barra
        lateral, e os dois se falam por `estado-do-painel`.

        ⚠️ O painel nao pode nascer dentro da barra. Ele cobre a tela inteira, e
        de la herdaria o contexto de empilhamento da propria barra — ficaria
        preso dentro de duzentos pixels de largura.

        Fora do modo demonstracao ele nao tem o que mostrar: sem Supabase nao ha
        Realtime nem API, e o botao piscaria erro a cada montagem.
      */}
      {!sessao.demo && <PainelWhatsapp />}
    </Avisos>
  );
}
