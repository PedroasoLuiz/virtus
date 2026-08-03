import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarCentros, listarServicos } from "@/modules/cadastros/cadastros.service";
import { SemEmpresa } from "../sem-empresa";
import { ServicosTela } from "./servicos-tela";

export default async function ServicosPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  // Os centros alimentam o select do formulario — buscar junto evita um
  // segundo carregamento so quando o drawer abre.
  const [servicos, centros] = await Promise.all([
    listarServicos(ctx.empresaId),
    listarCentros(ctx.empresaId),
  ]);

  return <ServicosTela servicos={servicos} centros={centros} />;
}
