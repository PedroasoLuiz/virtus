"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/kit";

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

/**
 * Uma ação oferecida pelo aviso: "Desfazer", "Visualizar", "Tentar novamente".
 *
 * ⚠️ `principal` diz qual delas usa a cor da marca — e no máximo UMA usa. Duas
 * ações preenchidas lado a lado disputam o clique, e o aviso deixa de sugerir
 * um caminho para virar uma pergunta.
 */
export type AcaoDoAviso = {
  rotulo: string;
  aoClicar: () => void;
  principal?: boolean;
  /** Fica na tela depois do clique. O padrão é fechar. */
  manterAberto?: boolean;
};

type Aviso = {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  detalhe?: string;
  acoes?: AcaoDoAviso[];
  /**
   * Pede decisão: não some sozinho.
   *
   * ⚠️ Separado de `acoes` de propósito. Um aviso com "Desfazer" ainda é um
   * recado — some sozinho e a vida segue. Um que pergunta "excluir?" não pode
   * sumir: a resposta ficaria por dar, e ninguém saberia que houve pergunta.
   */
  exigeDecisao?: boolean;
};

type API = {
  avisar: (tipo: TipoAviso, titulo: string, detalhe?: string, acoes?: AcaoDoAviso[]) => void;
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
/** Quanto a saída leva. Casado com a `transition` do cartão. */
const SAIDA = 180;

export function Avisos({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);

  const fechar = useCallback((id: number) => {
    setLista((atual) => atual.filter((a) => a.id !== id));
  }, []);

  const avisar = useCallback(
    (tipo: TipoAviso, titulo: string, detalhe?: string, acoes?: AcaoDoAviso[]) => {
      setLista((atual) => [
        ...atual,
        { id: Date.now() + Math.random(), tipo, titulo, detalhe, acoes },
      ]);
    },
    [],
  );

  const confirmar = useCallback(
    (titulo: string, rotulo: string, aoConfirmar: () => void, detalhe?: string) => {
      setLista((atual) => [
        /*
         * ⚠️ UMA pergunta por vez: a nova substitui a que estava aberta.
         *
         * Clicando duas vezes em "excluir" nasciam duas confirmações iguais
         * empilhadas, e responder as duas rodava a exclusão duas vezes — a
         * segunda batendo num registro que já não existia. Duas perguntas
         * abertas também não têm resposta certa: qual delas o "sim" responde?
         *
         * Só as que EXIGEM decisão saem. Recados de sucesso e erro continuam
         * empilhando: eles não pedem nada, e cada um conta um fato diferente.
         */
        ...atual.filter((a) => !a.exigeDecisao),
        {
          id: Date.now() + Math.random(),
          tipo: "atencao",
          titulo,
          detalhe,
          exigeDecisao: true,
          acoes: [{ rotulo, aoClicar: aoConfirmar, principal: true }],
        },
      ]);
    },
    [],
  );

  return (
    <Contexto.Provider value={{ avisar, confirmar }}>
      {children}

      {/*
        ⚠️ A região é `aria-live`, e o cartão entra dentro dela.
        Marcando cada cartão, o leitor de tela às vezes perde o primeiro — a
        região precisa existir ANTES do conteúdo aparecer para ser observada.

        `polite` porque aviso não interrompe: quem está digitando termina a
        frase. Erro sobe para `assertive` no próprio cartão.
      */}
      {/*
        ⚠️ O véu voltou, e mais leve que o de antes.
        
        Ele tinha saído junto com a sombra pesada, na conta de que a borda nova
        bastava para separar o cartão do fundo. Separar, separa — mas o véu faz
        outra coisa: ele apaga o que está ATRÁS do aviso, e é isso que leva o
        olho ao canto quando a ação aconteceu no meio da tela.
        
        Gradiente que morre antes da metade da tela, `pointer-events: none`: não
        é modal e não bloqueia nada. Sai junto com o último aviso.
      */}
      {lista.length > 0 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            right: 0,
            bottom: 0,
            width: "min(42vw, 560px)",
            height: "min(42vh, 460px)",
            // Uma camada abaixo da pilha: o véu escurece o fundo, nunca o cartão.
            zIndex: 899,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.13) 42%, rgba(0,0,0,0) 72%)",
            backdropFilter: "blur(2.5px)",
            WebkitBackdropFilter: "blur(2.5px)",
            maskImage:
              "radial-gradient(ellipse at 100% 100%, #000 0%, #000 45%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 100% 100%, #000 0%, #000 45%, transparent 72%)",
            animation: "veu-entra 220ms var(--ease)",
          }}
        />
      )}

      <div
        aria-live="polite"
        aria-relevant="additions"
        style={{
          position: "fixed",
          right: "var(--aviso-margem, 16px)",
          bottom: "var(--aviso-margem, 16px)",
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
          zIndex: 900,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          // `none` na pilha e `auto` no cartão: a área vazia entre avisos não
          // pode bloquear clique no que está atrás.
          pointerEvents: "none",
          width: "min(380px, calc(100vw - 32px))",
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
 * O tom de cada tipo.
 *
 * ⚠️ A cor mora no ÍCONE, e não no fundo do cartão.
 *
 * Cartão inteiro tingido some junto com o resto da tela quando há um alerta
 * amarelo aberto atrás, e num tema escuro os fundos claros de estado brigam com
 * a superfície. Com o ícone colorido sobre o fundo do sistema, o aviso é sempre
 * o mesmo objeto e só o sinal muda.
 */
const TONS: Record<TipoAviso, { cor: string; fundo: string; icone: React.ReactNode }> = {
  sucesso: {
    cor: "var(--success-text)",
    fundo: "var(--success-bg)",
    icone: <path d="M20 6L9 17l-5-5" />,
  },
  erro: {
    cor: "var(--danger-text)",
    fundo: "var(--danger-bg)",
    icone: <path d="M18 6L6 18M6 6l12 12" />,
  },
  atencao: {
    cor: "var(--warning-text)",
    fundo: "var(--warning-bg)",
    icone: (
      <path d="M12 8v5M12 17h.01M10.3 3.9L2.4 17a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    ),
  },
  info: {
    cor: "var(--info-text)",
    fundo: "var(--info-bg)",
    icone: <path d="M12 16v-4M12 8h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />,
  },
};

function Cartao({ aviso, aoFechar }: { aviso: Aviso; aoFechar: () => void }) {
  const [saindo, setSaindo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const tom = TONS[aviso.tipo];

  /*
   * ⚠️ O relógio PAUSA com o cursor em cima, e recomeça do zero ao sair.
   *
   * Seis segundos é pouco para ler um detalhe de três linhas, e o gesto de quem
   * quer ler é justamente parar o mouse ali. Sem isso o aviso sumia embaixo do
   * cursor, e a informação que ele existe para dar se perdia.
   *
   * ⚠️ E também pausa com o FOCO dentro. Quem chega pelo teclado para ler ou
   * clicar em "Desfazer" não pode ver o alvo desaparecer entre o Tab e o Enter.
   */
  const fecharRef = useRef(aoFechar);

  // Em efeito, e nao no corpo: escrever num ref durante o render e o que a
  // regra do React proibe, e aqui nao ha ganho nenhum em fazer antes.
  useEffect(() => {
    fecharRef.current = aoFechar;
  });

  useEffect(() => {
    // Quem pede decisão não desaparece sozinho: sumir com a pergunta deixaria a
    // ação por fazer sem ninguém saber.
    if (aviso.exigeDecisao || pausado) return;

    const some = setTimeout(() => setSaindo(true), DURACAO);
    const tira = setTimeout(() => fecharRef.current(), DURACAO + SAIDA);
    return () => {
      clearTimeout(some);
      clearTimeout(tira);
    };
  }, [aviso.exigeDecisao, pausado]);

  /* Fechar com um gesto só, sem esperar o tempo: a saída ainda anima. */
  function sair() {
    setSaindo(true);
    setTimeout(() => fecharRef.current(), SAIDA);
  }

  return (
    <div
      role={aviso.tipo === "erro" ? "alert" : "status"}
      aria-live={aviso.tipo === "erro" ? "assertive" : "polite"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={(e) => {
        // Só solta quando o foco sai do cartão INTEIRO — passar do botão de
        // ação para o de fechar não pode reiniciar a contagem.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausado(false);
      }}
      style={{
        pointerEvents: "auto",
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        /* Borda fina do sistema + sombra curta. Antes o cartão não tinha borda e
           precisava de uma sombra pesada, mais um véu escurecendo o canto da
           tela, para se separar do fundo claro. A borda faz o mesmo trabalho
           sem escurecer nada, e o véu saiu. */
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06)",
        opacity: saindo ? 0 : 1,
        transform: saindo ? "translateY(6px) scale(0.98)" : "none",
        transition: `opacity ${SAIDA}ms var(--ease), transform ${SAIDA}ms var(--ease)`,
        animation: "aviso-entra 220ms var(--ease-out)",
      }}
    >
      {/*
        ⚠️ Ícone à ESQUERDA, e não acima do título.

        Acima, ele empurrava título e texto para a segunda linha e o cartão
        crescia uma faixa inteira só para carregar um símbolo. Na lateral, a
        leitura é a de sempre: sinal, depois o que aconteceu.
      */}
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 26,
          height: 26,
          flexShrink: 0,
          borderRadius: "var(--radius-full)",
          background: tom.fundo,
          color: tom.cor,
        }}
      >
        <svg
          width="14"
          height="14"
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

      {/* `paddingRight` abre o corredor do X: sem ele, título longo passava por
          baixo do botão e a última palavra ficava ilegível. */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 18 }}>
        <div
          style={{
            fontSize: "var(--text-base)",
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
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {aviso.detalhe}
          </div>
        )}

        {/*
          ⚠️ As ações usam o `Button` do sistema, e não botões desenhados aqui.

          Eles eram um preenchido vermelho e um vazado, feitos à mão — dois
          desenhos de botão que não existiam em nenhuma outra tela. Com o
          componente, o aviso herda altura, raio, foco e hover de todo o resto, e
          o próximo ajuste no botão chega aqui sozinho.

          Alinhadas à esquerda, embaixo da descrição: é onde a leitura termina.
        */}
        {aviso.acoes && aviso.acoes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {aviso.acoes.map((acao) => (
              <Button
                key={acao.rotulo}
                size="xs"
                variant={acao.principal ? "primary" : "secondary"}
                onClick={() => {
                  acao.aoClicar();
                  if (!acao.manterAberto) sair();
                }}
              >
                {acao.rotulo}
              </Button>
            ))}

            {/* Quem pergunta precisa oferecer o "não". Sem ele, a única saída
                de uma confirmação seria o X, que não parece resposta. */}
            {aviso.exigeDecisao && (
              <Button size="xs" onClick={sair}>
                Cancelar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Canto superior direito, fora do fluxo: no fluxo ele se alinhava ao
          meio do cartão e descia junto quando havia ações. */}
      <button
        type="button"
        onClick={sair}
        aria-label="Fechar aviso"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 22,
          height: 22,
          display: "grid",
          placeItems: "center",
          border: "none",
          borderRadius: "var(--radius-sm)",
          background: "none",
          color: "var(--text-tertiary)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
