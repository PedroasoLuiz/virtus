/**
 * Nome do cookie de preferencia de interface.
 *
 * Modulo sem `"use client"` de proposito: o layout e Server Component e precisa
 * desta constante. Importar um valor de um modulo marcado como cliente nao
 * funciona — o Next substitui o modulo por uma referencia de cliente e a
 * constante chega indefinida no servidor.
 */
export const COOKIE_SIDEBAR = "vpay_sidebar";

/**
 * Modo de exibicao por tela: `tabela` ou `kanban`.
 *
 * Cookie e nao `localStorage` porque a preferencia precisa ser lida NO
 * SERVIDOR: a pagina ja renderiza no modo certo, sem o piscar de abrir em
 * tabela e trocar para kanban depois que o JavaScript sobe.
 *
 * Um cookie por tela — o kanban de tickets e o de outra tela nao sao a mesma
 * escolha.
 */
export function cookieDaVisao(tela: string): string {
  return `vpay_visao_${tela}`;
}
