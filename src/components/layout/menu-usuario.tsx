"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { logoutAction } from "@/modules/sessao/sessao.actions";
import { EmpresaDrawer } from "@/components/layout/empresa-drawer";
import {
  PerfilDrawer,
  type DadosDoPerfil,
  type EmpresaDoPerfil,
} from "@/components/layout/perfil-drawer";
import { AvatarDoUsuario } from "@/components/layout/avatar";

/**
 * Menu do usuario: identidade, tema, troca de empresa e sair.
 *
 * "Trocar empresa" leva de volta ao seletor em vez de abrir uma lista aqui —
 * a mesma tela serve aos dois momentos e nao ha regra duplicada.
 */
/** Vao entre o botao e o cartao, e folga minima ate a borda da tela. */
const RESPIRO = 6;
const FOLGA = 8;

export function MenuUsuario({
  email,
  nome,
  foto,
  emailPendente,
  dados,
  empresas,
  empresaAtualId,
  interno,
}: {
  email: string;
  nome: string | null;
  /** URL publica da foto. Nula usa as iniciais. */
  foto: string | null;
  /** Endereco novo esperando confirmacao, para a gaveta de perfil. */
  emailPendente: string | null;
  /** O cadastro pessoal, para a gaveta de perfil. */
  dados: DadosDoPerfil;
  /** As empresas do acesso, para a aba do perfil. */
  empresas: EmpresaDoPerfil[];
  empresaAtualId: number | null;
  /** Equipe da casa: aparece como tipo de acesso no perfil. */
  interno: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [configurandoEmpresa, setConfigurandoEmpresa] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const [onde, setOnde] = useState<{ left: number; top: number } | null>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      const dentroDoBotao = ref.current?.contains(e.target as Node);
      const dentroDoCartao = cartao.current?.contains(e.target as Node);
      if (!dentroDoBotao && !dentroDoCartao) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  /*
   * ⚠️ Mede DEPOIS de abrir e antes de pintar (`useLayoutEffect`).
   *
   * Com `useEffect`, o cartao aparecia por um quadro no canto superior esquerdo
   * antes de pular para o lugar. Mede o CARTAO e nao so o botao, porque a
   * decisao depende da altura dele: preso na tela, nada o empurra de volta
   * quando passa da borda de cima. Mesma mecanica do `MenuDeLinha`.
   */
  useLayoutEffect(() => {
    if (!aberto || !botao.current || !cartao.current) return;

    const r = botao.current.getBoundingClientRect();
    const alturaDoCartao = cartao.current.offsetHeight;
    const larguraDoCartao = cartao.current.offsetWidth;

    /* Abre para BAIXO: o avatar mora no topo da tela, e nao ha o que caiba
       acima dele. O `min` so evita ultrapassar a borda de baixo. */
    const top = Math.min(r.bottom + RESPIRO, window.innerHeight - FOLGA - alturaDoCartao);

    /*
     * Alinha pela DIREITA do botao, e nao pela esquerda.
     *
     * O avatar encosta na borda direita da tela: alinhado pela esquerda, o
     * cartao nasceria fora dela e voltaria empurrado, ficando torto em relacao
     * ao proprio botao que o abriu.
     */
    const left = Math.max(FOLGA, r.right - larguraDoCartao);

    setOnde({ left, top });
  }, [aberto]);

  /* Fechar APAGA a medida: guardada, a proxima abertura pintaria um quadro no
     lugar da anterior antes de medir. */
  function fechar() {
    setAberto(false);
    setOnde(null);
  }

  const escuro = resolvedTheme === "dark";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={botao}
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-haspopup="menu"
        aria-expanded={aberto}
        style={{
          /*
           * ⚠️ O botao e o avatar, e nada mais: sem moldura, sem fundo e sem
           * padding. Qualquer caixa em volta de um circulo reaparece como um
           * quadrado por tras dele — e era esse quadrado que se via.
           */
          /*
           * ⚠️ A MESMA medida dos outros controles (`--h-controle`, hoje 44), que
           * e a do disco da barra de ferramentas.
           *
           * Com 28 ele ficava perdido na faixa, do tamanho de um icone de menu —
           * e a identidade nao e um icone. Com 34, ao lado de uma pilula e de
           * discos de 44, ele virava o unico controle menor da tela sem ter por
           * que. Redondo ele continua: e o que o separa das ferramentas, que sao
           * discos brancos, e diz que ali esta uma pessoa e nao um gesto.
           */
          width: "var(--h-controle)",
          height: "var(--h-controle)",
          display: "block",
          padding: 0,
          border: "none",
          background: "none",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          lineHeight: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
        onMouseLeave={(e) => {
          if (!aberto) e.currentTarget.style.background = "transparent";
        }}
      >
        <AvatarDoUsuario nome={nome} email={email} foto={foto} tamanho={44} forma="arredondado" />
      </button>

      {/*
        ⚠️ O cartao sai do fluxo por PORTAL, preso na tela e nao na barra.

        A barra lateral e `overflow: hidden` quando expandida — precisa ser, para
        a animacao de largura nao mostrar texto vazando. Absoluto dentro dela, o
        menu era CORTADO na borda: o que passasse da altura da barra
        simplesmente sumia, e era assim que ele estava. Preso ao `body`, nao ha o
        que o corte.
      */}
      {aberto &&
        createPortal(
          <>
            {/* Camada invisivel que fecha ao clicar fora e ao ROLAR: o cartao
                esta preso na tela, e sem isto ele ficaria parado enquanto a
                pagina anda embaixo dele. */}
            <div
              onClick={fechar}
              onWheel={fechar}
              style={{ position: "fixed", inset: 0, zIndex: 300 }}
            />

            <div
              ref={cartao}
              role="menu"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                left: onde?.left ?? 0,
                top: onde?.top ?? 0,
                /* Enquanto nao mediu, ocupa espaco e nao aparece: e assim que a
                   altura fica conhecida antes do primeiro quadro pintado. */
                visibility: onde ? "visible" : "hidden",
                zIndex: 301,
                minWidth: 220,
                background: "var(--surface)",
                /*
                  ⚠️ SEM borda. A sombra ja separa o cartao do que esta atras, e
                  contorno mais sombra e a mesma coisa dita duas vezes: o cartao
                  ganha peso de caixa de dialogo para oferecer tres linhas.
                */
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-lg)",
                overflow: "hidden",
              }}
            >
          {/*
            ⚠️ A EMPRESA saiu daqui. Ela e a resposta de "com qual empresa estou
            trabalhando?", e essa pergunta agora mora no cartao da empresa, no
            topo da barra lateral, junto do botao que a troca. Aqui ficou so
            "quem sou eu" — que e o que um avatar promete.
          */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              /*
                ⚠️ SEM divisoria sob a identidade.

                O nome e o e-mail ja se separam das acoes pelo tamanho e pela
                cor; o fio no meio partia um cartao de trezentos pixels em duas
                metades e o fazia parecer dois cartoes colados.
              */
              gap: 10,
              padding: "12px 12px 8px",
            }}
          >
            <AvatarDoUsuario
              nome={nome}
              email={email}
              foto={foto}
              tamanho={40}
              /* Aqui o respiro e da cor do CARTAO: e sobre ele que o anel esta. */
              fundo="var(--surface)"
            />

            <div style={{ minWidth: 0 }}>
              {nome && (
                <div
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--fw-medium)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {nome}
                </div>
              )}
              <div
                title={email}
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-tertiary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email}
              </div>
            </div>
          </div>

          <div style={{ padding: 4 }}>
            {/*
              ⚠️ Editar perfil ABRE UMA GAVETA, e nao leva a uma tela.

              O que ha para editar sao dois campos — o nome e a senha —, e uma
              tela inteira para isso faria a pessoa sair de onde estava
              trabalhando para trocar uma palavra.
            */}
            <ItemMenu
              icone={<IconeLapis />}
              onClick={() => {
                fechar();
                setEditando(true);
              }}
            >
              Editar perfil
            </ItemMenu>

            {/*
              ⚠️ O cadastro da EMPRESA mora aqui, junto do cadastro da pessoa.

              E o mesmo gesto um degrau acima: quem opera, e a casa em que se
              opera. No cartao da empresa, na barra, ele disputaria espaco com a
              troca de tenant — que e a pergunta daquele cartao e se usa todo
              dia; abrir formulario dali faria um cartao servir a duas coisas.
            */}
            <ItemMenu
              icone={<IconePredio />}
              onClick={() => {
                fechar();
                setConfigurandoEmpresa(true);
              }}
            >
              Cadastro da empresa
            </ItemMenu>

            <ItemMenu
              icone={escuro ? <IconeSol /> : <IconeLua />}
              onClick={() => setTheme(escuro ? "light" : "dark")}
            >
              {escuro ? "Tema claro" : "Tema escuro"}
            </ItemMenu>
          </div>

          {/* Sem fio acima do sair: o vermelho ja o separa do resto, e ele e a
              ultima linha de um cartao curto. */}
          <form action={logoutAction} style={{ padding: "0 4px 4px" }}>
            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                width: "100%",
                textAlign: "left",
                padding: "7px 8px",
                border: "none",
                background: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font)",
                fontSize: "var(--text-base)",
                color: "var(--danger-text)",
              }}
            >
              <IconeSaida />
              Sair
            </button>
          </form>
            </div>
          </>,
          document.body,
        )}

      {/*
        ⚠️ A gaveta sai por PORTAL, como o cartao.

        Ela e `position: fixed` com z-index alto, mas nascia dentro do `header`,
        que tem `zIndex: 50` e cria um contexto de empilhamento: presa ali, os
        400 do drawer valiam so DENTRO do topo, e a barra lateral (60) passava
        por cima do veu e da gaveta.
      */}
      {editando &&
        createPortal(
          <PerfilDrawer
            nome={nome}
            email={email}
            foto={foto}
            emailPendente={emailPendente}
            dados={dados}
            empresas={empresas}
            empresaAtualId={empresaAtualId}
            interno={interno}
            onClose={() => setEditando(false)}
          />,
          document.body,
        )}

      {/* Mesmo portal, e pelo mesmo motivo do de cima: presa no `header`, que
          cria contexto de empilhamento, a gaveta ficaria atras da barra. */}
      {configurandoEmpresa &&
        createPortal(
          <EmpresaDrawer
            aberto
            nome={empresas.find((e) => e.id === empresaAtualId)?.nome ?? null}
            logo={empresas.find((e) => e.id === empresaAtualId)?.logo ?? null}
            onClose={() => setConfigurandoEmpresa(false)}
          />,
          document.body,
        )}
    </div>
  );
}

