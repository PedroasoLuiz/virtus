import { sessaoUI } from "@/shared/auth/sessao-ui";
import { resumoPorSituacao } from "@/modules/faturas/faturas.repository";
import { SemEmpresa } from "../sem-empresa";
import { Painel } from "./painel";

export default async function DashboardPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const linhas = await resumoPorSituacao(ctx.empresaId);
  return <Painel linhas={linhas} />;
}
