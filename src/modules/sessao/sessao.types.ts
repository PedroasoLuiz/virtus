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
  /** URL publica da foto. Ausente onde o caminho nao consulta o perfil. */
  foto?: string | null;
  /**
   * Endereco novo esperando confirmacao, quando ha uma troca em curso.
   *
   * ⚠️ Vem do Auth, e nao de `usuarios`: enquanto os dois links nao forem
   * abertos, o e-mail da conta continua sendo o antigo.
   */
  emailPendente?: string | null;
  nascimento?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  pronome?: string | null;
  funcao?: string | null;
  /**
   * Pessoa do CLIENTE, nao da casa. Vai para o portal, nao para o sistema.
   *
   * Opcional porque nem todo caminho que monta este tipo consulta o perfil; na
   * duvida vale `false`, que e o mais restritivo — manda para o app, onde a RLS
   * nao devolve nada a um externo.
   */
  externo?: boolean;
  /**
   * Ve as areas ainda EM DESENVOLVIMENTO: Suprimentos, Estoque, Social,
   * Plataforma e os Favoritos.
   *
   * Opcional pela mesma razao de `externo`, e com o mesmo padrao restritivo: nem
   * todo caminho que monta este tipo consulta o perfil, e na duvida a area em
   * obra fica escondida.
   */
  interno?: boolean;
};

/**
 * Resultado do login. O servico decide o proximo passo em vez de deixar a UI
 * adivinhar: com uma empresa so nao faz sentido pedir escolha.
 */
export type ResultadoLogin =
  | { proximo: "app"; usuario: UsuarioAutenticado; empresaId: number }
  | { proximo: "escolher-empresa"; usuario: UsuarioAutenticado; empresas: EmpresaDoUsuario[] }
  /** Pessoa do cliente: vai para o portal, sem escolher empresa nenhuma. */
  | { proximo: "portal"; usuario: UsuarioAutenticado };
