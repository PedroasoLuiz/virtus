import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarContas } from "@/modules/contas/contas.service";
import { dadosDaEmpresa } from "@/modules/empresa/empresa.repository";
import { SemEmpresa } from "../sem-empresa";
import { ContasTabela } from "./contas-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 * A rota /api/v1/contas existe para consumidores externos, nao para a tela.
 */
export default async function ContasPage() {
  const { ctx, usuarioNome } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  // O emitente e os dados da empresa vao junto porque o extrato imprime: o PDF
  // e montado no navegador, e o cabecalho do documento nao pode depender de uma
  // segunda ida ao servidor no meio do clique de imprimir.
  const [contas, empresa] = await Promise.all([
    listarContas(ctx.empresaId),
    dadosDaEmpresa(ctx.empresaId),
  ]);

  return <ContasTabela contas={contas} empresa={empresa} emitidoPor={usuarioNome ?? ""} />;
}
