import { sessaoUI } from "@/shared/auth/sessao-ui";
import {
  indicadoresDeRecebimento,
  listarRecebimentos,
} from "@/modules/recebimentos/recebimentos.service";
import { hoje } from "@/shared/utils/datas";
import { SemEmpresa } from "../sem-empresa";
import { RecebimentosTabela } from "./recebimentos-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 * A rota /api/v1/recebimentos existe para consumidores externos, nao para a tela.
 */
export default async function RecebimentosPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * ⚠️ A pagina NAO carrega mais os clientes.
   *
   * Ela trazia a arvore inteira para preencher um `<select>`: numa base com
   * vinte mil clientes ativos, sao vinte mil linhas no HTML para escolher uma.
   * O drawer pergunta ao servidor conforme se digita.
   */
  /*
   * ⚠️ Os indicadores vem de consulta PROPRIA, e nao da lista acima.
   *
   * Somados sobre a pagina, os cartoes do topo mediriam o recorte e nao o
   * negocio: com 119 baixas e 100 carregadas, os meses mais antigos apareceriam
   * encolhendo e o grafico desenharia uma queda que nao existe.
   */
  const [{ itens }, indicadores] = await Promise.all([
    listarRecebimentos(ctx.empresaId, {}, { page: 1, perPage: 500 }),
    indicadoresDeRecebimento(ctx.empresaId, hoje()),
  ]);

  return <RecebimentosTabela recebimentos={itens} indicadores={indicadores} />;
}
