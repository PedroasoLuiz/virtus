"use client";

import { useState } from "react";

/**
 * "Precisa de ajuda?" ao pe da tabela.
 *
 * ⚠️ Fechada por padrao, e essa e a razao de existir. A alternativa era o texto
 * de apoio permanente que ja tentamos: ele empurra a tabela para baixo, e quem
 * ja sabe usar a tela paga esse preco toda vez. Sanfona cobra um clique de quem
 * precisa e nada de quem nao precisa.
 *
 * ⚠️ Cada item LEVA a algum lugar. Pergunta que responde e nao resolve vira
 * documentacao dentro do produto, que envelhece calada; com destino, ela vira
 * atalho, e atalho quebrado aparece.
 */

export type Duvida = {
  pergunta: string;
  resposta: string;
  /** Para onde ir. Externo abre em outra aba; interno navega. */
  href?: string;
  rotuloDoLink?: string;
  /** Ação dentro da própria tela, quando o destino não é uma URL. */
  onIr?: () => void;
};

export function PrecisaDeAjuda({ duvidas }: { duvidas: Duvida[] }) {
  const [aberta, setAberta] = useState(false);
  const [item, setItem] = useState<number | null>(null);

  if (duvidas.length === 0) return null;

  return (
    /*
     * Respiro largo em cima: a ajuda nao pertence a tabela, ela vem DEPOIS de
     * tudo. Colada, parecia mais uma linha do rodape da lista.
     */
    <section style={{ marginTop: 44 }}>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          // Mesmo tamanho e peso do titulo das secoes: e um titulo tambem, so
          // que de uma secao que comeca fechada.
          fontSize: "calc(var(--text-lg) + 2px)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-primary)",
          letterSpacing: "var(--tracking-snug)",
        }}
      >
        Precisa de ajuda?
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: "var(--text-tertiary)",
            transform: aberta ? "rotate(180deg)" : "none",
            transition: "transform 160ms var(--ease-out)",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {aberta && (
        <div style={{ marginTop: 10 }}>
          {duvidas.map((d, i) => (
            <div
              key={d.pergunta}
              style={{
                borderTop: i === 0 ? "1px solid var(--border)" : "none",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => setItem(item === i ? null : i)}
                aria-expanded={item === i}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 0",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                {d.pergunta}

                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    color: "var(--text-tertiary)",
                    transform: item === i ? "rotate(180deg)" : "none",
                    transition: "transform 160ms var(--ease-out)",
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {item === i && (
                <div style={{ padding: "0 0 12px" }}>
                  <p
                    style={{
                      fontSize: "calc(var(--text-xs) + 1px)",
                      color: "var(--text-secondary)",
                      lineHeight: "var(--lh-normal)",
                    }}
                  >
                    {d.resposta}
                  </p>

                  {(d.href || d.onIr) && (
                    <Destino duvida={d} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** O atalho da resposta: link externo abre fora, ação interna é botão. */
function Destino({ duvida }: { duvida: Duvida }) {
  const estilo = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "var(--text-sm)",
    color: "var(--primary)",
    textDecoration: "none",
  } as const;

  const seta = (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );

  if (duvida.href) {
    const externo = duvida.href.startsWith("http");

    return (
      <a
        href={duvida.href}
        target={externo ? "_blank" : undefined}
        rel={externo ? "noreferrer" : undefined}
        style={estilo}
      >
        {duvida.rotuloDoLink ?? "Ver como"}
        {seta}
      </a>
    );
  }

  return (
    <button type="button" onClick={duvida.onIr} style={estilo}>
      {duvida.rotuloDoLink ?? "Ir para lá"}
      {seta}
    </button>
  );
}
