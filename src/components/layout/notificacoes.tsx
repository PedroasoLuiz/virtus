"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O sino das notificacoes.
 *
 * ⚠️ Ele ABRE um cartao, ainda que nao haja o que mostrar. Um icone que nao
 * responde ao clique ensina a nao clicar nele, e quando as notificacoes
 * existirem a pessoa ja terá aprendido a ignorar o sino. Abrindo desde o
 * primeiro dia, ele diz onde elas vao aparecer.
 *
 * ⚠️ Sem contador e sem ponto vermelho enquanto nao ha origem de notificacao. O
 * ponto e uma promessa de que algo mudou; aceso a toa, ele vira ruido e deixa de
 * ser lido no dia em que valer.
 */
export function Notificacoes() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div ref={caixa} style={{ position: "relative", display: "flex" }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        aria-expanded={aberto}
        title="Notificações"
        style={{
          /*
            ⚠️ SEM corpo proprio: ele mora DENTRO da pilula branca da busca.

            O material e o canto sao da pilula; aqui fica so o alvo de clique. Um
            fundo proprio desenharia uma segunda superficie dentro da primeira, e
            era o que fazia o sino parecer um botao colado por cima da caixa em
            vez de morar nela.
          */
          width: 38,
          height: 38,
          display: "grid",
          placeItems: "center",
          border: "none",
          borderRadius: "var(--radius-full)",
          background: aberto ? "var(--surface-hover)" : "transparent",
          color: aberto ? "var(--text-primary)" : "var(--text-secondary)",
          cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = aberto ? "var(--surface-hover)" : "transparent";
        }}
      >
        <IconeSino />
      </button>

      {aberto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 301,
            width: 260,
            padding: "14px 14px 16px",
            borderRadius: "var(--radius-lg)",
            /* SEM borda: a sombra ja separa o cartao do que esta atras. Mesmo
               desenho do cartao do usuario, ao lado. */
            background: "var(--surface)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            style={{
              fontSize: "var(--text-base)",
              fontWeight: "var(--fw-semi)",
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Notificações
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            Nada por aqui ainda. Vencimentos e baixas vão aparecer neste cartão.
          </p>
        </div>
      )}
    </div>
  );
}

function IconeSino() {
  return (
    <svg
      /* 19 num alvo de 34: o sino divide a fileira com o avatar, que e um disco
         cheio de 34, e um glifo pequeno ao lado dele lia como meio apagado. */
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8.5a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </svg>
  );
}
