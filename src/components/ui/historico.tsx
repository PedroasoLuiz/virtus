"use client";

import { useState } from "react";

/**
 * Quem criou e quem mexeu por ultimo, num painel que abre do proprio botao.
 *
 * Fica atras de um clique porque e informacao de auditoria: consultada quando
 * um numero e questionado, nao a cada abertura. Ocupando linha fixa no
 * cabecalho, empurraria para baixo o que se le sempre.
 *
 * Mora aqui e nao no drawer do ticket porque a tarefa mostra a MESMA ficha —
 * duas copias divergiriam no primeiro ajuste, e ja e o segundo lugar a pedir.
 */

export type MarcoDoHistorico = {
  rotulo: string;
  quem: string | null;
  quando: string | null;
};

export function Historico({ marcos }: { marcos: MarcoDoHistorico[] }) {
  const [aberto, setAberto] = useState(false);

  // Marco sem quem e sem quando nao e "vazio", e ausente: a tarefa que ninguem
  // concluiu nao deve mostrar uma linha "Concluida —".
  const visiveis = marcos.filter((m) => m.quem || m.quando);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        title="Histórico do registro"
        aria-label="Histórico do registro"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // Mesma moldura do botao de fechar: os tres vivem lado a lado no
          // cabecalho, e um sem borda no meio de dois com borda le como se
          // estivesse desativado.
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: aberto ? "var(--surface-3)" : "var(--surface)",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
      </button>

      {aberto && (
        <>
          {/* Camada invisivel que fecha ao clicar fora — sem ela o painel so
              sairia da tela clicando de novo no botao. */}
          <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              zIndex: 41,
              width: 268,
              padding: 14,
              borderRadius: "var(--radius-lg)",
              background: "var(--surface)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div className="rotulo" style={{ fontSize: "var(--text-xs)", marginBottom: 12 }}>
              Histórico do registro
            </div>

            {visiveis.map((m, i) => (
              <Marco
                key={m.rotulo}
                // So o primeiro marco e o fato; o resto e o que veio depois.
                cor={i === 0 ? "var(--primary)" : "var(--text-disabled)"}
                rotulo={m.rotulo}
                quem={m.quem}
                quando={m.quando}
                ultimo={i === visiveis.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Um ponto da linha do tempo: bolinha, fio descendo, e o par quem/quando.
 *
 * A linha vertical so existe entre marcos — no ultimo ela sumiria no vazio e
 * pareceria que falta um item.
 */
function Marco({
  cor,
  rotulo,
  quem,
  quando,
  ultimo,
}: {
  cor: string;
  rotulo: string;
  quem: string | null;
  quando: string | null;
  ultimo?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          className="redondo"
          style={{ width: 7, height: 7, borderRadius: "50%", background: cor, marginTop: 4 }}
        />
        {!ultimo && <span style={{ flex: 1, width: 1, background: "var(--border)" }} />}
      </div>

      <div style={{ paddingBottom: ultimo ? 0 : 14, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>{rotulo}</div>
        <div
          style={{
            fontSize: "var(--text-base)",
            fontWeight: "var(--fw-medium)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {quem ?? "—"}
        </div>
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {quando ? dataHora(quando) : "—"}
        </div>
      </div>
    </div>
  );
}

/** dd/mm/aaaa às HH:MM, no fuso do navegador. */
function dataHora(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}
