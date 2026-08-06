"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drawer lateral — mesma mecanica do `Panel` do SIC.
 *
 * Detalhe de registro abre aqui, nao em pagina propria: o usuario nao perde o
 * contexto da lista, e voltar e um Esc.
 */

/**
 * Largura padrao de drawer de DETALHE — a mesma em conta a receber, conta a
 * pagar e ticket.
 *
 * Mora aqui e nao repetida em cada tela: o numero solto em tres arquivos foi
 * exatamente o que deixou o ticket abrir mais largo que as contas. Formulario
 * usa 540, definido em `FormDrawer`.
 */
const LARGURA_PADRAO = 620;

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = LARGURA_PADRAO,
  footer,
  headerExtra,
  nivel = 1,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
  /**
   * Em que andar este drawer abre.
   *
   * ⚠️ Existe por causa de um caso real: o painel do WhatsApp e um `aside` fixo
   * em 401, e a configuracao aberta de dentro dele ficava com o veu em 400 —
   * ou seja, ATRAS do proprio painel. O fundo continuava clicavel e o drawer
   * parecia meio modal.
   *
   * Cada nivel sobe cem, o suficiente para passar por cima do anterior sem
   * entrar na faixa dos avisos.
   *
   * ⚠️ O 3 existe para o drawer que abre de DENTRO de um de nivel 2 — o vinculo
   * de modelo, que abre da configuracao do WhatsApp. Sem ele, o formulario
   * nascia atras da tela que o abriu.
   */
  nivel?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const base = 300 + nivel * 100;
  useEffect(() => {
    if (!open) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", aoTeclar);

    // Trava o scroll do fundo: rolar a lista atras do drawer desorienta.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.32)",
          backdropFilter: "blur(2px)",
          zIndex: base,
          animation: "fade-in 160ms var(--ease-out)",
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          bottom: 8,
          width: `min(${width}px, calc(100vw - 16px))`,
          zIndex: base + 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          animation: "drawer-in 220ms var(--ease-out)",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            display: "flex",
            // Centro, nao topo: sem subtitulo o titulo ficava desalinhado dos
            // botoes da direita.
            alignItems: "center",
            gap: 12,
            padding: "12px 12px 12px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--fw-semi)",
                letterSpacing: "var(--tracking-snug)",
                lineHeight: "var(--lh-tight)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  marginTop: 3,
                  fontSize: "var(--text-sm)",
                  color: "var(--text-tertiary)",
                  lineHeight: "var(--lh-snug)",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {headerExtra}
            <button
              onClick={onClose}
              aria-label="Fechar"
              style={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 16 }}>{children}</div>

        {footer && (
          <footer
            style={{
              flexShrink: 0,
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
}

/**
 * Botao de icone do cabecalho, ao lado do X.
 *
 * Mora aqui porque ja existia em tres copias — ticket, tarefa e projeto — e a
 * moldura tinha de ser a mesma do botao de fechar: um sem borda no meio de dois
 * com borda le como se estivesse desativado.
 */
export function BotaoDeCabecalho({
  rotulo,
  ativo,
  contador,
  perigo,
  desabilitado,
  onClick,
  children,
}: {
  rotulo: string;
  ativo?: boolean;
  /** Numero na quina. Evita abrir o painel so para descobrir se ha algo dentro. */
  contador?: number;
  perigo?: boolean;
  desabilitado?: boolean;
  onClick: () => void;
  /** O miolo do `<svg>` — o traco e o tamanho vem daqui. */
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={ativo}
      style={{
        position: "relative",
        width: 28,
        height: 28,
        display: "grid",
        placeItems: "center",
        border: "1px solid var(--border)",
        background: ativo ? "var(--surface-3)" : "var(--surface)",
        borderRadius: "var(--radius-sm)",
        cursor: desabilitado ? "not-allowed" : "pointer",
        opacity: desabilitado ? 0.4 : 1,
        color: perigo ? "var(--danger)" : ativo ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>

      {contador != null && contador > 0 && (
        <span
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            minWidth: 15,
            height: 15,
            padding: "0 4px",
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--radius-full)",
            background: "var(--primary)",
            color: "#fff",
            fontSize: 10,
            fontWeight: "var(--fw-semi)",
            lineHeight: 1,
          }}
        >
          {contador}
        </span>
      )}
    </button>
  );
}

/** Bloco de seção dentro do drawer. */
export function Bloco({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span className="rotulo">{titulo}</span>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Par rótulo/valor. Rótulo com largura fixa mantém os valores alinhados. */
export function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline", minHeight: 26 }}>
      <span
        style={{
          width: 120,
          flexShrink: 0,
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
        }}
      >
        {rotulo}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-base)" }}>{children}</span>
    </div>
  );
}

/**
 * Historico de criacao e ultima edicao.
 *
 * Fica ao lado do fechar porque e informacao de auditoria: importa quando
 * alguem pergunta "quem mexeu nisso?", nao no uso normal. Por isso vive atras
 * de um clique, e nao ocupando espaco no corpo.
 */
export function BotaoHistorico({
  criadoEm,
  criadoPor,
  editadoEm,
  editadoPor,
}: {
  criadoEm: string | null;
  criadoPor: string | null;
  editadoEm: string | null;
  editadoPor: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Histórico do registro"
        title="Histórico"
        style={{
          width: 28,
          height: 28,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--border)",
          background: aberto ? "var(--surface-3)" : "var(--surface)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          color: "var(--text-secondary)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Histórico"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 402,
            minWidth: 240,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Registro rotulo="Criado por" quem={criadoPor} quando={criadoEm} />
          <Registro rotulo="Última edição" quem={editadoPor} quando={editadoEm} />
        </div>
      )}
    </div>
  );
}

function Registro({
  rotulo,
  quem,
  quando,
}: {
  rotulo: string;
  quem: string | null;
  quando: string | null;
}) {
  return (
    <div>
      <div className="rotulo">{rotulo}</div>
      <div style={{ fontSize: "var(--text-base)", marginTop: 2 }}>{quem ?? "—"}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
        {quando ? dataHora(quando) : "—"}
      </div>
    </div>
  );
}

/** Data e hora locais. O banco guarda em UTC. */
function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
