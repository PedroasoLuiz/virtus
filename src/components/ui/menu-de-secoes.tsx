"use client";

import { useState } from "react";

/**
 * Menu vertical à esquerda, conteúdo à direita.
 *
 * ⚠️ É NAVEGAÇÃO vestindo o traço das abas, e não abas. A regra da casa é que
 * aba só existe em drawer: numa página, o conjunto de seções não cabe numa
 * fileira horizontal e a barra passaria a rolar de lado.
 *
 * ⚠️ Nasceu em Integrações e virou kit quando o Insights precisou do mesmo
 * gesto. Uma segunda cópia divergiria no marcador e no respiro, e duas telas
 * irmãs pediriam ao olho para aprender duas navegações.
 */

export type ItemDeSecao<T extends string> = {
  chave: T;
  rotulo: string;
  /** Uma palavra à direita do rótulo: "em breve", "sem conta". */
  nota?: string;
};

export type GrupoDeSecoes<T extends string> = {
  titulo: string;
  itens: ItemDeSecao<T>[];
};

/**
 * A moldura das duas colunas.
 *
 * ⚠️ Quem ROLA é a coluna da direita, e é isso que faz a página existir.
 *
 * `PageLayout` e `Panel` são `overflow: hidden` de propósito: no padrão de
 * listagem, quem rola é o `TableArea`, e a página nunca se mexe. Numa tela que
 * não é uma tabela só, sem um roladouro próprio o conteúdo passa da dobra e é
 * simplesmente cortado, sem barra e sem nada que explique.
 *
 * ⚠️ `minmax(0, 1fr)` na coluna do conteúdo. Sem o mínimo zero, uma tabela larga
 * estica a coluna e empurra a página inteira para o lado, em vez de rolar dentro
 * do próprio quadro.
 */
export function LayoutComMenu({
  menu,
  children,
  rolar = true,
  recolhivel = false,
}: {
  menu: React.ReactNode;
  children: React.ReactNode;
  /**
   * Deixa esconder o menu e devolver a largura ao conteudo.
   *
   * ⚠️ Recolhido, o menu some INTEIRO e sobra so o botao de trazer de volta.
   * Encolher para uma faixa de bolinhas sem rotulo pareceria navegacao, mas
   * ninguem sabe o que cada ponto significa sem o texto: seria uma economia de
   * espaco que cobra uma adivinhacao a cada uso.
   */
  recolhivel?: boolean;
  /**
   * Se a coluna da direita rola inteira.
   *
   * ⚠️ Desligado, ela vira uma coluna FLEX que cabe na tela, e quem rola passa a
   * ser uma peça de dentro: a tabela, ou a grade. É o que se quer quando as
   * seções são curtas e a página inteira se mexendo faria o cabeçalho e o menu
   * saírem de vista junto.
   *
   * ⚠️ Desligando, a seção precisa ter exatamente UMA peça com `flex: 1` e
   * rolagem própria. Sem ela, o que passar da altura é cortado em silêncio, que
   * é o defeito que este layout veio consertar.
   */
  rolar?: boolean;
}) {
  const [recolhido, setRecolhido] = useState(false);
  const escondido = recolhivel && recolhido;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: escondido ? "28px minmax(0, 1fr)" : "minmax(150px, 190px) minmax(0, 1fr)",
        gap: escondido ? 12 : 24,
        padding: "0 16px",
        alignItems: "stretch",
      }}
    >
      {/* O menu não rola junto: ele é curto e serve de âncora enquanto o
          conteúdo se move. */}
      <div style={{ alignSelf: "start" }}>
        {recolhivel && (
          <BotaoDeRecolher recolhido={recolhido} aoAlternar={() => setRecolhido((v) => !v)} />
        )}
        {!escondido && menu}
      </div>

      <div
        style={
          rolar
            ? { minWidth: 0, overflowY: "auto", paddingBottom: 16 }
            : {
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                paddingBottom: 16,
              }
        }
      >
        {children}
      </div>
    </div>
  );
}

/*
 * ⚠️ O trilho e a bolinha são os MESMOS do menu principal, e não uma barra à
 * esquerda inventada aqui.
 *
 * São dois menus verticais na mesma tela, a um palmo um do outro. Com marcadores
 * diferentes, o de dentro lia como um controle de outra natureza, e o olho
 * precisava aprender duas gramáticas de navegação para atravessar uma tela só.
 *
 * ⚠️ O anel da bolinha é da cor do fundo da ÁREA DE TRABALHO (`--bg`), e não da
 * barra lateral. É o mesmo desenho, em outro fundo: usando `--sidebar-bg` como
 * lá, o anel apareceria como um halo de cor errada em volta de cada ponto.
 */
