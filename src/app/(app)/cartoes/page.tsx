import { sessaoUI } from "@/shared/auth/sessao-ui";
import { cartoesDaEmpresa } from "@/modules/contas-pagar/contas-pagar.service";
import { SemEmpresa } from "../sem-empresa";
import { CartoesTabela } from "./cartoes-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 *
 * ⚠️ O servico e o de CONTAS A PAGAR, e nao um modulo de cartoes. O cartao e
 * forma de baixa: a fatura nasce quando alguem paga uma conta com ele, e fechar
 * a fatura gera outra conta a pagar. Um modulo proprio precisaria chamar o de
 * contas a pagar para as duas pontas.
 */
export default async function CartoesPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * So os CARTOES aqui. As faturas vem pelo drawer, quando alguem clica na
   * linha: carregar todas de todos os cartoes na abertura seria trazer o
   * historico inteiro para mostrar, na maioria das vezes, nenhum.
   */
  const cartoes = await cartoesDaEmpresa(ctx.empresaId);
  return <CartoesTabela cartoes={cartoes} />;
}
