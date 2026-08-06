"use client";

import { useState } from "react";

/**
 * A bolinha com a foto ou as iniciais.
 *
 * ⚠️ A cor sai do TELEFONE, e nao do nome. Contato sem nome mudaria de cor
 * assim que alguem o cadastrasse, e a cor e justamente o que faz reconhecer a
 * mesma pessoa na lista sem ler.
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
function corDoAvatar(semente: string): string {
  let soma = 0;
  for (let i = 0; i < semente.length; i++) soma = (soma + semente.charCodeAt(i)) % 997;
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}
function iniciais(nome: string): string {
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
