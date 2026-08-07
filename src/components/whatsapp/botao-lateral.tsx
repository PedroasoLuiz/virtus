"use client";

import {
  definirEstadoDoPainel,
  useEstadoDoPainel,
} from "@/components/whatsapp/estado-do-painel";

/**
 * O acesso ao WhatsApp, no rodapé da barra lateral.
 *
 * ⚠️ Saiu do botão flutuante no canto da tela. Preso ali, ele boiava por cima de
 * qualquer coisa que estivesse embaixo: o total de uma tabela, o rodapé de um
 * formulário, o próprio botão de salvar de um drawer. Um lugar fixo no menu não
 * colide com tela nenhuma, e ainda diz o que é sem depender de reconhecer a
 * silhueta.
 *
 * Fica ACIMA da identidade do usuário porque é navegação, e a identidade é o fim
 * da barra.
 */
export function BotaoLateralDoWhatsapp({ recolhida }: { recolhida: boolean }) {
  const { aberto, naoLidas } = useEstadoDoPainel();

  const rotulo = naoLidas > 0 ? `WhatsApp, ${naoLidas} não lidas` : "WhatsApp";

  return (
    <button
      type="button"
      onClick={() => definirEstadoDoPainel({ aberto: !aberto })}
      title={recolhida ? rotulo : undefined}
      aria-label={rotulo}
      aria-pressed={aberto}
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: recolhida ? "center" : "flex-start",
        gap: 9,
        height: "var(--nav-item-h)",
        padding: recolhida ? 0 : "0 8px",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: aberto ? "var(--primary-subtle)" : "transparent",
        color: aberto ? "var(--primary)" : "var(--sidebar-item-sub)",
        fontFamily: "var(--font)",
        fontSize: "var(--text-base)",
        fontWeight: aberto ? 600 : 450,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseOver={(e) => {
        if (!aberto) e.currentTarget.style.background = "var(--sidebar-item-bg-hover)";
      }}
      onMouseOut={(e) => {
        if (!aberto) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ position: "relative", display: "grid", placeItems: "center", flexShrink: 0 }}>
        {/*
          O glifo do WhatsApp: balão com o fone dentro, preenchido. Um contorno
          genérico de "mensagem" aqui viraria mais um item de menu, e o que faz
          este ser achado num relance é justamente a silhueta.
        */}
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.23.25-.85.83-.85 2.02s.87 2.34.99 2.5c.12.17 1.71 2.62 4.15 3.67.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.11-.22-.17-.47-.29z" />
        </svg>

        {/*
          Recolhida, o contador gruda no ÍCONE. Sem o menu aberto não há texto
          para ele acompanhar, e no fim da linha ele ficaria solto no vazio.
        */}
        {recolhida && naoLidas > 0 && (
          <span
            className="redondo"
            style={{
              position: "absolute",
              top: -5,
              right: -7,
              minWidth: 15,
              height: 15,
              padding: "0 4px",
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius-full)",
              background: "var(--danger)",
              color: "#fff",
              fontSize: "var(--text-2xs)",
              fontWeight: "var(--fw-semi)",
              lineHeight: 1,
              border: "2px solid var(--sidebar-bg)",
            }}
          >
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </span>

      {!recolhida && (
        <>
          <span style={{ flex: 1, textAlign: "left" }}>WhatsApp</span>

          {naoLidas > 0 && (
            <span
              className="redondo"
              style={{
                minWidth: 17,
                height: 17,
                padding: "0 5px",
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--radius-full)",
                background: "var(--danger)",
                color: "#fff",
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--fw-semi)",
                lineHeight: 1,
              }}
            >
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </>
      )}
    </button>
  );
}
