import { sessaoUI } from "@/shared/auth/sessao-ui";
import {
  listarAcessos,
  listarConexoes,
  listarPaginas,
} from "@/modules/insights/insights.service";
import { SemEmpresa } from "../sem-empresa";
import { ConfiguracoesTela } from "./configuracoes-tela";

/**
 * As integracoes da empresa, num lugar so.
 *
 * ⚠️ Configurar e VER sao telas diferentes, e essa separacao e o motivo desta
 * pagina existir. O Insights mostra numero para quem vai conversar com o
 * cliente; ligar conta e mexer em credencial e trabalho de quem administra, e
 * misturar os dois punha um botao de token no meio de um painel de apresentacao.
 */
export default async function ConfiguracoesPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * ⚠️ As duas listas em PARALELO. Elas nao dependem uma da outra, e em serie a
   * pagina esperaria a soma das duas idas ao banco sem ganhar nada.
   */
  const [acessos, conexoes, paginas] = await Promise.all([
    listarAcessos(ctx.empresaId),
    listarConexoes(ctx.empresaId),
    listarPaginas(ctx.empresaId),
  ]);

  return (
    <ConfiguracoesTela acessos={acessos} conexoes={conexoes} paginas={paginas} />
  );
}
