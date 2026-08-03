import { randomUUID } from "node:crypto";

/** Identificador de correlacao de uma requisicao. Aparece em todo log e em todo erro. */
export function novoRequestId(): string {
  return randomUUID();
}

/**
 * Chave de idempotencia derivada do conteudo. Usada quando o cliente nao envia
 * a sua propria: duas requisicoes identicas do mesmo usuario, no mesmo minuto,
 * geram a mesma chave e portanto o mesmo efeito.
 */
export async function chaveDeConteudo(partes: (string | number)[]): Promise<string> {
  const dados = new TextEncoder().encode(partes.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
