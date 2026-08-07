"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Avisos do sistema — canto inferior direito.
 *
 * Existe porque erro de regra de negócio não cabe em faixa dentro da tela: no
 * quadro, o alerta ficava acima das colunas enquanto o card recusado estava
 * três colunas à direita, e ninguém liga uma coisa à outra. O aviso vem para
 * perto do olho, some sozinho e não empurra layout.
 *
 * Um lugar só para todo tipo — sucesso, erro, atenção, informação — porque
 * componentes paralelos de aviso divergem no primeiro ajuste de espaçamento.
 *
 * Confirmação (`confirmar`) mora aqui pelo mesmo motivo, e substitui
 * `window.confirm`: o nativo trava a aba inteira e não aceita estilo.
 */

export type TipoAviso = "sucesso" | "erro" | "atencao" | "info";

type Aviso = {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  detalhe?: string;
  /** Presente = pede decisão e não some sozinho. */
  confirmar?: { rotulo: string; aoConfirmar: () => void };
};

type API = {
  avisar: (tipo: TipoAviso, titulo: string, detalhe?: string) => void;
  confirmar: (titulo: string, rotulo: string, aoConfirmar: () => void, detalhe?: string) => void;
};

const Contexto = createContext<API | null>(null);

/** Quem avisa não precisa saber que o provider existe. */
export function useAvisos(): API {
  const api = useContext(Contexto);
  if (!api) throw new Error("useAvisos precisa estar dentro de <Avisos>");
  return api;
}

const DURACAO = 6000;

export function Avisos({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);

  const fechar = useCallback((id: number) => {
    setLista((atual) => atual.filter((a) => a.id !== id));
  }, []);

  const avisar = useCallback((tipo: TipoAviso, titulo: string, detalhe?: string) => {
    setLista((atual) => [...atual, { id: Date.now() + Math.random(), tipo, titulo, detalhe }]);
  }, []);

  const confirmar = useCallback(
    (titulo: string, rotulo: string, aoConfirmar: () => void, detalhe?: string) => {
      setLista((atual) => [
        ...atual,
        {
          id: Date.now() + Math.random(),
          tipo: "atencao",
          titulo,
          detalhe,
          confirmar: { rotulo, aoConfirmar },
        },
      ]);
    },
    [],
  );

  return (
    <Contexto.Provider value={{ avisar, confirmar }}>
      {children}

      {/*
        * Véu escuro e borrado atrás da pilha.
        *
        * O aviso vive num canto onde a tela costuma estar clara e vazia, e um
        * cartão branco sobre fundo branco não se destaca por mais sombra que
        * tenha. Escurecendo a região ao redor, ele passa a ter contra o quê
        * aparecer.
        *
        * É um gradiente que morre antes da metade da tela — não é modal, não
        * bloqueia nada, e o `pointer-events: none` garante isso.
        */}
      {lista.length > 0 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            right: 0,
            bottom: 0,
            width: "min(46vw, 620px)",
            height: "min(46vh, 520px)",
            /*
             * ⚠️ Acima de TODOS os andares de drawer.
             *
             * Em 199 a confirmacao de excluir nascia atras do proprio drawer que
             * a disparou: para responder era preciso fechar o drawer, e fechar
             * cancelava a acao. Em 499 o problema voltou quando o drawer ganhou
             * um terceiro andar (600), entao a faixa dos avisos comeca acima de
             * qualquer nivel possivel. Aviso e a ultima camada da tela — se ele
             * nao estiver visivel, nao ha por que existir.
             */
            zIndex: 899,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.18) 42%, rgba(0,0,0,0) 72%)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            maskImage:
              "radial-gradient(ellipse at 100% 100%, #000 0%, #000 45%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 100% 100%, #000 0%, #000 45%, transparent 72%)",
            animation: "veu-entra 260ms var(--ease)",
          }}
        />
      )}

      <div
        // `pointer-events: none` na pilha e `auto` no cartão: a área vazia entre
        // avisos não pode bloquear clique no que está atrás.
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 900,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        {lista.map((aviso) => (
          <Cartao key={aviso.id} aviso={aviso} aoFechar={() => fechar(aviso.id)} />
        ))}
      </div>
    </Contexto.Provider>
  );
}

/**
 * `solida` é a cor cheia, usada no ícone e na barra; `cor` é a de texto.
 *
 * São diferentes porque a de texto foi calibrada para ler sobre fundo claro, e
 * em elemento pequeno e preenchido ela some.
 */
