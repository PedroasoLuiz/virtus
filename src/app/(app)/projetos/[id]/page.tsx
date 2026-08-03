import { notFound } from "next/navigation";
import { sessaoUI } from "@/shared/auth/sessao-ui";
import { obterProjeto } from "@/modules/projetos/projetos.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { listarUsuarios } from "@/modules/projetos/projetos.repository";
import { NotFoundError } from "@/shared/errors/app-error";
import { SemEmpresa } from "../../sem-empresa";
import { ProjetoTela } from "./projeto-tela";

/**
 * Subpagina do projeto — Server Component.
 *
 * Carrega aqui e nao por `fetch` no cliente: a pagina ja chega desenhada, e o
 * quadro nao pisca esqueleto antes de aparecer.
 */
export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  // O `try` fica em volta da BUSCA, nao do JSX: envolver a arvore faria o
  // `catch` engolir erro de render, e um `notFound()` disparado la dentro
  // viraria pagina 404 por causa de um bug de componente.
  const dados = await carregar(ctx.empresaId, numero);
  if (!dados) notFound();

  return (
    <ProjetoTela
      projeto={dados.projeto}
      clientes={dados.clientes}
      responsaveis={dados.responsaveis}
    />
  );
}

/**
 * Devolve `null` quando o projeto nao existe PARA ESTE USUARIO.
 *
 * Projeto de outra empresa volta como "nao encontrado" pela RLS, e 404 e a
 * resposta honesta: "sem permissao" ja confirmaria que ele existe.
 */
async function carregar(empresaId: number, id: number) {
  try {
    const [projeto, clientes, responsaveis] = await Promise.all([
      obterProjeto(empresaId, id),
      arvoreDeClientes(empresaId),
      listarUsuarios(),
    ]);

    return {
      projeto,
      clientes: clientes.map((c) => ({ id: c.id, nome: c.nome })),
      responsaveis,
    };
  } catch (erro) {
    if (erro instanceof NotFoundError) return null;
    throw erro;
  }
}
