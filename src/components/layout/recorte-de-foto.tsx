"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/kit";

/**
 * Recorte quadrado de uma imagem, como o do WhatsApp.
 *
 * A pessoa arrasta para escolher o que fica dentro e usa a barra para aproximar.
 * Sai um JPEG de 256px, e nada mais.
 *
 * ⚠️ Abre como JANELA no centro da tela, e nao dentro da gaveta.
 *
 * Recortar e um desvio: comeca, termina e devolve a pessoa ao formulario. Morando
 * dentro da gaveta, ele empurrava nome e e-mail para baixo e a pessoa recortava
 * numa faixa estreita, encaixada entre campos. No centro, a imagem fica no maior
 * espaco disponivel e nada mais disputa a atencao — e e assim que todo recorte de
 * foto se comporta, do Windows ao WhatsApp.
 *
 * ⚠️ Sai por PORTAL e por cima da gaveta (`Z_DA_JANELA`). Ela nasce de dentro de
 * um drawer, que ja e `position: fixed` com z-index proprio: sem portal, a janela
 * ficaria presa no contexto de empilhamento dele.
 *
 * ⚠️ Quadrado, e o CIRCULO e so a mascara por cima.
 *
 * O avatar aparece redondo em todo lugar, mas guardar um PNG com canto
 * transparente daria uma imagem que so serve arredondada: qualquer lista futura
 * que a mostre quadrada veria as bordas comidas. Guardamos o quadrado inteiro e
 * cada lugar decide o formato.
 *
 * ⚠️ 256px e qualidade 0,82 de proposito.
 *
 * O maior uso da foto tem 36 pixels de lado. Guardar o original de 4000px seria
 * subir cinco megabytes para desenhar um circulo do tamanho de uma unha, e cada
 * abertura da casca baixaria isso de novo.
 */

/** O lado da imagem gravada, em pixels. */
const LADO = 256;

/** O lado do palco onde se arrasta, na tela. */
const PALCO = 300;

/**
 * Acima do drawer de primeiro andar (401) e abaixo dos avisos.
 *
 * A janela nasce de dentro da gaveta e precisa cobri-la; se ficasse embaixo, o
 * veu dela escureceria a gaveta e o recorte apareceria por tras.
 */
const Z_DA_JANELA = 500;

