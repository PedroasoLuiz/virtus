import { redirect } from "next/navigation";

/**
 * Raiz do site.
 *
 * O caminho raiz e autenticacao, nao aplicacao: quem chega em "/" sem sessao
 * cai no login (o middleware resolve isso antes de chegar aqui) e quem tem
 * sessao vai para o dashboard. Manter o dashboard em "/" misturava a home
 * publica com a tela interna.
 */
export default function RaizPage() {
  redirect("/dashboard");
}
