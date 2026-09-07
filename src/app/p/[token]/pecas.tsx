"use client";

import { useEffect, useRef, useState } from "react";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import type { ItemPublico } from "@/modules/publico/publico.types";

/**
 * As peças que as folhas públicas compartilham.
 *
 * ⚠️ Saíram de `cobranca-publica` quando a página deixou de ter uma folha só.
 * São duas agora — a da CONTA, que é o que o link abre, e a do TICKET, que o
 * número da composição abre em outra aba — e as duas têm de parecer o mesmo
 * papel. Com as peças copiadas em cada arquivo, a primeira correção de padding
 * já as deixaria diferentes, e o cliente veria dois documentos que não se
 * reconhecem como da mesma empresa.
 */

/* Azul da marca. Documento não lê CSS var: se a identidade mudar, muda aqui. */
export const AZUL = "#0A52B9";
export const TINTA = "#101012";
export const CINZA = "#86868B";
export const REGUA = "#E3E3E3";
export const AZUL_CLARO = "#EAF0FA";

/** A4 em pixels de CSS, a 96 dpi. */
const LARGURA_A4 = 794;

/**
 * Encolhe a folha para caber na tela, SEM deixar buraco embaixo.
 *
 * `transform: scale()` muda o desenho e nao o espaco ocupado: a folha aparecia
 * pequena e o resto da pagina continuava a 297mm de distancia, com os botoes la
 * embaixo. Aqui a altura do invólucro e recalculada junto com a escala, entao o
 * que vem depois encosta na folha.
 *
 * A conta precisa de JS porque depende da largura disponivel — `@media` sabe o
 * tamanho da janela, nao o da coluna onde a folha caiu.
 */
