import { isProd } from "@/infra/config/env";

/**
 * Log estruturado. Em producao sai como JSON de uma linha, que e o que os
 * coletores esperam; em desenvolvimento sai legivel.
 *
 * Nunca logar: token, senha, chave de API, numero de cartao.
 */

type Nivel = "debug" | "info" | "warn" | "error";
type Campos = Record<string, unknown>;

function emitir(nivel: Nivel, mensagem: string, campos?: Campos) {
  if (nivel === "debug" && isProd) return;

  const registro = { nivel, mensagem, ts: new Date().toISOString(), ...campos };
  const destino = nivel === "error" ? console.error : console.log;

  destino(isProd ? JSON.stringify(registro) : `[${nivel}] ${mensagem}`, campos ?? "");
}

export const logger = {
  debug: (m: string, c?: Campos) => emitir("debug", m, c),
  info: (m: string, c?: Campos) => emitir("info", m, c),
  warn: (m: string, c?: Campos) => emitir("warn", m, c),
  error: (m: string, c?: Campos) => emitir("error", m, c),
};
