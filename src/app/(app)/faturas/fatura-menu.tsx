"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A moldura de um botao de acao dentro da tabela do drawer.
 *
 * ⚠️ Menor que o `BotaoDeAcao` da listagem (24 contra 26): a linha do drawer tem
 * 34 de altura contra as 40 da tela, e o botao de fora ficava encostado nas duas
 * bordas da celula.
 */
const MOLDURA_DE_ACAO: React.CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 24,
  height: 24,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  padding: 0,
  cursor: "pointer",
};

/**
 * O menu de acoes de uma linha da tabela do drawer.
 *
 * ⚠️ Menu, e nao botoes soltos como na listagem de pessoas. Ali cada linha tem
 * uma acao; aqui a parcela tem cinco — baixar, prorrogar, recibo, anexar, tirar
 * a baixa —, e cinco icones por linha viram uma barra de ferramentas em cada
 * linha da tabela.
 *
 * ⚠️ O cartao sai do fluxo por PORTAL, preso na tela e nao na celula.
 *
 * A tabela do sistema rola dentro de si (`overflow: auto`), e todo elemento
 * posicionado dentro dela e recortado pela borda: o cartao da ultima linha
 * simplesmente sumia, e nas tabelas de uma linha so o menu nunca aparecia. Preso
 * ao `body`, ele nao tem o que o corte.
 *
 * O filho recebe `fechar` porque toda acao daqui termina o menu: deixar aberto
 * depois do clique faz parecer que nao aconteceu nada.
 */
export function MenuDeLinha({ children }: { children: (fechar: () => void) => React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const [onde, setOnde] = useState({ top: 0, right: 0 });

  /*
   * ⚠️ Mede DEPOIS de abrir e antes de pintar (`useLayoutEffect`).
   *
   * Com `useEffect`, o cartao aparecia por um quadro no canto superior esquerdo
   * antes de pular para o lugar certo.
   */
  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;

    const r = botao.current.getBoundingClientRect();
    setOnde({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [aberto]);

  return (
    <span style={{ display: "inline-flex" }}>
      <button
        ref={botao}
        type="button"
        title="Ações"
        aria-label="Ações"
        aria-expanded={aberto}
        onClick={(e) => {
          // A linha pode ter clique proprio; a acao nao dispara os dois.
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        style={{ ...MOLDURA_DE_ACAO, color: "var(--text-secondary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>

      {aberto &&
        createPortal(
          <>
            {/*
              Camada invisivel que fecha ao clicar fora, e que tambem fecha ao
              ROLAR: o cartao esta preso na tela, e sem isso ele ficaria parado
              enquanto a linha dele some da area visivel.
            */}
            <div
              onClick={() => setAberto(false)}
              onWheel={() => setAberto(false)}
              style={{ position: "fixed", inset: 0, zIndex: 440 }}
            />

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: onde.top,
                right: onde.right,
                zIndex: 441,
                padding: 4,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {children(() => setAberto(false))}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}

/** Uma linha do menu. `icone` vem pronto; sem ele, `children` sao os tracos. */
export function ItemDoMenu({
  rotulo,
  perigo,
  desabilitado,
  motivo,
  icone,
  onClick,
  children,
}: {
  rotulo: string;
  perigo?: boolean;
  desabilitado?: boolean;
  motivo?: string;
  icone?: React.ReactNode;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      disabled={desabilitado}
      title={motivo}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "7px 10px",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: hover && !desabilitado ? "var(--surface-2)" : "transparent",
        color: desabilitado
          ? "var(--text-disabled)"
          : perigo
            ? "var(--danger)"
            : "var(--text-primary)",
        fontSize: "var(--text-sm)",
        fontFamily: "var(--font)",
        textAlign: "left",
        whiteSpace: "nowrap",
        cursor: desabilitado ? "not-allowed" : "pointer",
      }}
    >
      <span style={{ display: "inline-grid", placeItems: "center", width: 16, flexShrink: 0 }}>
        {icone ?? (
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
        )}
      </span>
      {rotulo}
    </button>
  );
}

