import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarRecebimentos } from "@/modules/recebimentos/recebimentos.service";
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
  const { itens } = await listarRecebimentos(ctx.empresaId, {}, { page: 1, perPage: 100 });

  return <RecebimentosTabela recebimentos={itens} />;
}
