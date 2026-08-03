"use client";

import { useActionState, useState } from "react";
import { loginAction, type EstadoFormulario } from "@/modules/sessao/sessao.actions";
import { Button, inputStyle } from "@/components/ui/kit";

const INICIAL: EstadoFormulario = { erro: null };

export function LoginForm() {
  const [estado, acao, enviando] = useActionState(loginAction, INICIAL);
  const [verSenha, setVerSenha] = useState(false);

  return (
    <form action={acao} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Campo id="email" rotulo="E-mail">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="voce@empresa.com.br"
          style={campoStyle}
        />
      </Campo>

      <Campo id="senha" rotulo="Senha">
        <div style={{ position: "relative" }}>
          <input
            id="senha"
            name="senha"
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            style={{ ...campoStyle, paddingRight: 60 }}
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-medium)",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font)",
            }}
          >
            {verSenha ? "ocultar" : "mostrar"}
          </button>
        </div>
      </Campo>

      {/*
        role="alert" para que leitor de tela anuncie o erro sem o usuario
        precisar navegar ate ele.
      */}
      {estado.erro && (
        <div
          role="alert"
          style={{
            padding: "8px 10px",
            borderRadius: "var(--radius-md)",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger-text)",
            fontSize: "var(--text-base)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          {estado.erro}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={enviando} style={{ height: "var(--h-btn-lg)" }}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>

      <a
        href="/recuperar-senha"
        style={{
          textAlign: "center",
          fontSize: "var(--text-base)",
          color: "var(--text-tertiary)",
          marginTop: 2,
        }}
      >
        Esqueci minha senha
      </a>
    </form>
  );
}

const campoStyle: React.CSSProperties = {
  ...inputStyle,
  height: "var(--h-btn-lg)",
  fontSize: "var(--text-md)",
  padding: "0 12px",
};

function Campo({
  id,
  rotulo,
  children,
}: {
  id: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-medium)",
          color: "var(--text-secondary)",
        }}
      >
        {rotulo}
      </label>
      {children}
    </div>
  );
}
