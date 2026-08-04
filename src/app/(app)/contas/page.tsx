import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarContas } from "@/modules/contas/contas.service";
import { SemEmpresa } from "../sem-empresa";
import { ContasTabela } from "./contas-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 * A rota /api/v1/contas existe para consumidores externos, nao para a tela.
 */
export default async function ContasPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  return <ContasTabela contas={await listarContas(ctx.empresaId)} />;
}
