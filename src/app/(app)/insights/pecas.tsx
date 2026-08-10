"use client";

import { paraReais, type Centavos } from "@/shared/utils/money";
import { hoje, type DataISO } from "@/shared/utils/datas";
import type { FamiliaDeResultado } from "@/shared/domain/insights";

/**
 * As pecas miudas do painel: formatos de numero, molduras e icones.
 *
 * ⚠️ Arquivo proprio porque TODOS os blocos usam. Dentro da tela, elas eram
 * metade do motivo de ela ter mil e novecentas linhas — e cada bloco novo tinha
 * de nascer naquele mesmo arquivo so para alcanca-las.
 */

export function inteiro(n: number): string {
  return n.toLocaleString("pt-BR");
}


/** "+312" ou "-14": ganho de seguidor precisa do sinal para significar algo. */
export function comSinal(n: number): string {
  return `${n > 0 ? "+" : ""}${inteiro(n)}`;
}


export function porcento(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}


/**
 * ⚠️ Devolve vazio em data vazia, e não "undefined/undefined".
 *
 * A publicação vem da Meta e o `timestamp` pode faltar. Sem esta saída, o cartão
 * escreveria a palavra `undefined` no canto, que é pior que não escrever nada.
 */
export function dataBR(iso: string): string {
  if (iso.length < 10) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}


/**
 * O número do EIXO, curto.
 *
 * ⚠️ Existe separado do formato do balão porque o eixo tem quatro valores
 * empilhados num vão de quarenta pixels. "1.234.567" ali vira uma parede de
 * dígitos ao lado do desenho, e o eixo serve para estimar altura, não para ler
 * o valor exato: esse está no balão, sob o cursor.
 */
export function curto(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(Math.round(n));
}


/**
 * ⚠️ Dinheiro passa por `paraReais` ANTES de encurtar. A série vem em centavos,
 * como todo dinheiro do sistema, e encurtar o centavo direto escreveria "123 mil"
 * onde são mil e duzentos reais.
 */
export function curtoEmReais(centavos: number): string {
  return curto(paraReais(centavos as Centavos));
}


export function plural(n: number, um: string, varios: string): string {
  return `${inteiro(n)} ${n === 1 ? um : varios}`;
}


/** O primeiro dia do mês corrente, que é o recorte com que se abre uma conta. */
export function inicioDoMes(): DataISO {
  return `${hoje().slice(0, 7)}-01` as DataISO;
}


/*
 * ⚠️ Tudo alinhado à ESQUERDA, inclusive dinheiro. É regra do sistema, e não
 * preferência desta tela.
 */
export const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};


export const CORTADO: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};


/**
 * Um bloco do relatório.
 *
 * ⚠️ SEM recuo lateral: ele vem da coluna do `LayoutComMenu`. Repetido aqui, os
 * cartões ficariam 16 mais para dentro que o texto ao lado deles.
 *
 * ⚠️ É uma coluna FLEX, e não um empilhamento comum. Os cartões e o gráfico têm
 * a altura que têm; o que sobra é da peça de baixo, que rola por dentro. Sem
 * isso, a seção passaria da tela e seria cortada, porque a coluna não rola.
 */
export function Bloco({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      {children}
    </div>
  );
}


/**
 * O que ocupa a altura que sobrou, e rola por dentro.
 *
 * ⚠️ UMA por seção, e sempre a última. Duas dividiriam o espaço e as duas
 * ficariam curtas demais para servir; nenhuma faria a seção ser cortada em
 * silêncio.
 */
export function Rolavel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 140, overflowY: "auto", marginTop: 12 }}>{children}</div>
  );
}


/** O respiro entre as peças de um mesmo bloco. */
export function Vao({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 12 }}>{children}</div>;
}

// ── Ícones (grade de 20) ────────────────────────────────────────────────────


/** A grade de peças: publicação e criativo usam a mesma. */
export function Grade({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        /*
         * ⚠️ `auto-fit`, e não `auto-fill`. Com `auto-fill` o navegador cria as
         * colunas que couberem e deixa as vazias ocupando espaço: seis peças num
         * quadro largo ficavam pequenas e espremidas à esquerda, com um vão morto
         * do lado. Com `auto-fit` as colunas vazias somem e as seis crescem para
         * ocupar a largura disponível.
         */
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}


export function Subtitulo({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        color: "var(--text-secondary)",
        marginBottom: 10,
      }}
    >
      {children}
    </h3>
  );
}


/**
 * A prévia da arte, de anúncio ou de publicação.
 *
 * ⚠️ `img` cru, e não o `Image` do Next, e isto é decisão. A URL vem do CDN da
 * Meta assinada e EXPIRA em algumas horas. O otimizador do Next guardaria a
 * versão processada por muito mais tempo que a origem existe, e a grade passaria
 * a mostrar imagem quebrada de um dia para o outro sem ninguém ter mexido nela.
 */
