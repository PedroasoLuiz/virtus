import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarClientes } from "@/modules/clientes/clientes.service";
import { listarCentros } from "@/modules/cadastros/cadastros.service";
import { SemEmpresa } from "../sem-empresa";
import { PessoasTabela } from "./pessoas-tabela";

export default async function PessoasPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const [{ itens }, centros] = await Promise.all([
    listarClientes(ctx.empresaId, {}, { page: 1, perPage: 200 }),
    listarCentros(ctx.empresaId),
  ]);

  // So os de RECEITA: cliente e origem de entrada, e oferecer um centro de
  // despesa aqui jogaria receita na coluna errada do DRE.
  const doCliente = centros
    .filter((c) => c.ativo && c.tipo === "RECEITA")
    .map((c) => ({ id: c.id, descricao: c.descricao }));

  return <PessoasTabela pessoas={itens} centros={doCliente} />;
}