export function FolhaAjustada({ children }: { children: React.ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [altura, setAltura] = useState<number | undefined>(undefined);

  useEffect(() => {
    const medir = () => {
      const disponivel = area.current?.clientWidth ?? LARGURA_A4;
      const nova = Math.min(1, disponivel / LARGURA_A4);
      setEscala(nova);
      setAltura((folha.current?.offsetHeight ?? 0) * nova);
    };

    medir();

    const observador = new ResizeObserver(medir);
    if (area.current) observador.observe(area.current);
    // A folha tambem muda de altura: fonte que carrega depois, texto que quebra.
    if (folha.current) observador.observe(folha.current);

    return () => observador.disconnect();
  }, []);

  return (
    <div ref={area} style={{ width: "100%", height: altura, overflow: "hidden" }}>
      <div
        ref={folha}
        style={{
          width: LARGURA_A4,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
          // Centraliza a folha quando ela cabe inteira; colada a esquerda quando
          // nao cabe, que e onde a leitura comeca.
          marginLeft: escala === 1 ? "auto" : undefined,
          marginRight: escala === 1 ? "auto" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

export function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", lineHeight: 1.65 }}>
      {/* Largura fixa alinha os valores na mesma coluna. `nowrap` só no rótulo:
          sem ele "Apuração" quebrava e o valor caía para a linha de baixo — mas
          o VALOR pode quebrar, porque nome de obra é texto livre e longo. */}
      <span
        style={{
          width: "18mm",
          flexShrink: 0,
          fontSize: "8.5pt",
          color: CINZA,
          whiteSpace: "nowrap",
        }}
      >
        {rotulo}
      </span>
      <span style={{ fontSize: "8.5pt", fontWeight: 700, color: TINTA }}>{valor}</span>
    </div>
  );
}

export function Secao({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "7pt",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: CINZA,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

export function Nome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10pt", fontWeight: 700, color: TINTA, marginTop: "1.5mm" }}>
      {children}
    </div>
  );
}

export function Detalhe({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "8.5pt", color: CINZA, lineHeight: 1.45 }}>{children}</div>;
}

export function Th({
  children,
  direita,
  larguraMm,
}: {
  children: React.ReactNode;
  direita?: boolean;
  larguraMm?: number;
}) {
  return (
    <th
      style={{
        width: larguraMm ? `${larguraMm}mm` : undefined,
        padding: "0 0 1.5mm",
        textAlign: direita ? "right" : "left",
        fontSize: "7pt",
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: CINZA,
        textTransform: "uppercase",
        borderBottom: `0.3mm solid ${REGUA}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

/**
 * Celula de tabela: preta e sem negrito, sempre.
 *
 * O peso e do cabecalho, que e cinza. Negrito no corpo tira do cabecalho a unica
 * marca que ele tem, e a tabela perde a hierarquia.
 */
export function Td({
  children,
  direita,
}: {
  children: React.ReactNode;
  direita?: boolean;
}) {
  return (
    <td
      style={{
        padding: "2mm 0",
        textAlign: direita ? "right" : "left",
        verticalAlign: "top",
        fontSize: "8.5pt",
        fontWeight: 400,
        color: TINTA,
        lineHeight: 1.45,
        borderBottom: `0.3mm solid ${REGUA}`,
      }}
    >
      {children}
    </td>
  );
}

/**
 * Resumo a direita, na largura da coluna de valores.
 *
 * E o que faz o total parecer parte da tabela e nao um bloco solto embaixo dela.
 */
export function Resumo({
  linhas,
}: {
  linhas: { rotulo: string; valor: Centavos; forte?: boolean }[];
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2.5mm" }}>
      <div style={{ width: "56mm" }}>
        {linhas.map((l) => (
          <div
            key={l.rotulo}
            style={{
              display: "flex",
              justifyContent: "space-between",
              lineHeight: 1.7,
              fontSize: "8.5pt",
            }}
          >
            <span style={{ color: l.forte ? TINTA : CINZA, fontWeight: l.forte ? 700 : 400 }}>
              {l.rotulo}
            </span>
            <span style={{ color: TINTA, fontWeight: l.forte ? 700 : 400 }}>
              {formatarSemSimbolo(l.valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * O rodapé, colado no pé da folha e não depois do conteúdo.
 *
 * O branco entre o conteúdo e o rodapé faz parte do documento: se ele subisse
 * junto com o texto, a folha mudaria de cara conforme o número de serviços, e
 * duas cobranças do mesmo cliente não pareceriam o mesmo papel.
 */
export function RodapeDaFolha({ esquerda }: { esquerda: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "14mm",
        right: "14mm",
        bottom: "7mm",
        display: "flex",
        justifyContent: "space-between",
        fontSize: "7.5pt",
        color: CINZA,
      }}
    >
      <span>{esquerda}</span>
      <span>1 / 1</span>
    </div>
  );
}

/** Horas saem como "12h30" — o decimal é o formato de quem calcula, não de quem lê. */
export function quantidade(q: number, unidade: ItemPublico["unidade"]): string {
  if (unidade === "H") {
    const minutos = Math.round(q * 60);
    const m = minutos % 60;
    return m === 0
      ? `${minutos / 60}h`
      : `${Math.floor(minutos / 60)}h${String(m).padStart(2, "0")}`;
  }
  return Number.isInteger(q) ? `${q} un` : `${q.toFixed(2).replace(".", ",")} un`;
}

/**
 * Uma linha de menu flutuante: ícone à esquerda, rótulo à direita.
 *
 * ⚠️ Compartilhada pelos dois menus da página — o de downloads e o de tickets.
 * Duplicada, o primeiro ajuste de hover ou de raio deixaria os dois cartões
 * diferentes, lado a lado na mesma tela.
 */
export function ItemDeMenu({
  rotulo,
  abaixo,
  icone,
  destaque,
  onClick,
}: {
  rotulo: string;
  /** Segunda linha, menor e em cinza. Para o que o rótulo sozinho não distingue. */
  abaixo?: string;
  icone: React.ReactNode;
  destaque?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px",
        border: "none",
        borderRadius: 9,
        background: hover ? AZUL_CLARO : "transparent",
        color: destaque ? AZUL : TINTA,
        fontWeight: destaque ? 600 : 500,
        fontSize: 14,
        fontFamily: "Helvetica, Arial, sans-serif",
        textAlign: "left",
        // Com segunda linha o item deixa de ser uma linha só, e `nowrap` a
        // empurraria para fora do cartão.
        whiteSpace: abaixo ? "normal" : "nowrap",
        cursor: "pointer",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke={destaque ? AZUL : CINZA}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, alignSelf: "start", marginTop: abaixo ? 2 : 0 }}
      >
        {icone}
      </svg>

      {abaixo ? (
        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span>{rotulo}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: CINZA,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {abaixo}
          </span>
        </span>
      ) : (
        rotulo
      )}
    </button>
  );
}
