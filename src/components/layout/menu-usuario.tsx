"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { logoutAction } from "@/modules/sessao/sessao.actions";
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
           * ⚠️ 34 num topo de 48: sobram 7 pixels de cada lado.
           *
           * Com 28 ele ficava perdido na faixa, do tamanho de um icone de menu —
           * e a identidade nao e um icone. Passando disso, encosta nas bordas do
           * topo e a barra parece apertada.
           */
          width: 34,
          height: 34,
          display: "block",
          padding: 0,
          border: "none",
          background: "none",
          borderRadius: "var(--radius-full)",
          cursor: "pointer",
          lineHeight: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
        onMouseLeave={(e) => {
          if (!aberto) e.currentTarget.style.background = "transparent";
        }}
      >
        <AvatarDoUsuario nome={nome} email={email} foto={foto} tamanho={34} />
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
                border: "1px solid var(--border-strong)",
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
              gap: 10,
              padding: "12px 12px",
              borderBottom: "1px solid var(--border)",
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
            <ItemMenu onClick={() => { fechar(); setEditando(true); }}>
              Editar perfil
            </ItemMenu>

            <ItemMenu onClick={() => setTheme(escuro ? "light" : "dark")}>
              {escuro ? "Tema claro" : "Tema escuro"}
            </ItemMenu>
          </div>

          <form action={logoutAction} style={{ borderTop: "1px solid var(--border)", padding: 4 }}>
            <button
              type="submit"
              style={{
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
    </div>
  );
}

function ItemMenu({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const estilo: React.CSSProperties = {
    display: "block",
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
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={estilo}>
      {children}
    </button>
  );
}