export function RecorteDeFoto({
  arquivo,
  onPronto,
  onCancelar,
}: {
  arquivo: File;
  /** Recebe o recorte pronto, ja em JPEG. */
  onPronto: (recorte: File) => void;
  onCancelar: () => void;
}) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [desloc, setDesloc] = useState({ x: 0, y: 0 });
  const [erro, setErro] = useState<string | null>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ x: number; y: number } | null>(null);

  /*
   * ⚠️ Le o arquivo por `createObjectURL` e SOLTA a URL ao sair.
   *
   * Sem o `revoke`, cada foto experimentada fica na memoria do navegador ate a
   * aba fechar — e experimentar varias e o uso normal desta tela.
   */
  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    /*
     * ⚠️ A bandeira existe por causa do erro FALSO.
     *
     * Em desenvolvimento o React monta, desmonta e monta de novo; a limpeza da
     * primeira montagem revoga a URL, e a imagem que estava carregando com ela
     * dispara `onerror`. A segunda carrega bem, mas a mensagem "nao foi possivel
     * abrir" ja tinha ficado na tela — e ficava sobre uma foto visivel.
     *
     * Com a bandeira, o carregamento abandonado nao fala mais.
     */
    let vivo = true;

    img.onload = () => {
      if (!vivo) return;
      setErro(null);
      setImagem(img);
    };
    img.onerror = () => {
      if (!vivo) return;
      setErro("Não foi possível abrir esta imagem.");
    };
    img.src = url;

    return () => {
      vivo = false;
      URL.revokeObjectURL(url);
    };
  }, [arquivo]);

  /* Redesenha a cada arrasto e a cada passo do zoom. */
  useEffect(() => {
    const canvas = tela.current;
    if (!canvas || !imagem) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const escala = escalaMinima(imagem) * zoom;
    const largura = imagem.width * escala;
    const altura = imagem.height * escala;

    ctx.clearRect(0, 0, PALCO, PALCO);
    ctx.drawImage(
      imagem,
      PALCO / 2 - largura / 2 + desloc.x,
      PALCO / 2 - altura / 2 + desloc.y,
      largura,
      altura,
    );
  }, [imagem, zoom, desloc]);

  /*
   * A menor escala que ainda cobre o quadrado inteiro.
   *
   * ⚠️ Cobrir, e nao caber: uma foto deitada que "coubesse" deixaria duas faixas
   * vazias no recorte, e o avatar sairia com tarja.
   */
  function escalaMinima(img: HTMLImageElement): number {
    return Math.max(PALCO / img.width, PALCO / img.height);
  }

  function gerar() {
    if (!imagem) return;

    const fora = document.createElement("canvas");
    fora.width = LADO;
    fora.height = LADO;

    const ctx = fora.getContext("2d");
    if (!ctx) return;

    /* O mesmo desenho do palco, na escala do arquivo final. */
    const proporcao = LADO / PALCO;
    const escala = escalaMinima(imagem) * zoom * proporcao;
    const largura = imagem.width * escala;
    const altura = imagem.height * escala;

    ctx.drawImage(
      imagem,
      LADO / 2 - largura / 2 + desloc.x * proporcao,
      LADO / 2 - altura / 2 + desloc.y * proporcao,
      largura,
      altura,
    );

    fora.toBlob(
      (blob) => {
        if (!blob) {
          setErro("Não foi possível preparar a imagem.");
          return;
        }
        onPronto(new File([blob], "foto.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.82,
    );
  }

  return createPortal(
    <>
      {/*
        O veu. Clicar fora CANCELA: e o gesto que todo mundo tenta primeiro, e
        sem ele a unica saida seria achar o botao.
      */}
      <div
        onClick={onCancelar}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: Z_DA_JANELA,
          background: "rgba(0,0,0,0.45)",
          animation: "fade-in 160ms var(--ease-out)",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recortar a foto"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          /* Centro exato da tela, sem depender da largura do conteudo. */
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: Z_DA_JANELA + 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: 20,
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <span
          style={{
            alignSelf: "flex-start",
            fontSize: "var(--text-lg)",
            fontWeight: "var(--fw-semi)",
            color: "var(--text-primary)",
          }}
        >
          Recortar a foto
        </span>

        <span
          style={{
            alignSelf: "flex-start",
            marginTop: -6,
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
          }}
        >
          Arraste para escolher o que fica dentro e use o zoom para aproximar.
        </span>

        {erro && (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--danger-text)" }}>{erro}</span>
              )}

              <div
                style={{
                  position: "relative",
                  width: PALCO,
                  height: PALCO,
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  background: "var(--surface-3)",
                  cursor: arrasto.current ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  arrasto.current = { x: e.clientX - desloc.x, y: e.clientY - desloc.y };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!arrasto.current) return;
                  setDesloc({ x: e.clientX - arrasto.current.x, y: e.clientY - arrasto.current.y });
                }}
                onPointerUp={() => {
                  arrasto.current = null;
                }}
              >
                <canvas ref={tela} width={PALCO} height={PALCO} style={{ display: "block" }} />

                {/*
                  A mascara redonda: escurece o que fica DE FORA do circulo.

                  ⚠️ Ela nao recebe o mouse (`pointerEvents: none`), senao o arrasto
                  morreria assim que o cursor passasse por cima dela, que e sempre.
                */}
                <div
                  aria-hidden
                  className="redondo"
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    borderRadius: "var(--radius-full)",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, width: PALCO }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.02}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--primary)" }}
                />
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" size="sm" onClick={gerar} disabled={!imagem}>
                  Usar esta foto
                </Button>
                <Button size="sm" onClick={onCancelar}>
                  Cancelar
                </Button>
              </div>
      </div>
    </>,
    document.body,
  );
}
