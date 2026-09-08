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

/** Respiro entre o cartao e o botao, e a folga minima ate a borda da tela. */
const RESPIRO = 4;
const FOLGA = 8;

/**
 * O menu de acoes de uma linha da tabela do drawer.
 *
 * Mora no kit porque os dois lados do caixa usam: a parcela a receber e a
 * parcela a pagar fazem o mesmo gesto na mesma moldura. Escrito duas vezes, o
 * portal e a medida do cartao ja teriam divergido.
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
export function MenuDeLinha({
  moldura,
  gatilho,
  rotulo,
  children,
}: {
  /**
   * Sobrepoe o tamanho do gatilho.
   *
   * ⚠️ Existe para o CABECALHO do drawer, onde os botoes tem 28 e este teria 24:
   * um circulo menor no meio de tres iguais le como se estivesse desativado. O
   * padrao continua sendo o da linha da tabela.
   */
  moldura?: React.CSSProperties;
  /**
   * O que aparece DENTRO do botao, no lugar dos tres pontos.
   *
   * ⚠️ So o conteudo: o botao continua sendo deste componente, com a medida, o
   * portal e o fechar-ao-rolar. Deixar o chamador montar o proprio botao
   * duplicaria essa maquinaria em cada tela que precisasse de outro gatilho — e
   * e ela, e nao o desenho, que faz o menu funcionar dentro de uma tabela que
   * rola.
   *
   * Nasceu para a coluna "Registro" do extrato, onde o gatilho e o proprio
   * numero do titulo ("CP 168 +1") e nao um botao de acoes.
   */
  gatilho?: React.ReactNode;
  /** O que a dica e o leitor de tela dizem. Padrao: "Ações". */
  rotulo?: string;
  children: (fechar: () => void) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const [onde, setOnde] = useState<{ top: number; right: number; alturaMax: number } | null>(null);

  /*
   * ⚠️ Mede DEPOIS de abrir e antes de pintar (`useLayoutEffect`).
   *
   * Com `useEffect`, o cartao aparecia por um quadro no canto superior esquerdo
   * antes de pular para o lugar certo.
   *
   * ⚠️ Mede o CARTAO, e nao so o botao, porque a decisao depende da altura dele.
   * Preso na tela, o cartao nao e recortado por nada — e por isso tambem nao ha
   * nada que o empurre de volta quando ele passa da borda de baixo. Abrindo
   * sempre para baixo, a linha 12 de um parcelamento perdia o menu inteiro fora
   * da tela, sem barra e sem nada que explicasse. Enquanto nao mede, o cartao
   * fica com `visibility: hidden`: medir e o primeiro quadro, nunca um pulo.
   */
  useLayoutEffect(() => {
    if (!aberto || !botao.current || !cartao.current) return;

    const r = botao.current.getBoundingClientRect();
    const alturaDoCartao = cartao.current.offsetHeight;
    const larguraDoCartao = cartao.current.offsetWidth;

    const abaixo = window.innerHeight - r.bottom - RESPIRO - FOLGA;
    const acima = r.top - RESPIRO - FOLGA;

    /*
     * ⚠️ So sobe quando NAO cabe embaixo e o espaco de cima e maior. Subir por
     * estar perto do fim empurraria o menu para cima da propria linha que ele
     * pertence, e o gesto deixaria de apontar para o registro escolhido.
     */
    const paraCima = alturaDoCartao > abaixo && acima > abaixo;
    const alturaMax = Math.max(paraCima ? acima : abaixo, 120);
    const altura = Math.min(alturaDoCartao, alturaMax);

    const top = paraCima
      ? Math.max(FOLGA, r.top - RESPIRO - altura)
      : Math.min(r.bottom + RESPIRO, window.innerHeight - FOLGA - altura);

    /*
     * O cartao alinha pela direita do botao. O limite existe para o botao que
     * fica perto da borda esquerda: sem ele, o cartao sairia pelo outro lado.
     */
    const right = Math.min(
      Math.max(FOLGA, window.innerWidth - r.right),
      window.innerWidth - larguraDoCartao - FOLGA,
    );

    setOnde({ top, right, alturaMax });
  }, [aberto]);

  /*
   * ⚠️ Fechar tambem APAGA a medida. Guardada, a proxima abertura pintaria um
   * quadro no lugar da linha anterior antes de medir a nova — que e exatamente
   * o pulo que o `useLayoutEffect` existe para evitar.
   */
  function fechar() {
    setAberto(false);
    setOnde(null);
  }

  return (
    <span style={{ display: "inline-flex" }}>
      <button
        ref={botao}
        type="button"
        title={rotulo ?? "Ações"}
        aria-label={rotulo ?? "Ações"}
        aria-expanded={aberto}
        onClick={(e) => {
          // A linha pode ter clique proprio; a acao nao dispara os dois.
          e.stopPropagation();
          if (aberto) fechar();
          else setAberto(true);
        }}
        style={{ ...MOLDURA_DE_ACAO, color: "var(--text-secondary)", ...moldura }}
      >
        {gatilho ?? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3.5" cy="8" r="1.3" />
            <circle cx="8" cy="8" r="1.3" />
            <circle cx="12.5" cy="8" r="1.3" />
          </svg>
        )}
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
              onClick={fechar}
              onWheel={fechar}
              style={{ position: "fixed", inset: 0, zIndex: 440 }}
            />

            <div
              ref={cartao}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: onde?.top ?? 0,
                right: onde?.right ?? 0,
                // Enquanto nao mediu, ocupa espaco e nao aparece: e assim que a
                // altura fica conhecida antes do primeiro quadro pintado.
                visibility: onde ? "visible" : "hidden",
                zIndex: 441,
                padding: 4,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                flexDirection: "column",
                // Teto so quando nem em cima nem em baixo cabe inteiro. O menu
                // rola dentro de si; cortado, a ultima acao seria invisivel.
                maxHeight: onde?.alturaMax,
                overflowY: "auto",
              }}
            >
              {children(fechar)}
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

