"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Kit de composicao de pagina.
 *
 * Branco e reservado ao DADO. A casca inteira — barra lateral, topo, area de
 * conteudo e cabecalho de secao — fica no cinza de fundo, sem cartao e sem
 * divisoria; so a tabela e os cards do kanban sao brancos, e e esse contraste
 * que diz onde olhar.
 *
 *   PageLayout  -> ocupa a area toda, sem recuo
 *     Panel     -> transparente, apenas empilha cabecalho e conteudo
 *       PageHeader  -> titulo + toolbar, sobre o cinza, sem linha
 *       TableFrame  -> o cartao branco: margem, raio, sem borda
 *         TableArea -> o unico elemento que rola
 *         Pagination
 */

// ════════════════════════════════════════════════════════════════
// LAYOUT
// ════════════════════════════════════════════════════════════════

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Empilha cabecalho e conteudo. Sem fundo proprio, sem borda, sem raio — quem
 * pinta e o cinza da casca.
 */
export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/**
 * O cartao branco da tabela.
 *
 * Unico elemento branco da tela junto dos cards do kanban. Sem borda: o
 * contraste com o cinza ja o recorta, e uma linha por cima disso so pesaria.
 *
 * ⚠️ O RECUO LATERAL da tabela mora aqui, e nao na tabela.
 *
 * Ele existe porque ha um cartao em volta: sem os 16, a primeira coluna encosta
 * na quina arredondada. Dentro de um drawer nao ha cartao nenhum, e a mesma
 * tabela ali aparecia afastada da borda sem nada que justificasse o vao. Quem
 * poe o cartao poe o recuo.
 */
export function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        margin: "0 16px 16px",
        padding: "0 16px",
        backgroundColor: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  acima,
  onIncluir,
  rotuloIncluir = "Adicionar",
  children,
}: {
  title: string;
  description?: string;
  /**
   * O mais COLADO no titulo, como no cabecalho de secao dos drawers.
   *
   * ⚠️ Existe para o incluir parar de morar na outra ponta da linha. Jogado a
   * direita, ele vira um botao solto que ninguem associa a tela, e o olho
   * atravessa o cabecalho inteiro para ligar "Pessoas" a "adicionar". Ao lado do
   * texto, ele le como parte do titulo — e e o mesmo gesto em toda a casa.
   */
  onIncluir?: () => void;
  rotuloIncluir?: string;
  /**
   * Caminho ate aqui, acima do titulo.
   *
   * Subpagina precisa dizer de onde veio: sem isso a tela do projeto parece uma
   * tela solta, e a unica saida vira o botao do navegador. Fica ACIMA e menor
   * que o titulo — o titulo continua sendo onde voce esta, nao de onde veio.
   *
   * A seta aponta para a DIREITA e vem depois do rotulo: ela desenha o caminho
   * "Projetos > este projeto", nao um botao de voltar. Quem clica no rotulo
   * volta; a seta so mostra a hierarquia.
   */
  acima?: { rotulo: string; href: string };
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "14px 16px",
        minHeight: "var(--h-header)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", width: "100%" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {acima && (
            <Migalha rotulo={acima.rotulo} href={acima.href} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--fw-semi)",
                color: "var(--text-primary)",
                letterSpacing: "var(--tracking-tight)",
                lineHeight: "var(--lh-tight)",
                margin: 0,
              }}
            >
              {title}
            </h1>

            {onIncluir && <BotaoMais rotulo={rotuloIncluir} onClick={onIncluir} />}
          </div>
          {description && (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-tertiary)",
                marginTop: 2,
                marginBottom: 0,
                lineHeight: "var(--lh-snug)",
              }}
            >
              {description}
            </p>
          )}
        </div>
        {children && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TABELA
// ════════════════════════════════════════════════════════════════

/** Rótulo clicável + seta que aponta adiante. */
function Migalha({ rotulo, href }: { rotulo: string; href: string }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        marginBottom: 3,
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
      }}
    >
      <a
        href={href}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          color: hover ? "var(--primary)" : "var(--text-tertiary)",
          textDecoration: "none",
          transition: "color var(--dur-fast) var(--ease)",
        }}
      >
        {rotulo}
      </a>
      <svg
        aria-hidden
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-disabled)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  );
}

export function TableArea({
  children,
  minWidth = 760,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    /*
     * ⚠️ Sem recuo lateral: ele e do cartao, e vive no `TableFrame`.
     *
     * Aqui, ele viajava junto com a tabela para dentro de drawers e paineis, que
     * nao tem cartao — e ali o vao afastava a tabela da borda sem nada em volta
     * que pedisse isso.
     *
     * ⚠️ Em cima o vao e ZERO, e nao pode voltar. O cabecalho e `sticky` e gruda
     * no topo DESTA area: qualquer respiro acima dele vira uma fresta por onde as
     * linhas aparecem enquanto rolam. Quem fecha a quina de cima e o fundo branco
     * do proprio cabecalho.
     *
     * Embaixo ficam 8: a ultima linha colada no fim esbarra no que vier depois,
     * e ali nao ha nada grudado para tapar.
     */
    <div style={{ flex: 1, overflow: "auto", minHeight: 0, paddingBottom: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth }}>{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
      {/*
        ⚠️ Cabecalho BRANCO, e nao transparente.

        Ele e `sticky`: transparente, as linhas passavam POR TRAS dele ao rolar e
        o titulo da coluna se misturava com o nome do cliente. O branco e o mesmo
        do cartao, entao ele continua sem parecer uma faixa cinza atravessando a
        tela — so deixa de deixar o conteudo vazar.
      */}
      <tr
        style={{
          /*
           * ⚠️ So o traco de BAIXO. O de cima fechava o cabecalho entre duas
           * linhas, e dentro de um cartao branco isso desenha uma faixa a dois
           * pixels da borda do proprio cartao: duas molduras paralelas, uma
           * dentro da outra. Embaixo basta, e e ele que separa rotulo de dado.
           */
          borderBottom: "1px solid var(--border)",
          height: "var(--h-th)",
        }}
      >
        {children}
      </tr>
    </thead>
  );
}

export function Th({
  children,
  align = "left",
  minWidth,
  className,
  ordem,
  onOrdenar,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  minWidth?: number;
  /** Para ajustar o recuo pelo CSS. Ver `.col-avatar` em `globals.css`. */
  className?: string;
  /**
   * Como esta coluna esta ordenando AGORA, ou null quando nao e ela.
   *
   * ⚠️ A seta so aparece na coluna ativa. Uma setinha apagada em toda coluna
   * ordenavel anuncia a funcao e, em troca, enche o cabecalho de ruido: e mais
   * honesto o cabecalho ficar limpo e a coluna ativa se declarar.
   */
  ordem?: "asc" | "desc" | null;
  /** Presente = a coluna ordena, e o titulo vira alvo de clique. */
  onOrdenar?: () => void;
}) {
  const titulo = onOrdenar ? (
    <button
      type="button"
      onClick={onOrdenar}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        // Herda tudo do `th`: o botao existe para o clique e para o teclado, e
        // nao para ter aparencia propria.
        font: "inherit",
        color: ordem ? "var(--text-secondary)" : "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
      }}
    >
      {children}

      {ordem && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ flexShrink: 0 }}
        >
          <path d={ordem === "asc" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
        </svg>
      )}
    </button>
  ) : (
    children
  );

  return (
    <th
      className={className}
      aria-sort={ordem ? (ordem === "asc" ? "ascending" : "descending") : undefined}
      // Sem `padding`: ele vem do CSS, pelo mesmo motivo do `Td`.
      style={{
        textAlign: align,
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-semi)",
        color: "var(--input-placeholder)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        userSelect: "none",
        /*
         * O fundo vai na CELULA, e nao no `<tr>`.
         *
         * ⚠️ Com `border-collapse: collapse`, o navegador nao pinta o fundo da
         * linha de cabecalho de forma confiavel: quem carrega cor ali e o `th`.
         */
        backgroundColor: "var(--surface)",
        minWidth,
      }}
    >
      {titulo}
    </th>
  );
}

