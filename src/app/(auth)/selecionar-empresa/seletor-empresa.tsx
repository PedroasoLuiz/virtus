"use client";

import { useActionState } from "react";
import {
  logoutAction,
  selecionarEmpresaAction,
  type EstadoFormulario,
} from "@/modules/sessao/sessao.actions";
import type { EmpresaDoUsuario } from "@/modules/sessao/sessao.types";

const INICIAL: EstadoFormulario = { erro: null };

export function SeletorEmpresa({
  empresas,
  acao: acaoExterna,
  campo = "empresaId",
}: {
  empresas: EmpresaDoUsuario[];
  /**
   * Onde a escolha e gravada. Padrao: o tenant do sistema.
   *
   * O portal passa a dele — la a "empresa" e o EMISSOR da cobranca, e nao o
   * tenant que se administra. O desenho da escolha e o mesmo, e por isso a tela
   * e a mesma: duas telas de escolher empresa divergiriam na primeira mexida.
   */
  acao?: (formData: FormData) => void | Promise<void>;
  campo?: string;
}) {
  const [estado, acaoPadrao, enviando] = useActionState(selecionarEmpresaAction, INICIAL);
  const acao = acaoExterna ?? acaoPadrao;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {empresas.length === 0 && (
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-tertiary)" }}>
          Nenhuma empresa vinculada ao seu usuário.
        </p>
      )}

      {/*
        Um form por empresa: o cartao inteiro vira o botao de submit, entao a
        escolha e um clique so — sem selecionar e depois confirmar.
      */}
      {empresas.map((e) => (
        <form key={e.id} action={acao}>
          <input type="hidden" name={campo} value={e.id} />
          <button
            type="submit"
            disabled={acaoExterna ? false : enviando}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              cursor: !acaoExterna && enviando ? "wait" : "pointer",
              textAlign: "left",
              fontFamily: "var(--font)",
              transition: "border-color var(--dur-fast) var(--ease)",
            }}
            onMouseEnter={(ev) => (ev.currentTarget.style.borderColor = "var(--primary)")}
            onMouseLeave={(ev) => (ev.currentTarget.style.borderColor = "var(--border-strong)")}
          >
            <span
              aria-hidden
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--radius-md)",
                background: "var(--primary-subtle)",
                color: "var(--primary)",
                fontWeight: "var(--fw-bold)",
                fontSize: "var(--text-md)",
              }}
            >
              {iniciais(e.nome)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "var(--text-md)",
                  fontWeight: "var(--fw-medium)",
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.nome}
              </span>
              {e.razaoSocial && e.razaoSocial !== e.nome && (
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.razaoSocial}
                </span>
              )}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>›</span>
          </button>
        </form>
      ))}

      {estado.erro && (
        <div role="alert" style={{ fontSize: "var(--text-base)", color: "var(--danger-text)" }}>
          {estado.erro}
        </div>
      )}

      <form action={logoutAction} style={{ marginTop: 6 }}>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "var(--text-base)",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font)",
          }}
        >
          Sair
        </button>
      </form>
    </div>
  );
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