/**
 * Uma linha do cartao.
 *
 * ⚠️ SEMPRE com icone a esquerda.
 *
 * Sem ele, as opcoes viram uma lista de frases alinhadas pela margem, e a pessoa
 * le todas para achar uma. O icone e o que se reconhece antes da palavra, e e o
 * mesmo desenho que aparece nos outros cartoes flutuantes da casa.
 */
function ItemMenu({
  children,
  icone,
  onClick,
  href,
}: {
  children: React.ReactNode;
  icone: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const estilo: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    textAlign: "left",
    padding: "7px 8px",
    border: "none",
    background: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontFamily: "var(--font)",
    fontSize: "var(--text-base)",
    color: "var(--text-primary)",
  };

  if (href) {
    return (
      <a href={href} style={estilo}>
        {icone}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={estilo}>
      {icone}
      {children}
    </button>
  );
}


/** O traco comum dos icones do cartao: mesma bitola dos demais menus da casa. */
const TRACO = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Lapis: editar o proprio cadastro. */
function IconeLapis() {
  return (
    <svg {...TRACO}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

/** Lua: passar para o tema escuro. */
function IconeLua() {
  return (
    <svg {...TRACO}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

/** Sol: voltar para o tema claro. */
function IconeSol() {
  return (
    <svg {...TRACO}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Porta com a seta saindo: encerrar a sessao. */
function IconeSaida() {
  return (
    <svg {...TRACO}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h9" />
    </svg>
  );
}

/** Predio: o cadastro da empresa, e nao o da pessoa. */
function IconePredio() {
  return (
    <svg {...TRACO}>
      <path d="M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
      <path d="M13 10h6a1 1 0 0 1 1 1v10" />
      <path d="M7 9h2M7 13h2M16 14h1M16 17.5h1M2.5 21h19" />
    </svg>
  );
}
