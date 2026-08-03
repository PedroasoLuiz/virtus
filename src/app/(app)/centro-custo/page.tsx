import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarCentros } from "@/modules/cadastros/cadastros.service";
import { SemEmpresa } from "../sem-empresa";
import { CentroCustoTela } from "./centro-tela";

export default async function CentroCustoPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const centros = await listarCentros(ctx.empresaId);
  return <CentroCustoTela centros={centros} />;
}
