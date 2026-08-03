/**
 * Casca das telas de autenticacao.
 *
 * Duas colunas no desktop: formulario a esquerda, painel de marca a direita.
 * No mobile o painel some — ele e ambientacao, nao conteudo.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--surface)" }}>
      <section
        style={{
          flex: "1 1 480px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 340 }}>{children}</div>
      </section>

      <PainelMarca />
    </div>
  );
}

function PainelMarca() {
  return (
    <aside
      className="painel-marca"
      style={{
        flex: "1 1 50%",
        position: "relative",
        overflow: "hidden",
        background: "#0a0a0a",
        color: "#fff",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/*
        Luz verde difusa no canto — o "glow" da identidade Virtus, adaptado
        para o verde do VPay. Puro CSS: sem imagem, sem custo de rede.
      */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 75% 15%, rgba(0,187,71,0.28), transparent 70%)," +
            "radial-gradient(45% 40% at 25% 85%, rgba(0,106,40,0.22), transparent 75%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 420 }}>
        <p
          style={{
            fontSize: "var(--text-4xl)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          O financeiro da sua operação, em um lugar só.
        </p>
        <p style={{ fontSize: "var(--text-md)", color: "rgba(255,255,255,0.66)" }}>
          Faturamento, contas a pagar, tesouraria e DRE.
        </p>

        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            fontSize: "var(--text-sm)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Virtus Tecnologias
        </div>
      </div>
    </aside>
  );
}
