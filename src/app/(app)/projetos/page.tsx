import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarProjetos } from "@/modules/projetos/projetos.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { SemEmpresa } from "../sem-empresa";
import { ProjetosTela } from "./projetos-tela";

export default async function ProjetosPage() {
  // A visao vem da sessao: preferencia do usuario, uma so para todas as telas
  // com quadro, lida no servidor para a tela nascer no modo certo.
  const { ctx, visao } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  // Encerrados vêm na consulta e são escondidos no cliente: o toggle do filtro
  // não paga uma ida ao servidor.
  const [projetos, clientes] = await Promise.all([
    listarProjetos(ctx.empresaId, { incluirEncerrados: true }),
    arvoreDeClientes(ctx.empresaId),
  ]);

  return (
    <ProjetosTela
      projetos={projetos}
      clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
      modoInicial={visao}
    />
  );
}
