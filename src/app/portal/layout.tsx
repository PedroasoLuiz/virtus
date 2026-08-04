import { redirect } from "next/navigation";
import { Avisos } from "@/components/ui/avisos";
import { sessaoUI } from "@/shared/auth/sessao-ui";
import { SairDoPortal } from "./sair";

/**
 * Casca do portal do cliente.
 *
 * Deliberadamente sem barra lateral, sem busca global e sem troca de empresa:
 * quem entra aqui tem uma pergunta só — o que eu devo e onde pego o boleto. Um
 * menu com dez itens vazios diria que existe um sistema atrás, e não existe
 * para ele.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoUI();

  // Interno cai aqui por engano (link antigo, digitou a URL): o lugar dele é o
  // sistema. O portal não quebraria, mas mostraria uma tela vazia, porque as
  // policies do portal respondem por cliente e ele não tem nenhum.
  if (!sessao.externo && !sessao.demo) redirect("/dashboard");

  return (
    <Avisos>
      <div
        style={{
          minHeight: "100dvh",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: "var(--h-header)",
            padding: "0 20px",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "var(--text-md)",
              fontWeight: "var(--fw-semi)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Minhas cobranças
          </span>

          <span style={{ flex: 1 }} />

          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            {sessao.usuarioNome ?? sessao.ctx.email}
          </span>

          <SairDoPortal />
        </header>

        <main style={{ flex: 1, padding: 20 }}>{children}</main>
      </div>
    </Avisos>
  );
}
