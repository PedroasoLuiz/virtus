import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarFaturas } from "@/modules/faturas/faturas.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { SemEmpresa } from "../sem-empresa";
import { FaturasTabela } from "./faturas-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 * A rota /api/v1/faturas existe para consumidores externos, nao para a tela.
 */
export default async function FaturasPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const [{ itens }, clientes] = await Promise.all([
    listarFaturas(ctx.empresaId, {}, { page: 1, perPage: 100 }),
    arvoreDeClientes(ctx.empresaId),
  ]);

  return (
    <FaturasTabela
      faturas={itens}
      clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
    />
  );
}
