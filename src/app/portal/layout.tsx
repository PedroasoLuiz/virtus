import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Avisos } from "@/components/ui/avisos";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { COOKIE_SIDEBAR } from "@/components/layout/cookies";
import { GRUPOS_DO_PORTAL } from "@/components/layout/rotas";
import { sessaoUI } from "@/shared/auth/sessao-ui";
import { carteira } from "@/modules/portal/portal.service";
import { emitenteEscolhido } from "./emitente";

/**
 * Casca do portal do cliente.
 *
 * É a MESMA casca do sistema — barra lateral, topo, área de trabalho no cinza —
 * com outro menu. Não é um anexo de visual próprio: o cliente vai passar a abrir
 * chamado por aqui, e uma casca separada divergiria da do sistema no primeiro
 * ajuste de espaçamento.
 *
 * O que muda é só o mapa de navegação (`GRUPOS_DO_PORTAL`), porque o menu do
 * sistema é organizado pelo que a EMPRESA administra, e o cliente não administra
 * nada: ele consulta o que deve.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoUI();

  // Interno cai aqui por engano (link antigo, digitou a URL): o lugar dele é o
  // sistema. O portal não quebraria, mostraria uma tela vazia — as policies do
  // portal respondem por cliente, e ele não tem nenhum.
  if (!sessao.externo && !sessao.demo) redirect("/dashboard");

  const recolhida = (await cookies()).get(COOKIE_SIDEBAR)?.value === "1";

  // A empresa emissora ativa vive no rodape da barra, no mesmo lugar em que o
  // sistema mostra o tenant — e a troca sai do mesmo menu.
  const { emitentes, emitenteAtual } = await carteira(await emitenteEscolhido());

  return (
    <Avisos>
      <div
        style={{
          display: "flex",
          height: "100dvh",
          overflow: "hidden",
          background: "var(--sidebar-bg)",
        }}
      >
        <Sidebar
          grupos={GRUPOS_DO_PORTAL}
          inicio="/portal"
          modulos={[]}
          empresa={emitenteAtual?.nome ?? null}
          recolhidaInicial={recolhida}
          email={sessao.ctx.email}
          usuarioNome={sessao.usuarioNome}
          // Mesma mecânica do sistema, outro significado: aqui a empresa é
          // quem ESTÁ COBRANDO, e não o tenant que se administra.
          podeTrocarEmpresa={emitentes.length > 1}
          hrefTrocarEmpresa="/portal-empresa"
        />

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Topbar aviso={sessao.demo ? "demo" : null} />
          <main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</main>
        </div>
      </div>
    </Avisos>
  );
}
