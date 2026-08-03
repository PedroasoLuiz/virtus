"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TODAS_AS_ROTAS, type Item } from "@/components/layout/rotas";

/**
 * Busca global de modulos — mesmo padrao do SIC.
 *
 * Centralizada no topo, 340px, atalho Ctrl+K. Navega entre telas; nao procura
 * registro. Buscar dentro de uma listagem continua sendo o campo da propria
 * tela — misturar as duas coisas numa caixa so torna o resultado imprevisivel.
 */
export function BuscaGlobal() {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta(true);
        campo.current?.focus();
      }
      if (e.key === "Escape") setAberta(false);
    };

    const aoClicarFora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberta(false);
    };

    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicarFora);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicarFora);
    };
  }, []);

  const busca = termo.trim().toLowerCase();
  const resultados = busca
    ? TODAS_AS_ROTAS.filter((i) => i.label.toLowerCase().includes(busca))
    : TODAS_AS_ROTAS;

  function ir(item: Item) {
    setAberta(false);
    setTermo("");
    router.push(item.href);
  }

  return (
    <div ref={caixa} style={{ position: "relative", width: 340 }}>
      <div
        onClick={() => {
          setAberta(true);
          campo.current?.focus();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          height: 28,
          padding: "0 10px",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)",
          cursor: "text",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>

        <input
          ref={campo}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={() => setAberta(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && resultados[0]) ir(resultados[0]);
          }}
          placeholder="Buscar módulos e funções..."
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "var(--text-base)",
            fontFamily: "inherit",
            color: "var(--text-primary)",
          }}
        />

        {!aberta && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {["Ctrl", "K"].map((k) => (
              <kbd
                key={k}
                style={{
                  fontSize: 9,
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: "var(--kbd-bg)",
                  color: "var(--kbd-color)",
                  border: "1px solid var(--kbd-border)",
                  fontFamily: "inherit",
                }}
              >
                {k}
              </kbd>
            ))}
          </div>
        )}
      </div>

      {aberta && (
        <div
          style={{
            position: "absolute",
            top: 35,
            left: 0,
            right: 0,
            zIndex: 200,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
            maxHeight: 380,
            overflowY: "auto",
          }}
        >
          {resultados.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                fontSize: "var(--text-base)",
                color: "var(--text-tertiary)",
              }}
            >
              Nenhum resultado para &ldquo;{termo}&rdquo;
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              {!busca && (
                <div className="rotulo" style={{ padding: "2px 6px 6px" }}>
                  Módulos
                </div>
              )}
              {resultados.map((item) => (
                <button
                  key={item.href}
                  onClick={() => ir(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "7px 6px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    style={{
                      fontSize: "var(--text-md)",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {item.href}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