export function Previa({ imagem, children }: { imagem: string | null; children?: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        // O fundo é o que aparece quando a URL do CDN já expirou: um quadro
        // neutro no lugar do ícone de imagem quebrada do navegador.
        background: "var(--surface-3)",
      }}
    >
      {imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagem}
          alt=""
          loading="lazy"
          /*
           * ⚠️ `no-referrer`, e isto não é detalhe.
           *
           * O CDN da Meta recusa imagem pedida com `Referer` de outro domínio: é
           * proteção contra hotlink, e do lado de cá aparece como quadro vazio,
           * sem erro nenhum no console. Sem o cabeçalho suprimido, a grade de
           * criativos nasce cinza e parece que a URL não veio.
           */
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {children}
    </div>
  );
}


/**
 * ⚠️ Um ícone por família, e não o alvo para todas. O ícone é o que se lê antes
 * do rótulo, e um balão de conversa diz "WhatsApp" antes de qualquer palavra.
 */
export function IconeDaFamilia({ familia }: { familia: FamiliaDeResultado | null }) {
  if (familia === "CONVERSA") return <IconeConversa />;
  if (familia === "CADASTRO") return <IconePessoaMais />;
  if (familia === "COMPRA") return <IconeCarrinho />;
  if (familia === "VISITA" || familia === "CLIQUE") return <IconeCursor />;
  return <IconeAlvo />;
}

// ── Anúncios ────────────────────────────────────────────────────────────────


/** Cédula: o dinheiro que saiu. */
export function IconeDinheiro() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <rect x="2.5" y="5" width="15" height="10" rx="2" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  );
}


/** Alvo: o que a campanha estava buscando. */
export function IconeAlvo() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
    </svg>
  );
}


/** Etiqueta de preço: quanto custou cada um. */
export function IconeEtiqueta() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M3.2 10.6V4.2a1 1 0 011-1h6.4l6 6-7.4 7.4z" />
      <circle cx="6.9" cy="6.9" r="1.1" />
    </svg>
  );
}


/** Duas pessoas: audiência. */
export function IconePessoas() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="8" cy="7.2" r="2.8" />
      <path d="M2.8 16.2a5.2 5.2 0 0110.4 0" />
      <path d="M13.8 5.1a2.8 2.8 0 010 4.6M14.6 16.2a5 5 0 00-1.2-3.2" />
    </svg>
  );
}


/** Ondas: o quanto se espalhou. */
export function IconeOnda() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="10" cy="10" r="1.6" />
      <path d="M6.3 6.3a5.2 5.2 0 000 7.4M13.7 6.3a5.2 5.2 0 010 7.4" />
    </svg>
  );
}


/** Coração: reação. */
export function IconeCoracao({ pequeno = false }: { pequeno?: boolean }) {
  const t = pequeno ? 13 : 18;
  return (
    <svg width={t} height={t} viewBox="0 0 20 20" {...TRACO}>
      <path d="M10 16s-5.6-3.4-5.6-7A2.9 2.9 0 0110 7.2 2.9 2.9 0 0115.6 9c0 3.6-5.6 7-5.6 7z" />
    </svg>
  );
}


/** Balão: comentário. */
export function IconeBalao() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" {...TRACO}>
      <path d="M17 9.6c0 3.1-3.1 5.6-7 5.6a8 8 0 01-2-.25L4 16.5l.8-2.6A5.4 5.4 0 013 9.6C3 6.5 6.1 4 10 4s7 2.5 7 5.6z" />
    </svg>
  );
}


/** Balão com traços: conversa iniciada. */
export function IconeConversa() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M17 9.6c0 3.1-3.1 5.6-7 5.6a8 8 0 01-2-.25L4 16.5l.8-2.6A5.4 5.4 0 013 9.6C3 6.5 6.1 4 10 4s7 2.5 7 5.6z" />
      <path d="M7.4 9.6h.1M10 9.6h.1M12.6 9.6h.1" />
    </svg>
  );
}


/** Pessoa com mais: cadastro novo. */
export function IconePessoaMais() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="8.2" cy="7" r="2.8" />
      <path d="M3 16.2a5.2 5.2 0 0110.4 0" />
      <path d="M15.4 6.6v4.4M13.2 8.8h4.4" />
    </svg>
  );
}


/** Carrinho: compra. */
export function IconeCarrinho() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M2.6 3.4h2l1.8 8.2h7.6l1.6-6H5.2" />
      <circle cx="7.4" cy="15.4" r="1.1" />
      <circle cx="13.6" cy="15.4" r="1.1" />
    </svg>
  );
}


/** Cursor: visita e clique. */
export function IconeCursor() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M4.6 3.4l11 4.6-4.7 1.6-1.7 4.8z" />
      <path d="M11.4 11.4l4 4" />
    </svg>
  );
}


/** Seta curva: compartilhamento. */
export function IconeSeta() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" {...TRACO}>
      <path d="M3.5 15.5c0-4.4 2.9-6.6 7.5-6.8V5.5l5.5 4.6-5.5 4.6v-3.2c-3.6.1-5.8 1.2-7.5 4z" />
    </svg>
  );
}


/** Olho: quem abriu a Página. */
export function IconeOlho() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M2.5 10S5.4 5.5 10 5.5 17.5 10 17.5 10 14.6 14.5 10 14.5 2.5 10 2.5 10z" />
      <circle cx="10" cy="10" r="2.1" />
    </svg>
  );
}


export const TRACO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
