import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarStatus, listarTickets } from "@/modules/tickets/tickets.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { listarServicos } from "@/modules/cadastros/cadastros.service";
import { SemEmpresa } from "../sem-empresa";
import { TicketsTabela } from "./tickets-tabela";

export default async function TicketsPage() {
  // A visao vem da sessao: e preferencia do usuario, uma so para todas as telas
  // com quadro. Lida no servidor para a tela ja nascer no modo escolhido, sem
  // abrir em tabela e saltar quando o JavaScript sobe.
  const { ctx, usuarioNome, visao } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  // Os cancelados vem na consulta e sao escondidos no cliente: quem decide e um
  // toggle de filtro, e ir ao servidor a cada clique dele nao paga o custo.
  const [{ itens }, colunas, pessoas, servicos] = await Promise.all([
    listarTickets(ctx.empresaId, { incluirCancelados: true }, { page: 1, perPage: 200 }),
    listarStatus(ctx.empresaId),
    arvoreDeClientes(ctx.empresaId),
    listarServicos(ctx.empresaId),
  ]);

  return (
    <TicketsTabela
      emitidoPor={usuarioNome ?? ""}
      modoInicial={visao}
      tickets={itens}
      colunas={colunas}
      clientes={pessoas}
      servicos={servicos
        .filter((s) => s.ativo)
        .map((s) => ({ id: s.id, descricao: s.descricao, valor: s.valor }))}
    />
  );
}