export function Tr({
  children,
  delay = 0,
  onClick,
  dimmed,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  onClick?: () => void;
  /**
   * Registro desativado.
   *
   * ⚠️ Muda a COR do texto, e nao a opacidade da linha inteira. Com opacidade,
   * tudo desbotava junto — inclusive a bolinha, as siglas e os icones de acao —,
   * e a linha parecia meio carregada em vez de inativa. E a acao tem de continuar
   * legivel: reativar um cadastro se faz DA linha inativa.
   */
  dimmed?: boolean;
  /** Realce proprio da tela. O hover continua sendo do kit. */
  style?: React.CSSProperties;
}) {
  return (
    <tr
      className="tr-in"
      onClick={onClick}
      style={{
        borderBottom: "1px solid var(--border)",
        height: "var(--h-row)",
        animationDelay: `${delay}ms`,
        cursor: onClick ? "pointer" : undefined,
        transition: "background 100ms",
        color: dimmed ? "var(--text-disabled)" : undefined,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        /* Volta ao que o `style` pediu, e nao ao vazio: sem isto, o realce da
           linha escolhida sumia na primeira passagem do mouse. */
        e.currentTarget.style.backgroundColor = (style?.background as string) ?? "";
      }}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  style,
  colSpan,
  className,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  colSpan?: number;
  /** Para ajustar o recuo pelo CSS. Ver `.col-avatar` em `globals.css`. */
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={className}
      /*
       * ⚠️ Sem `padding` aqui: ele mora no CSS.
       *
       * Estilo em linha VENCE seletor, entao a regra que tira o recuo da
       * primeira e da ultima celula nunca chegava a valer enquanto o valor
       * estivesse cravado neste objeto.
       */
      style={{
        fontSize: "var(--text-sm)",
        fontWeight: 400,
        color: "var(--text-primary)",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/** Celula de valor: tabular, alinhada a direita, sem quebra. */
export const tdNum: React.CSSProperties = {
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

/**
 * A coluna de acoes, padronizada.
 *
 * Cada acao e um icone dentro da sua propria moldura, e nao um icone solto:
 * solto, o alvo de clique fica sendo o desenho, que tem buracos, e a mira falha
 * na borda. A moldura tambem separa visualmente as acoes do dado da linha, que
 * e texto sem contorno.
 *
 * Alinhada a DIREITA e sempre a ultima coluna: e o unico lugar da tabela onde se
 * clica para agir, e o olho aprende o endereco uma vez so.
 */
export function AcoesDaLinha({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end", width: "100%" }}>
      {children}
    </span>
  );
}

export function BotaoDeAcao({
  rotulo,
  onClick,
  desabilitado,
  perigo,
  destaque,
  children,
}: {
  /** Vai no `title` e no `aria-label`: icone sozinho nao se le. */
  rotulo: string;
  onClick: () => void;
  desabilitado?: boolean;
  perigo?: boolean;
  /**
   * Tinge SO o icone com o verde da marca.
   *
   * ⚠️ A moldura continua a mesma dos outros. Colorir o botao inteiro o
   * transformaria em botao primario no meio de uma linha de acoes de apoio, e
   * ele passaria a chamar mais atencao que a propria linha da tabela.
   */
  destaque?: boolean;
  /** Os tracos do icone, na grade de 16. */
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={(e) => {
        // A linha costuma ter clique proprio; a acao nao dispara os dois.
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 26,
        height: 26,
        flexShrink: 0,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: hover && !desabilitado ? "var(--surface-2)" : "var(--surface)",
        padding: 0,
        color: desabilitado
          ? "var(--text-disabled)"
          : perigo
            ? "var(--danger)"
            : destaque
              ? "var(--primary)"
              : "var(--text-secondary)",
        cursor: desabilitado ? "not-allowed" : "pointer",
        transition: "background var(--dur) var(--ease)",
      }}
    >
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
    </button>
  );
}

/**
 * A tabela enquanto os dados nao chegaram.
 *
 * ⚠️ Cada bloco tem a largura do ROTULO da sua coluna, em `ch`. Larguras
 * inventadas em porcentagem faziam o esqueleto desenhar uma tabela que nao era
 * a que ia aparecer, e a linha inteira saltava quando os dados chegavam. Pelo
 * rotulo, o esqueleto ja nasce nas colunas certas.
 *
 * Cantos totalmente arredondados e o verde do quadro, e nao um cinza proprio:
 * assim a espera pertence a mesma paleta do resto e nao vira um estado com
 * identidade visual so dele.
 */
export function SkeletonRows({
  cols,
  rows = 8,
  labels,
}: {
  cols: number;
  rows?: number;
  /** Os titulos das colunas, na ordem. Cada bloco toma a largura do seu. */
  labels?: string[];
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} style={{ borderBottom: "1px solid var(--border)", height: "var(--h-row)" }}>
          {Array.from({ length: cols }, (_, j) => {
            const rotulo = labels?.[j]?.trim() ?? "";

            return (
              <td key={j}>
                {/* Coluna sem titulo (a das ações) fica vazia mesmo: nao ha
                    conteudo previsivel para prometer ali. */}
                {labels && rotulo.length === 0 ? null : (
                  <div
                    className="sk"
                    style={{
                      height: 13,
                      width: labels
                        ? `${Math.max(4, rotulo.length)}ch`
                        : j === 0
                          ? "50%"
                          : j === 1
                            ? "80%"
                            : "60%",
                      borderRadius: 999,
                      backgroundColor: "var(--kanban-coluna-bg)",
                    }}
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export function EmptyRow({
  colSpan,
  message = "Nenhum resultado encontrado.",
}: {
  colSpan: number;
  message?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: "48px 16px", textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span style={{ fontSize: "var(--text-base)", color: "var(--text-tertiary)" }}>{message}</span>
        </div>
      </td>
    </tr>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGINACAO
// ════════════════════════════════════════════════════════════════

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const de = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const ate = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        flexShrink: 0,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        /*
         * Sem recuo proprio: ela nasce colada na tabela, e o afastamento da
         * borda vem de quem as envolve — o cartao na tela, o drawer no drawer.
         *
         * ⚠️ Aqui houve 76 a direita, folga para o botao flutuante do WhatsApp
         * nao cobrir o "proxima pagina". Ele saiu do canto da tela e foi para a
         * barra lateral, entao a folga virou um vao de sessenta pixels defendendo
         * a tela de um botao que nao existe mais ali.
         */
        /*
         * Sem fundo e sem borda de topo: a paginacao vira rodape da tabela, e
         * uma barra cinza embaixo de uma tabela que ja nao tem moldura
         * desenhava um rodape que nao existe mais.
         */
        fontSize: "var(--text-sm)",
        color: "var(--text-tertiary)",
      }}
    >
      <span>
        {de}–{ate} de {total}
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <BotaoPagina disabled={page <= 1} onClick={() => onPage(page - 1)} rotulo="Anterior">
          ‹
        </BotaoPagina>
        <span style={{ padding: "0 8px", color: "var(--text-secondary)" }}>
          {page} / {totalPages}
        </span>
        <BotaoPagina disabled={page >= totalPages} onClick={() => onPage(page + 1)} rotulo="Proxima">
          ›
        </BotaoPagina>
      </div>
    </div>
  );
}

function BotaoPagina({
  children,
  disabled,
  onClick,
  rotulo,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  rotulo: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      style={{
        width: 24,
        height: 24,
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: disabled ? "var(--text-disabled)" : "var(--text-secondary)",
        cursor: disabled ? "default" : "pointer",
        fontSize: 14,
        lineHeight: 1,
        fontFamily: "var(--font)",
      }}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// BOTOES
// ════════════════════════════════════════════════════════════════

export function Button({
  children,
  variant = "secondary",
  size = "md",
  onClick,
  disabled,
  type = "button",
  style,
  title,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /**
   * `xs` existe para a linha de botoes do CABECALHO do drawer.
   *
   * ⚠️ Os 28px sao os do X e dos icones que moram ali: um botao de 30 ao lado
   * deles desalinha a linha inteira, e a diferenca de dois pixels e daquelas que
   * se ve sem saber nomear. A letra desce junto, senao o texto encosta na borda.
   */
  size?: "xs" | "sm" | "md";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
  title?: string;
}) {
  const cores: Record<string, React.CSSProperties> = {
    primary: { background: "var(--primary)", color: "var(--primary-fg)", border: "1px solid transparent" },
    secondary: {
      background: "var(--surface)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-strong)",
    },
    ghost: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
    danger: { background: "var(--danger)", color: "#fff", border: "1px solid transparent" },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height:
          size === "xs" ? "var(--h-btn-xs)" : size === "sm" ? "var(--h-btn-sm)" : "var(--h-btn)",
        padding: size === "xs" ? "0 10px" : size === "sm" ? "0 12px" : "0 16px",
        borderRadius: size === "xs" ? "var(--radius-sm)" : "var(--radius-md)",
        fontSize: size === "xs" ? "var(--text-sm)" : "var(--text-base)",
        fontWeight: "var(--fw-medium)",
        fontFamily: "var(--font)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        whiteSpace: "nowrap",
        transition: "filter var(--dur-fast) var(--ease)",
        ...cores[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Botao de cadastro padrao, presente em todas as listagens. */
/**
 * Cabecalho de secao: titulo, acao redonda e a legenda embaixo.
 *
 * ⚠️ A legenda nao e enfeite. Estas telas sao de configuracao, e configuracao
 * sem explicacao vira tentativa e erro em cima de coisa que manda mensagem para
 * cliente. Uma frase dizendo o que se faz ali evita a pergunta.
 *
 * O titulo fica um degrau abaixo do titulo do drawer (`--text-lg` contra
 * `--text-xl`): sao secoes DENTRO dele, e igualar os dois apagaria a hierarquia.
 */
export function CabecalhoDeSecao({
  titulo,
  legenda,
  onIncluir,
  rotuloIncluir = "Adicionar",
  acao,
  primeiro = false,
  colado = false,
}: {
  titulo: string;
  legenda: string;
  onIncluir?: () => void;
  rotuloIncluir?: string;
  /**
   * Um gesto colado no titulo, no lugar do mais.
   *
   * ⚠️ Colado, e nao na outra ponta da linha: jogado a direita ele vira um botao
   * solto que ninguem associa a secao. Existe para quando a acao nao e
   * "adicionar" — um olho que mostra a previa, por exemplo.
   */
  acao?: React.ReactNode;
  /**
   * O que vem logo abaixo PERTENCE ao cabecalho, e nao e o conteudo da secao.
   *
   * ⚠️ Existe para o caso do filtro. Um seletor que decide o que a tabela mostra
   * e parte do cabecalho, e com o respiro cheio ele flutuava no meio do caminho,
   * mais perto da tabela do que da legenda que o explica. Encurtando aqui, o
   * respiro cheio vai para DEPOIS do filtro, que e onde a secao comeca de fato.
   */
  colado?: boolean;
  /**
   * Primeiro da tela: metade do respiro em cima.
   *
   * O vao de 22 existe para separar uma secao da ANTERIOR. No topo nao ha
   * anterior, e o mesmo vao vira um buraco entre o cabecalho do drawer e o
   * comeco do conteudo.
   */
  primeiro?: boolean;
}) {
  return (
    /*
     * Respiro generoso em cima e embaixo: sao quatro abas com a mesma anatomia,
     * e sem folga o titulo de uma cola no fim da anterior e as quatro viram uma
     * parede so.
     */
    <div style={{ marginTop: primeiro ? 11 : 22, marginBottom: colado ? 10 : 26 }}>
      {/*
        O mais fica COLADO no titulo, e nao na outra ponta da linha.
        
        Jogado a direita, ele vira um botao solto que ninguem associa a secao, e
        o olho precisa atravessar a tela para ligar "Personas" a "adicionar".
        Ao lado do texto, ele le como parte do titulo.
      */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            // Dois pixels acima do `--text-lg`: com 14 o titulo empatava com o
            // corpo da tabela e a secao nao comecava em lugar nenhum.
            fontSize: "calc(var(--text-lg) + 2px)",
            fontWeight: "var(--fw-semi)",
            color: "var(--text-primary)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          {titulo}
        </span>

        {onIncluir && <BotaoMais rotulo={rotuloIncluir} onClick={onIncluir} />}
        {acao}
      </div>

      <p
        style={{
          marginTop: 6,
          // Um acima do `--text-xs`: a legenda e para ser LIDA, e 9px cobra
          // esforco de quem chega numa tela que ja e de configuracao.
          fontSize: "calc(var(--text-xs) + 1px)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-normal)",
        }}
      >
        {legenda}
      </p>
    </div>
  );
}

/**
 * Circulo pequeno com o mais dentro.
 *
 * Redondo e so com o icone: a acao e sempre a mesma em toda secao, e o rotulo
 * escrito repetiria "Adicionar" quatro vezes na mesma tela. O nome vive no
 * `title` e no `aria-label`, onde serve a quem precisa dele.
 */
export function BotaoMais({ rotulo, onClick }: { rotulo: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={rotulo}
      aria-label={rotulo}
      style={{
        flexShrink: 0,
        width: 18,
        height: 18,
        display: "grid",
        placeItems: "center",
        border: "none",
        /*
         * ⚠️ Circulo de verdade, e nao o raio do sistema. Os tokens de raio
         * servem a caixas; este e um alvo de 18px, e qualquer raio menor que
         * metade dele o deixaria com cara de quadrado amassado.
         */
        borderRadius: "50%",
        /*
         * ⚠️ `--primary`, e nao `--success`.
         *
         * Sao dois verdes diferentes: `success` significa "deu certo" e muda
         * junto com os outros estados, entao o botao de incluir mudaria de cor
         * no dia em que alguem calibrasse a cor de confirmacao. Aqui e a cor da
         * marca, que e o que uma acao primaria usa.
         */
        background: "var(--primary)",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6.75 1.75a.75.75 0 0 0-1.5 0V5.25H1.75a.75.75 0 0 0 0 1.5H5.25v3.5a.75.75 0 0 0 1.5 0V6.75h3.5a.75.75 0 0 0 0-1.5H6.75V1.75z" />
      </svg>
    </button>
  );
}

export function IncluirButton({ onClick, rotulo = "Incluir" }: { onClick?: () => void; rotulo?: string }) {
  return (
    <Button variant="primary" size="sm" onClick={onClick} style={{ padding: "0 16px" }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M6.75 1.75a.75.75 0 0 0-1.5 0V5.25H1.75a.75.75 0 0 0 0 1.5H5.25v3.5a.75.75 0 0 0 1.5 0V6.75h3.5a.75.75 0 0 0 0-1.5H6.75V1.75z" />
      </svg>
      {rotulo}
    </Button>
  );
}

// ════════════════════════════════════════════════════════════════
// BUSCA
// ════════════════════════════════════════════════════════════════

export function SearchInput({
  value,
  onSearch,
  placeholder = "Pesquisar",
  width = "var(--toolbar-search-w)",
}: {
  value: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  width?: string | number;
}) {
  const [local, setLocal] = useState(value);
  const limpar = () => {
    setLocal("");
    onSearch("");
  };

  return (
    <div style={{ position: "relative", width }}>
      <div
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text-tertiary)",
          pointerEvents: "none",
          display: "flex",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch(local);
          if (e.key === "Escape") limpar();
        }}
        placeholder={placeholder}
        style={{
          height: "var(--toolbar-input-h)",
          width: "100%",
          padding: "0 52px 0 32px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          color: "var(--input-color)",
          fontSize: "var(--text-base)",
          outline: "none",
          fontFamily: "var(--font)",
        }}
      />
      {!local ? (
        <span
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 9,
            color: "var(--kbd-color)",
            background: "var(--kbd-bg)",
            border: "1px solid var(--kbd-border)",
            borderRadius: 3,
            padding: "1px 4px",
            lineHeight: 1.4,
            pointerEvents: "none",
          }}
        >
          Enter
        </span>
      ) : (
        <button
          onClick={limpar}
          aria-label="Limpar busca"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-tertiary)",
            fontSize: 16,
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// FILTROS
// ════════════════════════════════════════════════════════════════

export function FilterItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function FilterButton({
  children,
  activeCount = 0,
  onClear,
}: {
  children: React.ReactNode;
  activeCount?: number;
  onClear: () => void;
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

  const ativo = activeCount > 0;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Filtros"
        style={{
          height: "var(--toolbar-input-h)",
          padding: "0 10px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          backgroundColor: ativo ? "var(--primary-subtle)" : aberto ? "var(--surface-3)" : "var(--surface)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: ativo ? "var(--primary)" : "var(--text-primary)",
          fontFamily: "var(--font)",
          fontSize: "var(--text-base)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2h-11z" />
        </svg>
        {ativo && (
          <span
            style={{
              minWidth: 16,
              height: 16,
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--primary)",
              color: "var(--primary-fg)",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {aberto && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 300,
            minWidth: 230,
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid var(--border)" }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Filtros
            </span>
          </div>
          <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
          <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px" }}>
            <button
              onClick={() => {
                onClear();
                setAberto(false);
              }}
              style={{
                width: "100%",
                padding: "5px 0",
                background: "none",
                border: "none",
                cursor: ativo ? "pointer" : "default",
                fontSize: "var(--text-sm)",
                color: ativo ? "var(--danger-text)" : "var(--text-disabled)",
                fontFamily: "var(--font)",
                fontWeight: 500,
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Alternador de modo de exibicao — mesmo desenho do SIC.
 *
 * O botao mostra so o icone do modo atual; a palavra aparece nas opcoes do
 * dropdown. Na barra de ferramentas, dois rotulos lado a lado competiriam com
 * o titulo da pagina por atencao.
 */
export function ViewButton({
  view,
  setView,
  opcoes,
}: {
  view: string;
  setView: (v: string) => void;
  opcoes: { valor: string; rotulo: string; icone: React.ReactNode }[];
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

  const atual = opcoes.find((o) => o.valor === view) ?? opcoes[0];

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={`Modo de exibição: ${atual.rotulo}`}
        title={atual.rotulo}
        style={{
          height: "var(--toolbar-input-h)",
          padding: "0 10px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          backgroundColor: aberto ? "var(--surface-3)" : "var(--surface)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: "var(--text-primary)",
          fontFamily: "var(--font)",
          transition: "background var(--dur-fast) var(--ease)",
        }}
      >
        {atual.icone}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>

      {aberto && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 300,
            minWidth: 130,
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            padding: 4,
          }}
        >
          {opcoes.map((o) => {
            const selecionada = o.valor === view;
            return (
              <button
                key={o.valor}
                onClick={() => {
                  setView(o.valor);
                  setAberto(false);
                }}
                onMouseEnter={(e) => {
                  if (!selecionada) e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = selecionada
                    ? "var(--primary-subtle)"
                    : "transparent";
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: selecionada ? "var(--primary-subtle)" : "transparent",
                  color: selecionada ? "var(--primary)" : "var(--text-primary)",
                  fontSize: "var(--text-base)",
                  fontWeight: selecionada ? "var(--fw-medium)" : 400,
                  fontFamily: "var(--font)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {o.icone}
                {o.rotulo}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Icones dos modos de exibicao. */
export function IconeTabela() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

export function IconeKanban() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="5" height="15" rx="1" />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════
// BADGE
// ════════════════════════════════════════════════════════════════

export type Tom = "success" | "warning" | "danger" | "info" | "neutral";

export function Badge({ tom = "neutral", children }: { tom?: Tom; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        // Respiro para quando vier um ícone antes do texto. Sem ícone, não muda
        // nada: o `gap` só existe entre dois filhos.
        gap: 4,
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semi)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        // Flag nao leva borda em lugar nenhum do app: o fundo tingido ja a
        // recorta, e o contorno so acrescenta uma linha para o olho processar.
        background: `var(--${tom}-bg)`,
        color: `var(--${tom}-text)`,
      }}
    >
      {children}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// FORMULARIO
// ════════════════════════════════════════════════════════════════

/**
 * Campo editavel.
 *
 * Mesma altura e mesmo corpo de texto do `CampoBloqueado`: os dois aparecem na
 * mesma pilha de campos, e ler e editar nao podem mudar o tamanho da letra —
 * a linha "salta" ao entrar em edicao.
 */
export const inputStyle: React.CSSProperties = {
  height: "var(--h-input)",
  padding: "0 8px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--input-border)",
  backgroundColor: "var(--input-bg)",
  color: "var(--input-color)",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font)",
  outline: "none",
  width: "100%",
};

/**
 * Seta desenhada por nos, no lugar da nativa.
 *
 * A do sistema vem grande, preta e colada na borda direita — e nao aceita
 * estilo. `appearance: none` a remove e o chevron entra como background: 9px,
 * cinza, com 12px de respiro ate a borda.
 *
 * Data-URI e nao arquivo: um `<img>` externo aqui seria uma requisicao por
 * select em tela.
 */
const CHEVRON =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 9 6' fill='none' stroke='%2386868b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l3.5 3.5L8 1'/%3E%3C/svg%3E";

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  paddingRight: 28,
  backgroundImage: `url("${CHEVRON}")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
};

/**
 * Campo de segredo com olho para revelar.
 *
 * ⚠️ Escondido por padrao, e revelado por gesto: estes valores sao colados de
 * outra aba e conferidos uma vez, e ficam na tela enquanto o resto do
 * formulario e preenchido. Visivel o tempo todo, um token de producao fica
 * exposto a quem passar atras da cadeira.
 */
export function CampoSecreto({
  valor,
  placeholder,
  onMudar,
}: {
  valor: string;
  placeholder: string;
  onMudar: (v: string) => void;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        // Espaco a direita para o olho, que fica DENTRO da caixa: fora dela,
        // ele desalinharia este campo dos outros do formulario.
        style={{ ...inputStyle, paddingRight: 30 }}
        type={visivel ? "text" : "password"}
        autoComplete="off"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
      />

      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        title={visivel ? "Ocultar" : "Mostrar"}
        aria-label={visivel ? "Ocultar o valor" : "Mostrar o valor"}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          width: 20,
          height: 20,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          color: "var(--text-tertiary)",
          cursor: "pointer",
        }}
      >
        {visivel ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2l20 20" />
            <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10.2 6 10.2 6a18 18 0 0 1-3.3 3.9" />
            <path d="M6.3 6.9A17.6 17.6 0 0 0 1.8 12S5.5 18 12 18a9.9 9.9 0 0 0 4-.8" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
        <span
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: Tom;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--radius-lg)",
        backgroundColor: `var(--${variant}-bg)`,
        border: `1px solid var(--${variant}-border)`,
      }}
    >
      {/*
        O TEXTO nao muda de cor, so o cartao.

        Titulo colorido competia com o titulo da secao logo acima e vencia, o
        que fazia um aviso de apoio parecer o assunto da tela. O fundo e a borda
        ja dizem a gravidade; a cor do texto repetindo isso so tira legibilidade,
        porque `--danger-text` sobre `--danger-bg` tem menos contraste que o
        preto do resto da pagina.
      */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-base)",
              fontWeight: "var(--fw-semi)",
              color: "var(--text-primary)",
              marginBottom: children ? 2 : 0,
            }}
          >
            {/*
              O icone carrega a cor que o titulo deixou de carregar.

              Com o texto todo neutro, sobrava so o fundo para dizer a gravidade,
              e fundo tingido de leve se perde em tela clara. Um simbolo colorido
              de 14px resolve sem gritar, e ainda diz a diferenca a quem nao
              distingue as duas cores.
            */}
            <IconeDoAviso variant={variant} />
            <span style={{ minWidth: 0 }}>{title}</span>
          </div>
        )}
        {children && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * O simbolo do aviso, por tom.
 *
 * Formas DIFERENTES, e nao a mesma bolinha em quatro cores: quem enxerga pouca
 * diferenca entre vermelho e ambar continua lendo triangulo como alerta e X como
 * erro. A cor e reforco, nao o unico sinal.
 */
function IconeDoAviso({ variant }: { variant: Tom }) {
  const comum = {
    width: 14,
    height: 14,
    viewBox: "0 0 20 20",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span
      style={{ flexShrink: 0, display: "inline-flex", color: `var(--${variant}-text)` }}
      aria-hidden
    >
      {variant === "danger" ? (
        <svg {...comum}>
          <circle cx="10" cy="10" r="7.4" />
          <path d="M7.6 7.6l4.8 4.8M12.4 7.6l-4.8 4.8" />
        </svg>
      ) : variant === "warning" ? (
        <svg {...comum}>
          <path d="M10 3.2l7 12.2H3z" />
          <path d="M10 8v3.1M10 13.3v.1" />
        </svg>
      ) : variant === "success" ? (
        <svg {...comum}>
          <circle cx="10" cy="10" r="7.4" />
          <path d="M6.6 10.2l2.3 2.3 4.5-4.8" />
        </svg>
      ) : (
        <svg {...comum}>
          <circle cx="10" cy="10" r="7.4" />
          <path d="M10 9.2v4.2M10 6.6v.1" />
        </svg>
      )}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// FORMULARIO — mesmo padrao do SIC
// ════════════════════════════════════════════════════════════════

/**
 * Par rotulo/campo. Rotulo com largura fixa de 130px: e o que alinha todos os
 * campos do drawer numa coluna so, sem grid.
 */
/**
 * Rotulo a esquerda, campo a direita.
 *
 * O `hint` vive num icone ao lado do rotulo, e nao numa linha abaixo do campo:
 * texto que aparece e some conforme o estado empurrava tudo que vinha depois,
 * e o formulario mudava de altura enquanto se preenchia. Erro continua embaixo
 * — esse precisa ser lido sem procurar.
 *
 * A label alinha ao TOPO, com o recuo que a deixa centrada num campo de uma
 * linha. Centrada de verdade, ao lado de um textarea de quatro linhas ela
 * descia para o meio do texto e parecia rotular o paragrafo, nao o campo.
 */
export function Field({
  label,
  children,
  required,
  hint,
  error,
}: {
  label?: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minHeight: 28 }}>
      {label && (
        <label
          style={{
            width: 130,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            // (--h-input - lineHeight) / 2 — o mesmo centro de um campo de uma
            // linha, sem depender de `align-items: center`.
            paddingTop: 5,
            lineHeight: "16px",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-medium)",
            color: error ? "var(--danger-text)" : "var(--text-tertiary)",
          }}
        >
          <span>
            {label}:
            {required && (
              <span style={{ color: "var(--danger-text)", fontWeight: 700, marginLeft: 2 }}>*</span>
            )}
          </span>
          {hint && !error && <Info texto={hint} />}
        </label>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {children}
        {error && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--danger-text)" }}>{error}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Um grupo de campos dentro de um FORMULARIO.
 *
 * ⚠️ Nao e o `CabecalhoDeSecao`, e a diferenca nao e estetica. Aquele separa
 * SECOES DE TELA — uma tabela da outra, uma lista da seguinte — e por isso tem o
 * respiro grande. Este agrupa campos: o titulo fica colado no primeiro deles, e
 * os campos ficam colados entre si.
 *
 * ⚠️ As tres medidas sao TOKENS (`--form-gap-*`), e nao numeros aqui. Elas se
 * definem umas pelas outras: campos colados, titulo colado no primeiro campo, e
 * o vao grande so entre assuntos. Igualar duas quaisquer apaga a divisao que as
 * tres existem para desenhar, e um numero solto num componente e o comeco
 * disso.
 *
 * Nasceu no formulario de personas do WhatsApp e virou kit quando o cadastro de
 * pessoa precisou do mesmo ritmo: duas copias divergiriam no primeiro ajuste.
 */
export function GrupoDeCampos({
  titulo,
  legenda,
  primeiro,
  onIncluir,
  rotuloIncluir = "Adicionar",
  children,
}: {
  titulo: string;
  legenda: string;
  /** Primeiro do formulario: sem o respiro que separa um grupo do anterior. */
  primeiro?: boolean;
  /**
   * O mais, colado no titulo.
   *
   * ⚠️ Colado, e nao um botao no fim da lista. Ele e a acao DO GRUPO, e no rodape
   * de uma tabela que rola ele descia junto com a ultima linha: quem tinha oito
   * telefones precisava rolar ate o fim para achar como cadastrar o nono.
   */
  onIncluir?: () => void;
  rotuloIncluir?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ marginBottom: "var(--form-gap-titulo)", marginTop: primeiro ? 0 : 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: "calc(var(--text-lg) + 2px)",
              fontWeight: "var(--fw-semi)",
              color: "var(--text-primary)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            {titulo}
          </span>

          {onIncluir && <BotaoMais rotulo={rotuloIncluir} onClick={onIncluir} />}
        </div>
        <p
          style={{
            marginTop: 6,
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          {legenda}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--form-gap-campo)" }}>
        {children}
      </div>
    </section>
  );
}

/**
 * O formulario que cadastra ou corrige um item da lista logo acima.
 *
 * ⚠️ SEM caixa, sem fundo e sem moldura. Ele ja foi um cartao cinza com borda, e
 * dentro de um drawer que e todo branco aquilo virava um bloco pesado no meio de
 * uma tela leve: uma segunda superficie por cima da superficie, para dizer
 * apenas "estes campos estao juntos".
 *
 * O que separa e um FIO, do mesmo jeito que a tabela acima separa uma linha da
 * outra. Um fio custa um pixel e diz a mesma coisa que a caixa dizia.
 *
 * ⚠️ O fio fica ABAIXO do titulo, e nao acima. Acima, ele separava o formulario
 * do que veio antes; abaixo, ele sublinha o titulo e vira o comeco do bloco. E a
 * mesma anatomia de todo cabecalho de secao do sistema.
 *
 * ⚠️ O titulo existe. Sem ele, os campos apareciam do nada embaixo da tabela e
 * ninguem sabia se aquilo era um cadastro novo ou a linha que acabou de ser
 * clicada.
 */
export function FormularioDaLista({
  titulo,
  children,
  onExcluir,
  onCancelar,
  onSalvar,
  rotuloSalvar = "Adicionar",
  podeSalvar = true,
  salvando = false,
}: {
  titulo: string;
  children: React.ReactNode;
  /** Ausente no cadastro novo, e tambem quando o item e o unico da lista. */
  onExcluir?: () => void;
  onCancelar: () => void;
  onSalvar: () => void;
  rotuloSalvar?: string;
  podeSalvar?: boolean;
  salvando?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 18,
        display: "flex",
        flexDirection: "column",
        gap: "var(--form-gap-campo)",
      }}
    >
      <div
        style={{
          paddingBottom: 8,
          marginBottom: "var(--form-gap-titulo)",
          borderBottom: "1px solid var(--border)",
          fontSize: "var(--text-base)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-primary)",
        }}
      >
        {titulo}
      </div>

      {children}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        {/*
          Excluir na outra ponta da linha: e a unica acao daqui que nao da para
          desfazer, e ao lado de "Salvar" ela vira erro de mira.
        */}
        {onExcluir && (
          <Button size="sm" variant="ghost" onClick={onExcluir}>
            <span style={{ color: "var(--danger-text)" }}>Excluir</span>
          </Button>
        )}

        <div style={{ flex: 1 }} />

        <Button size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>

        <Button size="sm" variant="primary" disabled={!podeSalvar || salvando} onClick={onSalvar}>
          {salvando ? "Salvando…" : rotuloSalvar}
        </Button>
      </div>
    </div>
  );
}

/**
 * A caixa de marcacao, numa coluna de tabela.
 *
 * ⚠️ QUADRADA, e a do principal e redonda. E a distincao de sempre entre escolher
 * varios e escolher um. Quando as duas aparecem lado a lado, com a mesma forma
 * ninguem saberia qual delas aceita mais de uma marca.
 */
export function MarcaDeUso({
  marcado,
  rotulo,
  desabilitado,
  onClick,
}: {
  marcado: boolean;
  rotulo: string;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={marcado}
      aria-label={rotulo}
      title={rotulo}
      style={{
        width: 22,
        height: 22,
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
        border: "none",
        background: "transparent",
        cursor: desabilitado ? "default" : "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 15,
          height: 15,
          display: "grid",
          placeItems: "center",
          borderRadius: 4,
          border: `1px solid ${marcado ? "var(--primary)" : "var(--border-strong)"}`,
          background: marcado ? "var(--primary)" : "transparent",
          color: "var(--primary-fg)",
        }}
      >
        {marcado && (
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5.5 5.5L20 6.5" />
          </svg>
        )}
      </span>
    </button>
  );
}

/**
 * A marca do PRINCIPAL, numa coluna de tabela.
 *
 * ⚠️ Um unico controle para os dois estados, e nao "Principal" escrito de um
 * lado e um botao do outro. E uma escolha exclusiva dentro da coluna — o mesmo
 * gesto do radio de um formulario —, e dois desenhos fariam a linha marcada
 * parecer de outro tipo.
 *
 * ⚠️ Sem rotulo na celula. Quem le a coluna de cima a baixo procura QUAL esta
 * marcado, e a palavra repetida em cada linha atrapalha exatamente essa
 * varredura. O nome vive no `title`, onde serve a quem precisa.
 */
export function MarcaDePrincipal({
  marcado,
  rotulo,
  onClick,
}: {
  marcado: boolean;
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marcado}
      aria-label={rotulo}
      title={rotulo}
      style={{
        width: 22,
        height: 22,
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-full)",
        cursor: marcado ? "default" : "pointer",
        color: marcado ? "var(--primary)" : "var(--text-disabled)",
      }}
    >
      {marcado ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path
            d="M8 12.4l2.6 2.6L16 9.6"
            fill="none"
            stroke="var(--primary-fg)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
    </button>
  );
}

/**
 * A coluna que empilha os grupos de um formulario.
 *
 * ⚠️ Existe para o vao entre grupos nao ser digitado em cada tela. Ele e o maior
 * dos tres e o unico que a pessoa realmente ve como divisao: escrito na mao,
 * viraria 20 num drawer e 24 no outro sem ninguem perceber.
 */
export function Formulario({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--form-gap-grupo)" }}>
      {children}
    </div>
  );
}

/** O "i" que revela a explicacao no hover. Nativo: tooltip proprio seria um popover. */
function Info({ texto }: { texto: string }) {
  return (
    <span
      title={texto}
      aria-label={texto}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 12,
        height: 12,
        flexShrink: 0,
        // Bolinha cheia, sem contorno: com borda de 1px num circulo de 11px o
        // traco comia metade do miolo e a forma lia como um quadradinho.
        borderRadius: "var(--radius-full)",
        background: "var(--surface-3)",
        color: "var(--text-tertiary)",
        fontSize: 9,
        fontWeight: "var(--fw-semi)",
        lineHeight: 1,
        fontStyle: "italic",
        cursor: "help",
      }}
    >
      i
    </span>
  );
}

export function Row2({ children, cols }: { children: React.ReactNode; cols?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols ?? "1fr 1fr", gap: 16 }}>
      {children}
    </div>
  );
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: "auto",
  minHeight: 72,
  padding: "6px 8px",
  resize: "vertical",
  lineHeight: "var(--lh-normal)",
};

/** Alterna ativo/inativo. Mesmo desenho do SIC. */
export function ActiveToggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    /*
     * ⚠️ A caixa em volta e o que alinha.
     *
     * O interruptor tem 20px e o campo de texto tem 26, e o `Field` centra o
     * rotulo pelo campo: solto, ele ficava tres pixels acima da propria label.
     * Ocupando a altura de um campo, ele passa a se alinhar em qualquer lugar
     * do sistema sem cada tela corrigir por conta.
     */
    <span style={{ display: "inline-flex", alignItems: "center", height: "var(--h-input)" }}>
    <button
      type="button"
      onClick={onChange}
      title={active ? "Inativar" : "Ativar"}
      aria-pressed={active}
      style={{
        width: 36,
        height: 20,
        borderRadius: "var(--radius-full)",
        backgroundColor: active ? "var(--primary)" : "var(--text-disabled)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background-color var(--dur) var(--ease)",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: active ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "#fff",
          transition: "left var(--dur) var(--ease)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
    </span>
  );
}

/** Cadeado de campo somente-leitura. Mesmo desenho do SIC. */
export function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-tertiary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

/**
 * Campo somente-leitura.
 *
 * Mesmo desenho de um input normal, mas com fundo apagado e cadeado a direita.
 * Mostrar o valor como texto solto faria a tela parecer editavel em alguns
 * pontos e nao em outros; o cadeado diz por que aquele campo nao aceita foco.
 */
export function CampoBloqueado({
  valor,
  multilinha = false,
  titulo,
}: {
  valor: string;
  multilinha?: boolean;
  /** Explicacao no hover. Para campo derivado, evita gastar uma linha de dica. */
  titulo?: string;
}) {
  // Altura e corpo de texto vem do `inputStyle`: ler e editar tem de ter o
  // mesmo tamanho, senao a linha salta ao entrar em edicao.
  //
  // Mesmo cinza do cabecalho de tabela do drawer (`--surface-2`): o tom mais
  // escuro anterior competia com a tabela por peso visual. A borda acompanha,
  // no hairline padrao em vez do contorno de campo editavel.
  const base: React.CSSProperties = {
    ...inputStyle,
    backgroundColor: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    cursor: "default",
    paddingRight: 26,
  };

  if (multilinha) {
    return (
      <div style={{ position: "relative" }}>
        <textarea
          value={valor}
          readOnly
          title={titulo}
          style={{ ...base, height: "auto", minHeight: 60, padding: "6px 28px 6px 8px", resize: "none" }}
        />
        <span style={{ position: "absolute", right: 8, top: 8, display: "flex" }}>
          <LockIcon />
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input value={valor} readOnly title={titulo} style={base} />
      <span
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          pointerEvents: "none",
        }}
      >
        <LockIcon />
      </span>
    </div>
  );
}

/** Abas de conteudo dentro de um drawer. Mesmo padrao do SIC. */
export function PanelTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        // Fio cinza de ponta a ponta na mesma linha do marcador: e ele que
        // fecha a faixa das abas e separa o cabecalho do conteudo. O marcador
        // de 2px passa por cima com `marginBottom: -1`.
        borderBottom: "1px solid var(--border)",
        marginBottom: 18,
        flexShrink: 0,
      }}
    >
      {tabs.map((t) => {
        const ativa = active === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              padding: "4px 0 8px",
              border: "none",
              borderBottom: `2px solid ${ativa ? "var(--primary)" : "transparent"}`,
              background: "none",
              cursor: "pointer",
              fontFamily: "var(--font)",
              fontSize: "var(--text-base)",
              fontWeight: ativa ? 600 : 400,
              color: ativa ? "var(--primary)" : "var(--text-secondary)",
              marginBottom: -1,
              transition: "color var(--dur-fast) var(--ease)",
              whiteSpace: "nowrap",
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Progresso de recebimento.
 *
 * Total em cima, barra fina no meio, e embaixo o que entrou a esquerda contra o
 * que falta a direita. Vinha da tela do VPay FlutterFlow, e e a primeira coisa
 * do drawer porque e a pergunta que abre a fatura: "quanto ainda tenho a
 * receber daqui?".
 */
export function ProgressoValor({
  total,
  pago,
  rotuloEntrada = "Recebido",
}: {
  total: number;
  pago: number;
  /** "Recebido" numa fatura, "Pago" numa conta a pagar. */
  rotuloEntrada?: string;
}) {
  const proporcao = total > 0 ? Math.min(1, pago / total) : 0;
  const restante = Math.max(0, total - pago);

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--fw-semi)",
          letterSpacing: "var(--tracking-tight)",
          fontVariantNumeric: "tabular-nums",
          marginBottom: 8,
        }}
      >
        {reais(total)}
      </div>

      <div
        style={{
          height: 5,
          borderRadius: "var(--radius-full)",
          background: "var(--surface-3)",
          overflow: "hidden",
        }}
      >
        <div
          className="redondo"
          style={{
            width: `${proporcao * 100}%`,
            height: "100%",
            background: "var(--primary)",
            borderRadius: "var(--radius-full)",
            transition: "width var(--dur-slow) var(--ease-out)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 7,
          fontSize: "var(--text-sm)",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>
          {rotuloEntrada}:{" "}
          <strong style={{ color: "var(--credito)", fontVariantNumeric: "tabular-nums" }}>
            {reais(pago)}
          </strong>
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          Em aberto:{" "}
          <strong style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {reais(restante)}
          </strong>
        </span>
      </div>
    </div>
  );
}

function reais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}

// ════════════════════════════════════════════════════════════════
// ENTRADA NUMERICA
// ════════════════════════════════════════════════════════════════

/**
 * Campo de numero SEM `<input type="number">`.
 *
 * O nativo atrapalha mais do que ajuda em formulario denso: a setinha rouba
 * largura, a roda do mouse altera o valor sem querer, `,` e `.` se comportam
 * diferente por locale, e apagar o campo devolve string vazia que vira `NaN`.
 *
 * Aqui o estado da tela e TEXTO e o estado do dominio e numero. O texto so vira
 * numero quando da — digitar "1," no meio da edicao nao pode zerar o campo.
 */
export function CampoNumerico({
  valor,
  aoMudar,
  escala = 1,
  casas = 2,
  alinhar = "left",
  sufixo,
  placeholder,
  style,
}: {
  valor: number;
  aoMudar: (v: number) => void;
  /**
   * Quanto o valor guardado e maior que o exibido. Dinheiro usa 100 — o estado
   * e centavo inteiro e a tela mostra reais. Quantidade usa 1.
   *
   * ⚠️ Separado de `casas` de proposito: a versao anterior derivava a escala das
   * casas decimais, e uma quantidade 8 aparecia como 0,08.
   */
  escala?: number;
  /** Casas decimais exibidas. Nao tem relacao com a escala. */
  casas?: number;
  alinhar?: "left" | "right";
  sufixo?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const paraTexto = (v: number) =>
    casas === 0 ? String(Math.round(v / escala)) : (v / escala).toFixed(casas).replace(".", ",");

  const [texto, setTexto] = useState(() => paraTexto(valor));
  const [focado, setFocado] = useState(false);

  // Fora de foco o campo obedece o dominio; em foco, nao — reformatar no meio
  // da digitacao empurraria o cursor para o fim a cada tecla.
  const exibido = focado ? texto : paraTexto(valor);

  function digitar(bruto: string) {
    const limpo = bruto.replace(/[^\d.,-]/g, "");
    setTexto(limpo);

    const numero = Number(limpo.replace(/\./g, "").replace(",", "."));
    if (limpo === "" || Number.isNaN(numero)) return;
    // Escala 1 nao arredonda: quantidade fracionaria (2,5 horas) tem de passar.
    aoMudar(escala === 1 ? numero : Math.round(numero * escala));
  }

  const campo = (
    <input
      type="text"
      inputMode="decimal"
      value={exibido}
      placeholder={placeholder}
      onFocus={() => {
        setTexto(paraTexto(valor));
        setFocado(true);
      }}
      onChange={(e) => digitar(e.target.value)}
      onBlur={() => setFocado(false)}
      style={{
        ...inputStyle,
        textAlign: alinhar,
        fontVariantNumeric: "tabular-nums",
        ...(sufixo ? { paddingRight: 34 } : null),
        ...style,
      }}
    />
  );

  if (!sufixo) return campo;

  return (
    <div style={{ position: "relative" }}>
      {campo}
      <span
        style={{
          position: "absolute",
          right: 9,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          pointerEvents: "none",
        }}
      >
        {sufixo}
      </span>
    </div>
  );
}

/**
 * Quantidade que aceita ser digitada em HORAS.
 *
 * `ordensservicoxservicos.quantidade` e `double precision`, entao 2,5 ja cabe.
 * O que faltava era a entrada: quem cobra por hora pensa "2h30", nao "2,5", e
 * fazer a conta de cabeca a cada lancamento e onde o erro entra.
 *
 * A unidade NAO e persistida — nao ha coluna para ela. E so a forma de digitar;
 * o banco recebe sempre a quantidade decimal.
 */
export function CampoQuantidade({
  valor,
  unidade,
  aoMudar,
}: {
  valor: number;
  unidade: "UN" | "H";
  aoMudar: (v: number, unidade: "UN" | "H") => void;
}) {
  const emHoras = unidade === "H";
  const [texto, setTexto] = useState("");
  const [focado, setFocado] = useState(false);

  const comoHora = (v: number) => {
    const total = Math.round(v * 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  if (!emHoras) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <CampoNumerico
          valor={valor}
          aoMudar={(v) => aoMudar(v, "UN")}
          casas={2}
          escala={1}
        />
        <SeletorUnidade emHoras={false} aoTrocar={() => aoMudar(valor, "H")} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="2:30"
        value={focado ? texto : comoHora(valor)}
        onFocus={() => {
          setTexto(comoHora(valor));
          setFocado(true);
        }}
        onChange={(e) => {
          const limpo = e.target.value.replace(/[^\d:]/g, "");
          setTexto(limpo);
          const [h, m] = limpo.split(":");
          const horas = Number(h || 0) + Number(m || 0) / 60;
          if (!Number.isNaN(horas)) aoMudar(Number(horas.toFixed(4)), "H");
        }}
        onBlur={() => setFocado(false)}
        style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
      />
      <SeletorUnidade emHoras aoTrocar={() => aoMudar(valor, "UN")} />
    </div>
  );
}

function SeletorUnidade({ emHoras, aoTrocar }: { emHoras: boolean; aoTrocar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTrocar}
      title={emHoras ? "Digitar como quantidade" : "Digitar como horas"}
      style={{
        width: 44,
        flexShrink: 0,
        height: "var(--h-input)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--input-border)",
        background: "var(--surface-2)",
        color: "var(--text-secondary)",
        fontSize: "var(--text-xs)",
        fontFamily: "var(--font)",
        fontWeight: "var(--fw-medium)",
        cursor: "pointer",
      }}
    >
      {emHoras ? "h:mm" : "un"}
    </button>
  );
}