const TRILHO_X = 5;
const TEXTO_X = 20;
const ITEM_H = 30;

/**
 * Esconde e traz o menu de volta.
 *
 * ⚠️ Fica no lugar do menu, e não flutuando sobre o conteúdo. Recolhido, ele é a
 * única pista de que existe navegação ali: jogado por cima do conteúdo, ele
 * viraria mais um botão solto e a pessoa não ligaria os dois estados.
 */
function BotaoDeRecolher({
  recolhido,
  aoAlternar,
}: {
  recolhido: boolean;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      title={recolhido ? "Mostrar o menu" : "Recolher o menu"}
      aria-label={recolhido ? "Mostrar o menu" : "Recolher o menu"}
      aria-expanded={!recolhido}
      style={{
        display: "grid",
        placeItems: "center",
        width: 24,
        height: 24,
        marginBottom: recolhido ? 0 : 8,
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: "transparent",
        color: "var(--text-tertiary)",
        cursor: "pointer",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "var(--surface-3)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: recolhido ? "rotate(180deg)" : undefined }}
      >
        <path d="M10 3.5L5.5 8l4.5 4.5" />
      </svg>
    </button>
  );
}

/**
 * O menu da esquerda.
 *
 * ⚠️ O trilho começa e termina no CENTRO do primeiro e do último marcador.
 * Descendo do topo do bloco ou indo até o fim, sobrariam pontas de linha fora da
 * sequência de pontos.
 */
export function MenuDeSecoes<T extends string>({
  grupos,
  atual,
  aoEscolher,
}: {
  grupos: GrupoDeSecoes<T>[];
  atual: T;
  aoEscolher: (chave: T) => void;
}) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {grupos.map((g) => (
        <div key={g.titulo}>
          {/*
            ⚠️ O título do grupo alinha com a BOLINHA, e não com o rótulo dos
            itens. Recuado até o texto, ele entrava na mesma coluna dos filhos e
            lia como mais um item da lista, só que sem ponto. Na altura do
            trilho, ele fica claramente um nível acima e a sequência de pontos
            começa embaixo dele.
          */}
          <span
            style={{
              display: "block",
              padding: `0 0 6px ${TRILHO_X - 3}px`,
              // Preto e um degrau maior: ele é o título do grupo, e não uma
              // etiqueta de apoio. Em terciário e miúdo, disputava com a nota
              // cinza que fica na ponta dos itens.
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
              color: "var(--text-primary)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            {g.titulo}
          </span>

          <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: TRILHO_X,
                top: ITEM_H / 2,
                bottom: ITEM_H / 2,
                width: "var(--nav-trilho-largura)",
                background: "var(--nav-trilho-cor)",
              }}
            />

            {g.itens.map((i) => {
              const ativo = atual === i.chave;

              return (
                /*
                 * ⚠️ O marcador fica FORA do botão, como no menu principal.
                 * Dentro, o fundo do item selecionado engoliria a bolinha e o
                 * trilho, e a sequência de pontos se interromperia justamente no
                 * item aceso, que é o que ela existe para apontar.
                 */
                <div key={i.chave} style={{ position: "relative" }}>
                  <span
                    aria-hidden
                    className="redondo"
                    style={{
                      position: "absolute",
                      left: TRILHO_X,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "var(--nav-marcador)",
                      height: "var(--nav-marcador)",
                      borderRadius: "var(--radius-full)",
                      background: ativo ? "var(--primary)" : "var(--nav-marcador-cor)",
                      // O anel na cor do fundo abre um respiro entre a bolinha e
                      // a linha, em vez de a linha atravessar o ponto.
                      boxShadow: "0 0 0 2px var(--bg)",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => aoEscolher(i.chave)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      width: `calc(100% - ${TRILHO_X + 5}px)`,
                      marginLeft: TRILHO_X + 5,
                      height: ITEM_H,
                      padding: `0 8px 0 ${TEXTO_X - TRILHO_X - 5}px`,
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      background: ativo ? "var(--primary-subtle)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font)",
                      fontSize: "var(--text-base)",
                      fontWeight: ativo ? 600 : 450,
                      color: ativo ? "var(--primary)" : "var(--text-secondary)",
                      transition: "background var(--dur-fast) var(--ease)",
                    }}
                    onMouseOver={(e) => {
                      if (!ativo) e.currentTarget.style.background = "var(--surface-3)";
                    }}
                    onMouseOut={(e) => {
                      if (!ativo) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {i.rotulo}

                    {i.nota && (
                      <span
                        style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}
                      >
                        {i.nota}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
