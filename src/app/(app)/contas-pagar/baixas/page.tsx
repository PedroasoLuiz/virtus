import { sessaoUI } from "@/shared/auth/sessao-ui";
import {
  indicadoresDeBaixas,
  listarBaixas,
} from "@/modules/contas-pagar/contas-pagar.service";
import { hoje } from "@/shared/utils/datas";
import { SemEmpresa } from "../../sem-empresa";
import { BaixasTabela } from "./baixas-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 *
 * Espelho de /recebimentos: o que a empresa PAGOU, e nao o que ela deve. As
 * duas telas veem o mesmo assunto de lados opostos.
 */
export default async function BaixasAPagarPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * ⚠️ Os indicadores vem de consulta PROPRIA, e nao da lista acima.
   *
   * Somados sobre a pagina, os cartoes mediriam o recorte e nao o negocio: com
   * 171 baixas e 100 carregadas, os meses mais antigos apareceriam encolhendo e
   * a serie desenharia uma queda que nao existe.
   */
  const [{ itens }, indicadores] = await Promise.all([
    listarBaixas(ctx.empresaId, {}, { page: 1, perPage: 100 }),
    indicadoresDeBaixas(ctx.empresaId, hoje()),
  ]);

  return <BaixasTabela baixas={itens} indicadores={indicadores} />;
}
