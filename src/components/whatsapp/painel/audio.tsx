"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * O player de voz da conversa.
 *
 * Proprio, e nao o `<audio controls>` do navegador: aquele traz barra de
 * download, menu de contexto e altura fixa, e cada navegador desenha o seu. As
 * ondas sao decorativas de proposito — desenhar a forma real exigiria decodificar
 * o arquivo inteiro so para mostrar um traco.
 */

/**
 * Player de audio no formato do WhatsApp.
 *
 * O `<audio controls>` nativo traz a barra cinza do navegador, que muda de
 * desenho em cada um e nao tem nada a ver com o resto da tela. Aqui o `<audio>`
 * fica escondido e serve so de motor; o que aparece e botao redondo, barras e
 * tempo.
 *
 * As barras sao decorativas e derivadas da URL, nao do som: desenhar a forma de
 * onda real exigiria baixar e decodificar o audio inteiro so para pintar uns
 * tracinhos. Elas indicam PROGRESSO, que e o que se usa de verdade.
 */
/*
 * ⚠️ 0.8, e nao 1.
 *
 * Nota de voz do WhatsApp vem muito normalizada, e no volume cheio do navegador
 * ela satura: a voz sai estourada. Oito decimos resolvem, e quem quiser mais
 * tem o volume do proprio sistema.
 *
 * Chegou a existir um botao de tres niveis aqui. Saiu porque colidia com o de
 * baixar dentro dos 240px do bloco, e o padrao sozinho ja resolvia o problema.
 */
const VOLUME_PADRAO = 0.8;
export function PlayerDeAudio({ url, onFalha }: { url: string; onFalha?: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(0);
  // O elemento nasce em 1; sem isto o primeiro instante sai no volume cheio.
  useEffect(() => {
    if (audio.current) audio.current.volume = VOLUME_PADRAO;
  }, []);

  const barras = useMemo(() => {
    // Altura estavel por URL: a mesma mensagem desenha igual a cada render.
    // Sem acumulador mutavel — cada barra sai de uma conta pura sobre (semente,
    // indice), que e o que torna o desenho reprodutivel.
    const semente = Array.from(url).reduce(
      (acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 10007,
      7,
    );

    return Array.from(
      { length: 28 },
      (_, i) => 30 + ((semente * (i + 13) * 2654435761) % 70),
    );
  }, [url]);

  const progresso = duracao > 0 ? posicao / duracao : 0;

  /*
   * `play()` devolve promessa, e pausar antes de ela resolver a REJEITA com
   * AbortError. Acontece no uso normal: dois cliques rapidos, ou o Realtime
   * recarregando a thread no meio da carga do audio.
   *
   * Duas defesas: engolir essa rejeicao especifica, que nao e falha de nada, e
   * deixar o estado seguir os EVENTOS do elemento em vez de ser cravado no
   * clique — assim ele nunca diz "tocando" para um play que foi cancelado.
   */
  function alternar() {
    const el = audio.current;
    if (!el) return;

    if (el.paused) {
      el.play().catch(() => {
        /* interrompido antes de comecar: nada a relatar */
      });
    } else {
      el.pause();
    }
  }

  function irPara(fracao: number) {
    const el = audio.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = el.duration * fracao;
    setPosicao(el.currentTime);
  }

  return (
    /*
     * Largura vem do PAI, nao daqui.
     *
     * Fixar 240 aqui somava com o botao de baixar ao lado e estourava a bolha.
     * Quem sabe quanto espaco ha e quem coloca o player.
     */
    <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onError={() => onFalha?.()}
        onEnded={() => {
          setTocando(false);
          setPosicao(0);
        }}
      />

      <button
        type="button"
        onClick={alternar}
        aria-label={tocando ? "Pausar" : "Tocar"}
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          color: "var(--primary)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {tocando ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4.5" height="16" rx="1.4" />
            <rect x="13.5" y="4" width="4.5" height="16" rx="1.4" />
          </svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4.8v14.4a1 1 0 0 0 1.53.85l11.2-7.2a1 1 0 0 0 0-1.7L8.53 3.95A1 1 0 0 0 7 4.8z" />
          </svg>
        )}
      </button>

      <div
        role="slider"
        aria-label="Posição do áudio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progresso * 100)}
        tabIndex={0}
        onClick={(e) => {
          const caixa = e.currentTarget.getBoundingClientRect();
          irPara(Math.min(1, Math.max(0, (e.clientX - caixa.left) / caixa.width)));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") irPara(Math.min(1, progresso + 0.05));
          if (e.key === "ArrowLeft") irPara(Math.max(0, progresso - 0.05));
        }}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 2,
          // 22 e nao 26: com 26 as barras encostavam no respiro de cima da
          // bolha e o bloco lia mais alto que as bolhas de texto ao lado.
          height: 22,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {barras.map((altura, i) => (
          <span
            key={i}
            className="redondo"
            style={{
              flex: 1,
              height: `${altura}%`,
              minWidth: 3,
              // Ponta arredondada de verdade: `.redondo` desliga o squircle do
              // seletor universal, que num tracinho de 3px achata as laterais e
              // devolve o retangulo.
              borderRadius: "var(--radius-full)",
              background:
                i / barras.length <= progresso ? "var(--primary)" : "var(--text-disabled)",
              transition: "background 90ms linear",
            }}
          />
        ))}
      </div>

      <span
        style={{
          flexShrink: 0,
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 34,
          textAlign: "right",
        }}
      >
        {duracaoEmTexto(tocando || posicao > 0 ? posicao : duracao)}
      </span>
    </div>
  );
}
export function duracaoEmTexto(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
