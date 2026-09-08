import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarContas } from "@/modules/contas-pagar/contas-pagar.service";
import { SemEmpresa } from "../sem-empresa";
import { ContasTabela } from "./contas-tabela";

export default async function ContasPagarPage() {
  const { ctx, visao } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * ⚠️ O teto era 200, e a empresa passou de 207.
   *
   * A tela filtra e pagina no NAVEGADOR, entao o que nao vem na carga nao existe
   * para ela: a conta 206 sumia da lista e da busca sem nenhum aviso, e quem
   * procurava concluia que ela nao tinha sido lancada. Era truncamento em
   * silencio, que e a pior forma de perder dado.
   *
   * 500 nao e a solucao definitiva — busca e paginacao no servidor sao. Ate la,
   * o `total` desce junto e a tabela avisa quando o corte acontecer, para que da
   * proxima vez a tela diga o que esta escondendo em vez de mentir.
   */
  const { itens, total } = await listarContas(
    ctx.empresaId,
    {},
    { page: 1, perPage: 500 },
  );

  return <ContasTabela contas={itens} totalNoBanco={total} visaoInicial={visao} />;
}
