"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";

/**
 * Os documentos de uma parcela: nota, boleto e comprovante.
 *
 * ⚠️ Tres bandeirinhas numa celula, e nao tres colunas. Elas sao a excecao e nao
 * a regra — a maioria das parcelas nao tem nenhum —, e tres colunas quase sempre
 * vazias empurrariam para fora da tela o que se le todo dia.
 */

export function Documentos({
  faturaId,
  parcelaId,
  boleto,
  nfs,
  comprovante,
  bloqueado,
  aoMudar,
}: {
  faturaId: number;
  parcelaId: number;
  boleto: string | null;
  nfs: string | null;
  comprovante: string | null;
  /** Parcela baixada ou conta cancelada: da para baixar, nao para remover. */
  bloqueado: boolean;
  aoMudar: () => void;
}) {
  if (!nfs && !boleto && !comprovante) return <span style={{ color: "var(--text-disabled)" }}>—</span>;

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {nfs && (
        <Bandeira
          rotulo="NF"
          tipo="nfs"
          faturaId={faturaId}
          parcelaId={parcelaId}
          bloqueado={bloqueado}
          aoMudar={aoMudar}
        />
      )}
      {comprovante && (
        <Bandeira
          rotulo="Comprovante"
          tipo="comprovante"
          faturaId={faturaId}
          parcelaId={parcelaId}
          bloqueado={bloqueado}
          aoMudar={aoMudar}
        />
      )}
      {boleto && (
        <Bandeira
          rotulo="Boleto"
          tipo="boleto"
          faturaId={faturaId}
          parcelaId={parcelaId}
          bloqueado={bloqueado}
          aoMudar={aoMudar}
        />
      )}
    </span>
  );
}

/**
 * As bandeiras dos documentos ja anexados.
 *
 * Cada uma e um par: o rotulo baixa, o ✕ ao lado remove. Dois alvos dentro da
 * mesma moldura, e nao dois controles soltos — assim o ✕ pertence visivelmente
 * AQUELE documento, e nao a linha inteira.
 *
 * Anexar mora na coluna de acoes: e um gesto de escrita, e misturado as
 * bandeiras fazia a coluna significar "o que existe" e "o que da para fazer" ao
 * mesmo tempo.
 */
function Bandeira({
  rotulo,
  tipo,
  faturaId,
  parcelaId,
  bloqueado,
  aoMudar,
}: {
  rotulo: string;
  tipo: "nfs" | "boleto" | "comprovante";
  faturaId: number;
  parcelaId: number;
  bloqueado: boolean;
  aoMudar: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const url = `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/documento?tipo=${tipo}`;

  async function remover() {
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível remover");
      return;
    }
    aoMudar();
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 19,
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--primary-border)",
        background: "var(--primary-subtle)",
        overflow: "hidden",
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        title={`Baixar ${rotulo}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0 6px",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--fw-medium)",
          color: "var(--primary)",
          textDecoration: "none",
        }}
      >
        {rotulo}
      </a>

      {/* Baixada, da para baixar mas nao para remover: nota e boleto sao o que
          se manda para RECEBER, e trocar depois muda o que o cliente tem em maos
          sobre uma cobranca encerrada. */}
      {!bloqueado && (
      <button
        type="button"
        title={`Remover ${rotulo}`}
        aria-label={`Remover ${rotulo}`}
        onClick={() =>
          confirmar(`Remover ${rotulo} desta parcela?`, "Remover", remover, "O arquivo é apagado.")
        }
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 16,
          height: 19,
          border: "none",
          borderLeft: "1px solid var(--primary-border)",
          background: "transparent",
          padding: 0,
          color: "var(--primary)",
          cursor: "pointer",
          fontSize: 9,
        }}
      >
        ✕
      </button>
      )}
    </span>
  );
}


/**
 * Total no rodape, com o resto atras de um clique.
 *
 * Total e a pergunta de sempre; pago e saldo so importam quando ha pagamento
 * pela metade. Os tres sempre visiveis faziam a linha do botao competir com o
 * botao.
 */

/**
 * Anexar um documento, como item do menu.
 *
 * E um `<label>` e nao um `<button>`: o `<input type="file">` precisa de um
 * rotulo para ser acionado, e assim o clique no item inteiro abre o seletor.
 */
export function AnexarDocumento({
  tipo,
  rotulo,
  faturaId,
  parcelaId,
  aoMudar,
  children,
}: {
  tipo: "nfs" | "boleto" | "comprovante";
  rotulo: string;
  faturaId: number;
  parcelaId: number;
  aoMudar: () => void;
  children: React.ReactNode;
}) {
  const { avisar } = useAvisos();
  const [enviando, setEnviando] = useState(false);
  const [hover, setHover] = useState(false);

  async function subir(arquivo: File) {
    const corpo = new FormData();
    corpo.append("arquivo", arquivo);

    setEnviando(true);
    const r = await fetch(
      `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/documento?tipo=${tipo}`,
      { method: "POST", body: corpo },
    );
    const dados = await r.json().catch(() => null);
    setEnviando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar o arquivo");
      return;
    }
    aoMudar();
  }

  return (
    <label
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: "var(--radius-sm)",
        background: hover ? "var(--surface-2)" : "transparent",
        color: "var(--text-primary)",
        fontSize: "var(--text-sm)",
        whiteSpace: "nowrap",
        cursor: enviando ? "wait" : "pointer",
        opacity: enviando ? 0.5 : 1,
      }}
    >
      <span style={{ display: "inline-grid", placeItems: "center", width: 16, flexShrink: 0 }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </svg>
      </span>
      {enviando ? "Enviando…" : rotulo}
      <input
        type="file"
        accept="application/pdf,image/*"
        disabled={enviando}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          // Zerado para que escolher o MESMO arquivo de novo, depois de um erro,
          // ainda dispare o `change`.
          e.target.value = "";
          if (arquivo) void subir(arquivo);
        }}
        style={{ display: "none" }}
      />
    </label>
  );
}

