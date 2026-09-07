"use client";

import { CINZA, TINTA } from "./pecas";

/**
 * O que envolve toda folha pública: o CSS da folha e o recado de impressão.
 *
 * ⚠️ Compartilhado pelas duas páginas — a da conta e a do ticket. Duplicado, o
 * `@media print` de uma delas ficaria para trás na primeira correção, e aí uma
 * imprimiria certo e a outra sairia cortada.
 */
export function MolduraPublica({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%" }} className="tela-cobranca">
      <style>{`
        .folha {
          width: 210mm; min-height: 297mm; background: #fff;
          box-sizing: border-box; position: relative;
          transform-origin: top left;
          font-family: Helvetica, Arial, sans-serif;
          box-shadow: 0 2px 10px rgba(0,0,0,0.10);
        }
        .folha table { border-collapse: collapse; width: 100%; }

        /* O cartao nasce do canto de baixo e da direita — de onde o botao
           esta — em vez de aparecer inteiro de uma vez. */
        .cartao-downloads {
          transform-origin: bottom right;
          animation: abre-downloads 150ms cubic-bezier(0.2, 0, 0, 1);
        }
        @keyframes abre-downloads {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .girando { animation: gira 800ms linear infinite; }
        @keyframes gira { to { transform: rotate(360deg); } }

        /* Quem pediu menos movimento nao ganha movimento nenhum: o cartao
           aparece pronto, e a espera para de girar. */
        @media (prefers-reduced-motion: reduce) {
          .cartao-downloads, .girando { animation: none; }
        }

        /*
          Impressao pelo navegador nao sai daqui.

          A folha esta encolhida por transform scale para caber na tela, e o que
          a impressora recebe disso e uma folha cortada no meio, com o resto em
          branco. O PDF do botao e gerado do zero, em A4 de verdade. Entao o
          Ctrl+P nao imprime a tela: imprime um recado dizendo onde esta o
          documento bom. (Sem crase neste comentario: ele mora dentro de um
          template literal, e a crase o fecharia.)

          O recado e irmao das folhas, entao esconder e por :not e nao por
          display:none no envoltorio inteiro.
        */
        @media print {
          .tela-cobranca > *:not(.recado-impressao) { display: none !important; }
          .recado-impressao { display: block !important; }
        }
      `}</style>

      {/*
        So existe no papel. Em tela fica escondido, e a impressao o revela no
        lugar da pagina inteira.
      */}
      <div
        className="recado-impressao"
        style={{
          display: "none",
          padding: "40mm 20mm",
          fontFamily: "Helvetica, Arial, sans-serif",
          color: TINTA,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          Baixe o documento antes de imprimir
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: "12px 0 0", color: CINZA }}>
          Esta página mostra o documento reduzido para caber na tela, e impressa assim
          ela sai cortada. Use o botão azul no canto inferior direito para baixar o
          arquivo em PDF, e imprima o arquivo.
        </p>
      </div>

      {children}
    </div>
  );
}
