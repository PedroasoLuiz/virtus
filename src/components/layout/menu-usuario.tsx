"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { logoutAction } from "@/modules/sessao/sessao.actions";

/**
 * Menu do usuario: identidade, tema, troca de empresa e sair.
 *
 * "Trocar empresa" leva de volta ao seletor em vez de abrir uma lista aqui —
 * a mesma tela serve aos dois momentos e nao ha regra duplicada.
 */
export function MenuUsuario({
  email,
  nome,
  trocarEmpresa,
  compacto = false,
  acimaDoBotao = false,
}: {
  email: string;
  nome: string | null;
  trocarEmpresa: boolean;
  /** So o avatar — usado com a barra lateral recolhida. */
  compacto?: boolean;
  /** Abre para cima. No rodape da lateral nao ha espaco abaixo. */
  acimaDoBotao?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const escuro = resolvedTheme === "dark";
  const rotulo = nome ?? email;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        style={{
          width: compacto ? 34 : "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: compacto ? "center" : undefined,
          gap: 8,
          height: 34,
          padding: compacto ? 0 : "0 8px",
          borderRadius: "var(--radius-md)",
          // Card proprio: a identidade e a unica coisa fixa do rodape, e o
          // branco a destaca do cinza da barra sem precisar de titulo.
          border: "1px solid var(--border)",
          background: "var(--surface)",
          cursor: "pointer",
          fontFamily: "var(--font)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--text-primary)",
          textAlign: "left",
          transition: "border-color var(--dur-fast) var(--ease)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
        onMouseLeave={(e) => {
          if (!aberto) e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <span
          aria-hidden
          className="redondo"
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--radius-full)",
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            fontSize: 10,
            fontWeight: "var(--fw-bold)",
          }}
        >
          {iniciais(rotulo)}
        </span>
        {!compacto && (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {rotulo}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            ...(acimaDoBotao
              ? { bottom: "calc(100% + 6px)", left: 0 }
              : { top: "calc(100% + 6px)", right: 0 }),
            zIndex: 300,
            minWidth: 220,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            {nome && (
              <div style={{ fontSize: "var(--text-base)", fontWeight: "var(--fw-medium)" }}>
                {nome}
              </div>
            )}
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{email}</div>
          </div>

          <div style={{ padding: 4 }}>
            <ItemMenu onClick={() => setTheme(escuro ? "light" : "dark")}>
              {escuro ? "Tema claro" : "Tema escuro"}
            </ItemMenu>

            {trocarEmpresa && (
              <ItemMenu href="/selecionar-empresa">Trocar de empresa</ItemMenu>
            )}
          </div>

          <form action={logoutAction} style={{ borderTop: "1px solid var(--border)", padding: 4 }}>
            <button
              type="submit"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "7px 8px",
                border: "none",
                background: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font)",
                fontSize: "var(--text-base)",
                color: "var(--danger-text)",
              }}
            >
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ItemMenu({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const estilo: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "7px 8px",
    border: "none",
    background: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontFamily: "var(--font)",
    fontSize: "var(--text-base)",
    color: "var(--text-primary)",
  };

  if (href) {
    return (
      <a href={href} style={estilo}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={estilo}>
      {children}
    </button>
  );
}

function iniciais(texto: string): string {
  const partes = texto.split(/[\s@.]+/).filter((p) => p.length > 1);
  return partes
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
