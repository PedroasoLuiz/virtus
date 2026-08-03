import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarContas } from "@/modules/contas-pagar/contas-pagar.service";
import { SemEmpresa } from "../sem-empresa";
import { ContasTabela } from "./contas-tabela";

export default async function ContasPagarPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const { itens } = await listarContas(ctx.empresaId, {}, { page: 1, perPage: 200 });
  return <ContasTabela contas={itens} />;
}
