"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A barra de ferramentas da direita.
 *
 * Uma coluna estreita colada na borda direita da area de trabalho, so com
 * icones. Ela reune o que se FAZ na tela: incluir, imprimir, exportar, escolher
 * o periodo.
 *
 * ⚠️ UM SO destaque, e ele fica no TOPO. O primeiro botao e a acao que a tela
 * existe para oferecer (`destaque`), pintado de azul; os demais sao ferramentas
 * de traco azul sobre branco. Dois botoes pintados na mesma coluna e o olho
 * deixando de saber qual e o gesto principal.
 *
 * ⚠️ A divisao de trabalho com o cabecalho: o CABECALHO diz o que a tela e e
 * onde se procura (titulo e busca); a BARRA guarda o que se faz. Sem essa
 * linha, a cada tela nova a decisao voltaria do zero e as duas se misturariam.
 *
 * ⚠️ Ela acompanha a ALTURA DO CARTAO branco, e nao a da tela.
 *
 * Como irma do `Panel` ela ia do topo ao rodape, passando ao lado do cabecalho —
 * e ali nao ha o que ferramenta faca: o cabecalho ja tem os seus controles. Ao
 * lado do cartao, ela comeca e termina com aquilo sobre o que age.
 *
 * ⚠️ SEM divisoria e SEM vao ate o cartao. O branco do cartao contra o cinza da
 * casca ja separa os dois; um fio no meio seria uma terceira borda para dizer o
 * que o contraste ja diz, e um vao faria a barra parecer solta na tela em vez de
 * pertencer aquela tabela.
 */
