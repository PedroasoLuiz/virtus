import { cookies } from "next/headers";
import { cookieDaVisao } from "@/components/layout/cookies";
import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarProjetos } from "@/modules/projetos/projetos.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { SemEmpresa } from "../sem-empresa";
import { ProjetosTela } from "./projetos-tela";

export default async function ProjetosPage() {
  const { ctx } = await sessaoUI();
  const modoInicial = (await cookies()).get(cookieDaVisao("projetos"))?.value === "kanban" ? "kanban" : "tabela";
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
      modoInicial={modoInicial}
    />
  );
}
