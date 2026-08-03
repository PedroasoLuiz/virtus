import type { Contexto } from "@/shared/auth/contexto";

/**
 * Contexto minimo para quando o Supabase nao esta configurado.
 *
 * A topbar mostra um selo de aviso sempre que este caminho e usado — nunca e
 * fallback silencioso. As listagens NAO tem dados falsos: sem banco, elas ficam
 * vazias, que e a verdade.
 */
export const CONTEXTO_DEMO: Contexto = {
  usuarioId: "demo",
  email: "demo@virtus.com.br",
  empresaId: null,
  modulos: ["financeiro"],
};
