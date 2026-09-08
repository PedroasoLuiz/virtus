"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ItemDoMenu, MenuDeLinha } from "@/components/ui/menu-de-linha";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";

/**
 * O menu de "…" do cabeçalho do drawer.
 *
 * ⚠️ Existe porque a barra de ícones cresce e ninguém percebe.
 *
 * O ticket chegou a cinco alvos de 28 pixels lado a lado — imprimir, cancelar,
 * excluir, histórico e fechar —, com dois destrutivos encostados no X. Numa
 * barra assim o gesto de fechar fica a um pixel do de apagar, e nenhum dos
 * ícones diz o que faz sem o hover.
 *
 * Ficam de fora só os que se usam sem pensar: imprimir, que costuma ser o
 * motivo de abrir, e fechar, que precisa estar sempre no mesmo lugar.
 *
 * ⚠️ Mora no kit porque três drawers fazem o mesmo gesto. Escrito em cada um,
 * o tamanho do gatilho e a posição do painel de histórico já teriam divergido.
 */
export function MenuDoCabecalho({
  children,
}: {
  children: (fechar: () => void) => React.ReactNode;
}) {
  /* O gatilho tem o tamanho dos botões ao lado, e não o da linha da tabela: um
     círculo menor no meio de dois iguais lê como se estivesse desativado. */
  return <MenuDeLinha moldura={{ width: 28, height: 28 }}>{children}</MenuDeLinha>;
}

export type Autoria = {
  criadoEm: string | null;
  criadoPor: string | null;
  editadoEm: string | null;
  editadoPor: string | null;
};

/**
 * O histórico como OPÇÃO do menu, abrindo um painel à esquerda dele.
 *
 * ⚠️ Não é conteúdo aberto junto das ações: o menu se abre para escolher, e uma
 * ficha já expandida no topo empurra as opções para baixo e responde uma
 * pergunta que ninguém fez ainda.
 *
 * ⚠️ E o painel sai por PORTAL, preso na tela. O cartão do menu tem
 * `overflow-y: auto` — e quando um eixo deixa de ser `visible` o outro também
 * corta —, então um bloco posicionado à esquerda dentro dele seria recortado na
 * própria borda. Medindo o botão e desenhando fora, não há o que o corte.
 *
 * Marco sem quem e sem quando é ausente, não vazio: um registro que ninguém
 * editou não deve mostrar "Última alteração —".
 */
export function ItemDeHistorico({ autoria }: { autoria: Autoria }) {
  const [aberto, setAberto] = useState(false);
  const [onde, setOnde] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLDivElement>(null);

  const marcos = [
    { rotulo: "Criado", quem: autoria.criadoPor, quando: autoria.criadoEm },
    { rotulo: "Última alteração", quem: autoria.editadoPor, quando: autoria.editadoEm },
  ].filter((m) => m.quem || m.quando);

  if (marcos.length === 0) return null;

  const LARGURA = 210;
  const RESPIRO = 6;

  return (
    <div ref={botao}>
      <ItemDoMenu
        rotulo="Histórico"
        icone={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* O mesmo relógio-com-seta-de-volta do `BotaoHistorico`: quem já
                conhece o ícone acha o mesmo aqui, mesmo tendo virado item. */}
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7.5V12l3 1.8" />
          </svg>
        }
        onClick={() => {
          const r = botao.current?.getBoundingClientRect();
          if (r) {
            /* Cai para a DIREITA quando não cabe à esquerda: o menu do
               cabeçalho já mora perto da borda, e num drawer estreito o painel
               sairia da tela. */
            const cabeAEsquerda = r.left - LARGURA - RESPIRO >= 8;
            setOnde({
              top: r.top,
              left: cabeAEsquerda ? r.left - LARGURA - RESPIRO : r.right + RESPIRO,
            });
          }
          setAberto((v) => !v);
        }}
      />

      {aberto &&
        onde &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: onde.top,
              left: onde.left,
              width: LARGURA,
              zIndex: 442,
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              boxShadow: "var(--shadow-md)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {marcos.map((m) => (
              <div key={m.rotulo} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                    letterSpacing: "var(--tracking-wide)",
                    textTransform: "uppercase",
                  }}
                >
                  {m.rotulo}
                </span>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                  {m.quem ?? "—"}
                  {m.quando && (
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {" · "}
                      {paraFormatoBR(m.quando.slice(0, 10) as DataISO)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
