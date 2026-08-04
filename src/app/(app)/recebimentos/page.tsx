import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarRecebimentos } from "@/modules/recebimentos/recebimentos.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { SemEmpresa } from "../sem-empresa";
import { RecebimentosTabela } from "./recebimentos-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 * A rota /api/v1/recebimentos existe para consumidores externos, nao para a tela.
 */
export default async function RecebimentosPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const [{ itens }, clientes] = await Promise.all([
    listarRecebimentos(ctx.empresaId, {}, { page: 1, perPage: 100 }),
    arvoreDeClientes(ctx.empresaId),
  ]);

  return (
    <RecebimentosTabela
      recebimentos={itens}
      clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
    />
  );
}