const TONS: Record<
  TipoAviso,
  { cor: string; solida: string; fundo: string; icone: React.ReactNode }
> = {
  sucesso: {
    cor: "var(--success-text)",
    solida: "var(--success)",
    fundo: "var(--success-bg)",
    icone: <path d="M20 6L9 17l-5-5" />,
  },
  erro: {
    cor: "var(--danger-text)",
    solida: "var(--danger)",
    fundo: "var(--danger-bg)",
    icone: <path d="M18 6L6 18M6 6l12 12" />,
  },
  atencao: {
    cor: "var(--warning-text)",
    solida: "var(--warning-solido)",
    fundo: "var(--warning-bg)",
    icone: <path d="M12 8v5M12 17h.01M10.3 3.9L2.4 17a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />,
  },
  info: {
    cor: "var(--info-text)",
    solida: "var(--info)",
    fundo: "var(--info-bg)",
    icone: <path d="M12 16v-4M12 8h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />,
  },
};

function Cartao({ aviso, aoFechar }: { aviso: Aviso; aoFechar: () => void }) {
  const [saindo, setSaindo] = useState(false);
  const tom = TONS[aviso.tipo];

  // Quem pede decisão não desaparece sozinho: sumir com a pergunta deixaria a
  // ação por fazer sem ninguém saber.
  useEffect(() => {
    if (aviso.confirmar) return;

    const some = setTimeout(() => setSaindo(true), DURACAO);
    const tira = setTimeout(aoFechar, DURACAO + 180);
    return () => {
      clearTimeout(some);
      clearTimeout(tira);
    };
  }, [aviso.confirmar, aoFechar]);

  return (
    <div
      role={aviso.tipo === "erro" ? "alert" : "status"}
      style={{
        pointerEvents: "auto",
        width: 352,
        display: "flex",
        alignItems: "stretch",
        gap: 11,
        padding: 12,
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        /*
         * Sombra em duas camadas — uma larga e funda, outra curta e fechada.
         *
         * O aviso nasce longe de onde o olho estava: canto de baixo enquanto a
         * acao aconteceu no meio da tela. Sem peso proprio ele passava
         * despercebido, e a pessoa repetia o gesto achando que nada tinha
         * acontecido — que e exatamente o problema que ele existe para
         * resolver.
         *
         * A cor NAO vem de borda no card: barra colada na borda corta o raio e
         * suja o canto. Ela e uma barra DENTRO, com o padding dando o respiro.
         */
        boxShadow: "0 18px 44px rgba(0, 0, 0, 0.26), 0 3px 10px rgba(0, 0, 0, 0.14)",
        opacity: saindo ? 0 : 1,
        transform: saindo ? "translateX(12px)" : "none",
        transition: "opacity 160ms var(--ease), transform 160ms var(--ease)",
        animation: "aviso-entra 340ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Barra do tipo, dentro do card e com o padding a separando da borda. */}
      <span
        aria-hidden
        className="redondo"
        style={{
          width: 4,
          flexShrink: 0,
          borderRadius: "var(--radius-full)",
          background: tom.solida,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Ícone acima do título, não ao lado: em coluna ele deixa de disputar
            a primeira linha com o texto e o título ganha a largura inteira. */}
        <span
          aria-hidden
          style={{
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            marginBottom: 9,
            borderRadius: "var(--radius-full)",
            background: tom.solida,
            color: "#fff",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {tom.icone}
          </svg>
        </span>

        <div
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-semi)",
            color: "var(--text-primary)",
            letterSpacing: "var(--tracking-snug)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          {aviso.titulo}
        </div>

        {aviso.detalhe && (
          <div
            style={{
              marginTop: 3,
              fontSize: "var(--text-base)",
              color: "var(--text-secondary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {aviso.detalhe}
          </div>
        )}

        {aviso.confirmar && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => {
                aviso.confirmar?.aoConfirmar();
                aoFechar();
              }}
              style={{
                height: 26,
                padding: "0 12px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "var(--danger)",
                color: "#fff",
                fontFamily: "var(--font)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-medium)",
                cursor: "pointer",
              }}
            >
              {aviso.confirmar.rotulo}
            </button>
            <button
              type="button"
              onClick={aoFechar}
              style={{
                height: 26,
                padding: "0 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--surface)",
                color: "var(--text-secondary)",
                fontFamily: "var(--font)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar aviso"
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          border: "none",
          background: "none",
          color: "var(--text-tertiary)",
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