export function BarraDeFerramentas({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{
        /*
         * ⚠️ A largura carrega o RESPIRO DOS DOIS LADOS, e por isso a linha que
         * envolve barra e cartao nao tem margem a direita.
         *
         * Com a margem de 16 da pagina do lado de fora, o botao ficava com 8
         * pixels ate o cartao e 24 ate a janela: centralizado dentro da barra e
         * torto na tela, que e o que o olho ve. Sendo a barra quem encosta na
         * borda, os dois vaos passam a ser o mesmo.
         */
        width: LARGURA_DO_BOTAO + RESPIRO_LATERAL * 2,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
    </aside>
  );
}

/** O alvo de clique, e o vao ate o cartao e ate a borda da janela. */
const LARGURA_DO_BOTAO = 48;
const RESPIRO_LATERAL = 8;

/**
 * Um botao da barra, com painel opcional preso a ele.
 *
 * ⚠️ O painel sai por PORTAL, preso na tela. A area de trabalho e
 * `overflow: hidden` — precisa ser, senao a tabela empurra a pagina —, e um
 * painel absoluto aqui dentro seria cortado na borda. Mesma mecanica do
 * `MenuDeLinha` e do menu do usuario.
 *
 * ⚠️ Sem `painel`, o botao e so um gesto: um clique e pronto. E o caso da
 * impressora quando nao ha o que escolher.
 */
export function BotaoDaBarra({
  rotulo,
  legenda,
  icone,
  aceso,
  destaque,
  desabilitado,
  onClick,
  painel,
}: {
  rotulo: string;
  /**
   * A palavra embaixo do icone.
   *
   * ⚠️ Ela existe porque icone sozinho se aprende por tentativa. Calendario e
   * impressora sao reconheciveis, mas a terceira e a quarta ferramenta ja nao
   * sao — e a dica do mouse so aparece depois que a pessoa parou em cima, ou
   * seja, depois de ela ja ter adivinhado.
   *
   * Curta: uma palavra. Duas linhas de legenda transformam a barra num menu.
   */
  legenda: string;
  icone: React.ReactNode;
  /** Marca o botao cujo painel esta aberto, ou cujo filtro esta em uso. */
  aceso?: boolean;
  /**
   * A ACAO da tela: pintada de azul, no topo da barra.
   *
   * ⚠️ Um por barra. Ele e o "Nova" que antes morava no cabecalho — mudou de
   * lugar, nao de peso: continua sendo o unico azul cheio da tela.
   */
  destaque?: boolean;
  desabilitado?: boolean;
  onClick?: () => void;
  /** O que abre ao clicar. Recebe `fechar` porque toda acao dali termina. */
  painel?: (fechar: () => void) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const [onde, setOnde] = useState<{ top: number; right: number } | null>(null);

  /*
   * ⚠️ Mede DEPOIS de abrir e antes de pintar (`useLayoutEffect`). Com
   * `useEffect`, o painel aparecia por um quadro no canto antes de pular para o
   * lugar certo. Mede o CARTAO e nao so o botao: preso na tela, nada o empurra
   * de volta quando ele passa da borda de baixo.
   */
  useLayoutEffect(() => {
    if (!aberto || !botao.current || !cartao.current) return;

    const r = botao.current.getBoundingClientRect();
    const altura = cartao.current.offsetHeight;

    setOnde({
      top: Math.min(r.top, window.innerHeight - FOLGA - altura),
      /* Abre para a ESQUERDA da barra: a direita dela e a borda da janela. */
      right: window.innerWidth - r.left + RESPIRO,
    });
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setOnde(null);
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        title={rotulo}
        aria-label={rotulo}
        aria-expanded={painel ? aberto : undefined}
        disabled={desabilitado}
        onClick={() => {
          if (painel) return aberto ? fechar() : setAberto(true);
          onClick?.();
        }}
        style={{
          /*
           * ⚠️ Fundo branco SEM borda.
           *
           * O branco sobre o cinza da casca ja recorta o botao e da a ele o
           * mesmo material do cartao ao lado — e a regra da casa e essa: "sem
           * borda: o contraste com o cinza ja o recorta, e uma linha por cima
           * disso so pesaria". A moldura da coluna de Acoes existe porque la o
           * icone mora DENTRO da tabela, cercado de texto; aqui a barra ja e uma
           * faixa propria, fora do cartao.
           */
          width: LARGURA_DO_BOTAO,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          padding: "7px 0 6px",
          border: "none",
          borderRadius: "var(--radius-sm)",
          background: destaque
            ? "var(--primary)"
            : aberto
              ? "var(--sidebar-item-bg-hover)"
              : "var(--surface)",
          color: destaque
            ? "var(--primary-fg)"
            : aceso
              ? "var(--text-primary)"
              : "var(--text-secondary)",
          fontFamily: "var(--font)",
          cursor: desabilitado ? "not-allowed" : "pointer",
          opacity: desabilitado ? 0.4 : 1,
          transition:
            "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
        }}
        onMouseEnter={(e) => {
          if (desabilitado) return;
          e.currentTarget.style.background = destaque
            ? "var(--primary-hover)"
            : "var(--sidebar-item-bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (destaque) return void (e.currentTarget.style.background = "var(--primary)");
          if (!aberto) e.currentTarget.style.background = "var(--surface)";
        }}
      >
        {icone}
        <span
          style={{
            /* `--text-xs`, e nao `--text-2xs`: o menor da casa e de 8px e vive
               em pastilha de contador, onde se le um numero. Uma palavra ali
               vira borrao. */
            fontSize: "var(--text-xs)",
            fontWeight: aceso ? "var(--fw-semi)" : "var(--fw-regular)",
            lineHeight: 1,
            /* Uma palavra numa linha: cortada, ela deixa de ser legenda. */
            whiteSpace: "nowrap",
          }}
        >
          {legenda}
        </span>
      </button>

      {painel &&
        aberto &&
        createPortal(
          <>
            {/* Camada que fecha ao clicar fora e ao ROLAR: o painel esta preso
                na tela, e sem isto ficaria parado enquanto a tabela anda. */}
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
                /* Enquanto nao mediu, ocupa espaco e nao aparece: e assim que a
                   altura fica conhecida antes do primeiro quadro pintado. */
                visibility: onde ? "visible" : "hidden",
                zIndex: 441,
                minWidth: 240,
                padding: 12,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {painel(fechar)}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/**
 * Uma escolha dentro de um painel — modo de exibicao, ordenacao, recorte.
 *
 * ⚠️ Marca a opcao em vigor com um visto, e nao pintando a linha. Fundo colorido
 * dentro de um painel branco se confunde com o realce do mouse, e a pessoa
 * descobre qual esta valendo passando o cursor por cima de todas.
 */
export function OpcaoDoPainel({
  icone,
  rotulo,
  marcada,
  onClick,
}: {
  icone?: React.ReactNode;
  rotulo: string;
  marcada?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "6px 8px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font)",
        fontSize: "var(--text-base)",
        fontWeight: marcada ? "var(--fw-semi)" : "var(--fw-regular)",
        color: "var(--text-primary)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icone}
      {rotulo}
      {marcada && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginLeft: "auto" }}
        >
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      )}
    </button>
  );
}

/**
 * A cruz do incluir, no tamanho da barra.
 *
 * ⚠️ E o MESMO desenho do `IncluirButton` do kit, de proposito: o gesto mudou de
 * lugar, nao de identidade. Dois "mais" diferentes na mesma casa fariam parecer
 * que um deles inclui outra coisa.
 */
export function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6.75 1.75a.75.75 0 0 0-1.5 0V5.25H1.75a.75.75 0 0 0 0 1.5H5.25v3.5a.75.75 0 0 0 1.5 0V6.75h3.5a.75.75 0 0 0 0-1.5H6.75V1.75z" />
    </svg>
  );
}

/** Funil: os filtros. Cheio enquanto algum estiver valendo. */
export function IconeFunil({ ativo }: { ativo?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={ativo ? "var(--primary)" : "none"}
      stroke="var(--primary)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />
    </svg>
  );
}

/** O titulo de um painel da barra. Mesmo tratamento do rotulo de campo. */
export function TituloDoPainel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        color: "var(--text-tertiary)",
      }}
    >
      {children}
    </div>
  );
}

/** Vao entre o botao e o painel, e folga minima ate a borda da tela. */
const RESPIRO = 6;
const FOLGA = 8;
