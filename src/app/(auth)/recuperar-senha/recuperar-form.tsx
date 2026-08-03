"use client";

import { useActionState } from "react";
import { recuperarSenhaAction, type EstadoFormulario } from "@/modules/sessao/sessao.actions";
import { Button, inputStyle } from "@/components/ui/kit";

const INICIAL: EstadoFormulario = { erro: null };

export function RecuperarForm() {
  const [estado, acao, enviando] = useActionState(recuperarSenhaAction, INICIAL);
  const enviado = !enviando && estado !== INICIAL && estado.erro === null;

  if (enviado) {
    return (
      <div
        role="status"
        style={{
          padding: "12px 14px",
          borderRadius: "var(--radius-lg)",
          background: "var(--success-bg)",
          border: "1px solid var(--success-border)",
          color: "var(--success-text)",
          fontSize: "var(--text-base)",
          lineHeight: "var(--lh-normal)",
        }}
      >
        Se existir uma conta com esse e-mail, o link de redefinição chegou na caixa de entrada.
        <div style={{ marginTop: 12 }}>
          <a href="/login" style={{ color: "var(--primary)", fontWeight: "var(--fw-medium)" }}>
            Voltar para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={acao} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label
          htmlFor="email"
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-medium)",
            color: "var(--text-secondary)",
          }}
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          placeholder="voce@empresa.com.br"
          style={{ ...inputStyle, height: "var(--h-btn-lg)", fontSize: "var(--text-md)", padding: "0 12px" }}
        />
      </div>

      {estado.erro && (
        <div role="alert" style={{ fontSize: "var(--text-base)", color: "var(--danger-text)" }}>
          {estado.erro}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={enviando} style={{ height: "var(--h-btn-lg)" }}>
        {enviando ? "Enviando…" : "Enviar link"}
      </Button>

      <a
        href="/login"
        style={{ textAlign: "center", fontSize: "var(--text-base)", color: "var(--text-tertiary)" }}
      >
        Voltar para o login
      </a>
    </form>
  );
}
