import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarContratos } from "@/modules/contratos/contratos.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { SemEmpresa } from "../sem-empresa";
import { ContratosTela } from "./contratos-tela";

export default async function ContratosPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  // Inativos vêm na consulta: a lista é curta e o histórico do que já venceu
  // continua sendo consultado.
  const [contratos, clientes] = await Promise.all([
    listarContratos(ctx.empresaId, true),
    arvoreDeClientes(ctx.empresaId),
  ]);

  return (
    <ContratosTela
      contratos={contratos}
      clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
    />
  );
}
