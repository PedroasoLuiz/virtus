import { sessaoUI } from "@/shared/auth/sessao-ui";
import { alvosDoCliente } from "@/modules/insights/insights.service";
import { SemEmpresa } from "../sem-empresa";
import { InsightsTela } from "./insights-tela";

/**
 * Server Component: chama o SERVICO direto, sem passar por HTTP.
 *
 * ⚠️ So a lista de CLIENTES vem daqui. As metricas sao buscadas na Meta pelo
 * navegador, chamando a nossa rota: elas dependem do periodo escolhido, e
 * carrega-las no servidor prenderia a primeira pintura da tela a latencia de uma
 * API de fora — que, com conta de anuncio, Pagina e Instagram juntos, sao varias
 * idas.
 */
export default async function InsightsPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const alvos = await alvosDoCliente(ctx.empresaId);
  return <InsightsTela alvos={alvos} />;
}
