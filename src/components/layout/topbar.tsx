import { BuscaGlobal } from "@/components/layout/busca-global";

/**
 * Barra superior: busca global centralizada, como no SIC.
 *
 * Sem fundo proprio — faz parte da casca cinza.
 */
export function Topbar({ aviso }: { aviso: "demo" | null }) {
  return (
    <header
      style={{
        height: "var(--h-topbar)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 12px",
        position: "relative",
        zIndex: 50,
      }}
    >
      <BuscaGlobal />

      {aviso && (
        <div style={{ position: "absolute", right: 12 }}>
          <Aviso />
        </div>
      )}
    </header>
  );
}

/**
 * Aparece so quando o Supabase nao esta configurado: ninguem deve confundir
 * dado de demonstracao com dado real.
 */
function Aviso() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semi)",
        background: "var(--warning-bg)",
        color: "var(--warning-text)",
        border: "1px solid var(--warning-border)",
      }}
    >
      Dados de demonstração
    </span>
  );
}
