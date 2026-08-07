"use client";

import { useState } from "react";

/**
 * A bolinha com a foto ou as iniciais.
 *
 * ⚠️ A cor sai da SEMENTE (o telefone, o id do cadastro), e nao do nome. Contato
 * sem nome mudaria de cor assim que alguem o cadastrasse, e a cor e justamente o
 * que faz reconhecer a mesma pessoa na lista sem ler.
 *
 * ⚠️ Mora no kit, e nao no painel do WhatsApp. Nasceu la, mas a mesma bolinha
 * identifica pessoa na agenda, na lista de cadastros e na persona: uma copia por
 * tela faria a mesma empresa ter cor diferente em cada uma.
 */

/**
 * Iniciais coloridas, no lugar da foto.
 *
 * A Cloud API nao entrega a foto de perfil de quem escreve — nao ha endpoint
 * para isso, e nao e limitacao do nosso token: a Meta simplesmente nao expoe
 * foto de cliente. Entao a alternativa honesta e uma inicial com cor estavel,
 * que serve ao mesmo proposito: distinguir conversa de conversa no relance.
 *
 * A cor sai do telefone, e nao de um sorteio, para a mesma pessoa ter sempre a
 * mesma cor entre recarregamentos.
 */
const CORES_AVATAR = [
  "#0a7ea4",
  "#7c3aed",
  "#be123c",
  "#b45309",
  "#047857",
  "#4338ca",
  "#a21caf",
  "#0f766e",
];
export function corDoAvatar(semente: string): string {
  let soma = 0;
  for (let i = 0; i < semente.length; i++) soma = (soma + semente.charCodeAt(i)) % 997;
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}
export function iniciais(nome: string): string {
  const partes = nome
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
export function Avatar({
  nome,
  semente,
  foto,
  tamanho = 36,
}: {
  nome: string;
  semente: string;
  /** Logo do cliente, quando a conversa esta vinculada a um cadastro. */
  foto?: string | null;
  tamanho?: number;
}) {
  const [quebrou, setQuebrou] = useState(false);

  /*
   * A logo do cadastro entra no lugar das iniciais quando existe.
   *
   * ⚠️ Com reserva: a URL vem do bucket publico `virtusmind`, e imagem de
   * cadastro some, muda de nome ou nunca existiu. Falhando, `onError` devolve as
   * iniciais — nunca um quadrado vazio no lugar do contato.
   */
  if (foto && !quebrou) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={foto}
        alt=""
        aria-hidden
        onError={() => setQuebrou(true)}
        className="redondo"
        style={{
          width: tamanho,
          height: tamanho,
          flexShrink: 0,
          borderRadius: "var(--radius-full)",
          objectFit: "cover",
          background: "var(--surface-3)",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="redondo"
      style={{
        width: tamanho,
        height: tamanho,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--radius-full)",
        background: corDoAvatar(semente),
        color: "#fff",
        fontSize: tamanho <= 30 ? "var(--text-xs)" : "var(--text-sm)",
        fontWeight: "var(--fw-semi)",
        letterSpacing: "var(--tracking-snug)",
        userSelect: "none",
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

// ── Lista ───────────────────────────────────────────────────────

/**
 * As mesmas iniciais, como IMAGEM.
 *
 * ⚠️ Existe para o aviso do navegador. Ele mostra uma imagem por endereço, e não
 * aceita um componente: sem isto, quem não tem foto cadastrada aparecia com o
 * ícone genérico do site, e todos os avisos ficavam iguais — que é justamente o
 * contrário do que o avatar existe para resolver.
 *
 * SVG em data URI, e não canvas: são vinte linhas de texto contra um elemento
 * desenhado fora da tela, e o resultado é nítido em qualquer densidade.
 */
export function avatarComoImagem(nome: string, semente: string): string {
  const letras = iniciais(nome);
  const cor = corDoAvatar(semente);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" rx="48" fill="${cor}"/>` +
    `<text x="48" y="48" fill="#fff" font-family="system-ui,-apple-system,sans-serif"` +
    ` font-size="${letras.length > 1 ? 38 : 46}" font-weight="600"` +
    ` text-anchor="middle" dominant-baseline="central">${letras}</text>` +
    `</svg>`;

  // `encodeURIComponent` e nao base64: o SVG tem acento e aspas, e o caminho
  // curto (`btoa`) quebra em qualquer nome com cedilha.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
