/** Contratos de dominio do modulo de sessao. */

export type EmpresaDoUsuario = {
  id: number;
  nome: string;
  razaoSocial: string | null;
  logo: string | null;
};

export type UsuarioAutenticado = {
  id: string;
  email: string;
  nome: string | null;
};

/**
 * Resultado do login. O servico decide o proximo passo em vez de deixar a UI
 * adivinhar: com uma empresa so nao faz sentido pedir escolha.
 */
export type ResultadoLogin =
  | { proximo: "app"; usuario: UsuarioAutenticado; empresaId: number }
  | { proximo: "escolher-empresa"; usuario: UsuarioAutenticado; empresas: EmpresaDoUsuario[] };
