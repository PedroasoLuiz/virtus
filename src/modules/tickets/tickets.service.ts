import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import type { Paginacao, Pagina } from "@/shared/utils/paginacao";
import * as repo from "@/modules/tickets/tickets.repository";
import {
  ehDoFaturamento,
  type FiltroTickets,
  type StatusTicket,
  type Ticket,
  type TicketResumo,
} from "@/modules/tickets/tickets.types";

/** Regra de negocio de tickets. */

export async function listarTickets(
  empresaId: number,
  filtro: FiltroTickets,
  paginacao: Paginacao,
): Promise<Pagina<TicketResumo>> {
  const pagina = await repo.listar(empresaId, filtro, paginacao);

  if (!filtro.somenteFaturaveis) return pagina;

  // O filtro de faturavel e aplicado aqui e nao na query porque o saldo vem da
  // view, e nao da tabela consultada. Vale enquanto a pagina e de 200 linhas;
  // acima disso a listagem passa a partir da propria view.
  return { ...pagina, itens: pagina.itens.filter((t) => t.saldo > 0) };
}

export async function obterTicket(empresaId: number, id: number): Promise<Ticket> {
  const ticket = await repo.buscarPorId(empresaId, id);
  if (!ticket) throw new NotFoundError("Ticket nao encontrado");
  return ticket;
}

// ── Escrita ─────────────────────────────────────────────────────────────────

type ItemEntrada = {
  servicoId?: number | null;
  descricao?: string;
  data?: string | null;
  quantidade: number;
  unidade?: string;
  valorUnitario: number;
  desconto?: number;
  acrescimo?: number;
  despesas?: { descricao: string; valor: number }[];
};

/**
 * Total do item, em centavos.
 *
 * Calculado aqui e nunca aceito do cliente: e ele que forma o total do ticket,
 * que por sua vez limita quanto pode ser faturado. Confiar no numero que chega
 * pela rede seria deixar o teto de cobranca ser escolhido de fora.
 *
 * `Math.round` porque quantidade pode ser fracionaria (2,5 horas) e centavo nao
 * comporta fracao.
 */
function totalDoItem(i: ItemEntrada): number {
  const bruto = Math.round(i.quantidade * i.valorUnitario);
  const despesas = (i.despesas ?? []).reduce((s, d) => s + d.valor, 0);
  return Math.max(0, bruto - (i.desconto ?? 0) + (i.acrescimo ?? 0) + despesas);
}

function paraGravar(itens: ItemEntrada[]): repo.ItemParaGravar[] {
  return itens.map((i) => ({
    servicoId: i.servicoId ?? null,
    descricao: (i.descricao ?? "").trim(),
    data: i.data ?? null,
    quantidade: i.quantidade,
    unidade: i.unidade === "H" ? "H" : "UN",
    valorUnitario: i.valorUnitario,
    desconto: i.desconto ?? 0,
    acrescimo: i.acrescimo ?? 0,
    despesas: (i.despesas ?? []).map((d) => ({
      descricao: d.descricao.trim(),
      valor: d.valor,
    })),
    total: totalDoItem(i),
  }));
}

export async function criarTicket(
  empresaId: number,
  usuarioId: string | null,
  entrada: repo.CamposTicket & { itens?: ItemEntrada[] },
): Promise<Ticket> {
  const { itens, ...campos } = entrada;

  // Sem coluna informada, entra na primeira do quadro — nasce em "Orçamento".
  const statusId = campos.statusId ?? (await primeiraColuna(empresaId));

  const id = await repo.criar(empresaId, usuarioId, { ...campos, statusId });
  if (itens?.length) await repo.substituirItens(id, usuarioId, paraGravar(itens));

  return obterTicket(empresaId, id);
}

export async function atualizarTicket(
  empresaId: number,
  usuarioId: string | null,
  id: number,
  entrada: repo.CamposTicket & { itens?: ItemEntrada[] },
): Promise<Ticket> {
  const atual = await obterTicket(empresaId, id);
  const { itens, ...campos } = entrada;

  /*
   * Trava em dois degraus, pela mesma razao: registro financeiro fechado nao
   * pode mudar por baixo de quem ja recebeu o documento.
   *
   *   faturado > 0  -> o CLIENTE congela. A conta a receber ja foi emitida em
   *                    nome de alguem; trocar o cliente aqui deixaria a cobranca
   *                    apontando para uma pessoa e o ticket para outra.
   *
   *   ENCERRADA     -> congela TUDO. E o ponto final: faturado por inteiro e
   *                    recebido por inteiro. Depois disso qualquer alteracao so
   *                    pode gerar divergencia com o que ja foi pago.
   *
   * Vive aqui e nao so na tela porque a API tambem e caminho de escrita.
   */
  if (atual.statusChave === "ENCERRADA") {
    throw new BusinessRuleError(
      `O ticket ${id} esta encerrado — faturado e recebido por inteiro — e nao pode mais ser alterado.`,
    );
  }

  if (
    atual.faturado > 0 &&
    campos.clienteId !== undefined &&
    campos.clienteId !== atual.clienteId
  ) {
    throw new BusinessRuleError(
      "Este ticket ja tem conta a receber emitida. O cliente nao pode ser trocado.",
    );
  }

  // A coluna nao se muda por aqui: quem move o card e `moverTicket`, que sabe
  // barrar as colunas de faturamento. Dois caminhos para a mesma escrita
  // significaria uma regra valendo so em um deles.
  delete campos.statusId;

  if (itens !== undefined) {
    // Reduzir o orcamento abaixo do que ja virou cobranca deixaria o ticket
    // superfaturado — o mesmo que o gatilho `guarda_saldo_por_origem` barra do
    // outro lado. Aqui a checagem existe para dar mensagem, nao erro de banco.
    const novoTotal = paraGravar(itens).reduce((s, i) => s + i.total, 0);
    if (novoTotal < atual.faturado) {
      throw new BusinessRuleError(
        `O ticket ja tem ${reais(atual.faturado)} faturado. O total dos servicos nao pode ficar abaixo disso.`,
      );
    }
  }

  await repo.atualizar(empresaId, id, usuarioId, campos);
  if (itens !== undefined) await repo.substituirItens(id, usuarioId, paraGravar(itens));

  return obterTicket(empresaId, id);
}

async function primeiraColuna(empresaId: number): Promise<number | null> {
  const colunas = await repo.listarStatus(empresaId);
  return colunas.find((c) => c.ativo)?.id ?? null;
}

function reais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}

// ── Colunas do quadro ───────────────────────────────────────────────────────

/**
 * O quadro tem duas colunas fixas no comeco (Orcamento, Na fila) e duas no fim
 * (Parcialmente faturado, Encerrada). O que o usuario cria fica no meio, entre
 * os indices 3 e 899.
 *
 * As de indice alto sao ponta de faturamento: quem coloca o ticket la e o
 * gatilho do banco, quando a conta a receber e criada.
 */
const PRIMEIRO_INDICE_LIVRE = 10;
const ULTIMO_INDICE_LIVRE = 899;
const PASSO = 10;

export function listarStatus(empresaId: number): Promise<StatusTicket[]> {
  return repo.listarStatus(empresaId);
}

export async function criarStatus(
  empresaId: number,
  usuarioId: string | null,
  dados: { descricao: string; cor?: string },
): Promise<StatusTicket> {
  const existentes = await repo.listarStatus(empresaId);

  const duplicada = existentes.some(
    (s) => s.descricao.toLowerCase() === dados.descricao.trim().toLowerCase(),
  );
  if (duplicada) {
    throw new BusinessRuleError(`Ja existe uma coluna chamada "${dados.descricao}"`);
  }

  const indice = proximoIndice(existentes);

  return repo.criarStatus(empresaId, usuarioId, {
    descricao: dados.descricao.trim(),
    indice,
    cor: dados.cor ?? "neutral",
  });
}

/**
 * Proxima posicao livre no meio do quadro.
 *
 * Sai depois da ultima coluna do usuario, com folga de `PASSO` para caber
 * reordenacao futura sem renumerar a tabela inteira.
 */
function proximoIndice(existentes: StatusTicket[]): number {
  const doMeio = existentes.filter((s) => !s.sistema).map((s) => s.indice);
  const proximo = doMeio.length === 0 ? PRIMEIRO_INDICE_LIVRE : Math.max(...doMeio) + PASSO;

  if (proximo > ULTIMO_INDICE_LIVRE) {
    throw new BusinessRuleError(
      "Nao ha posicao livre entre 'Na fila' e 'Parcialmente faturado'. Remova ou reordene colunas.",
    );
  }
  return proximo;
}

export async function atualizarStatus(
  empresaId: number,
  id: number,
  dados: { descricao?: string; cor?: string; ativo?: boolean },
): Promise<StatusTicket> {
  const status = await exigirStatus(empresaId, id);

  // A coluna do sistema pode ser renomeada e recolorida — quem opera chama
  // "Encerrada" do jeito que quiser. Desativar, nao: o gatilho de faturamento
  // precisa de um destino para colocar o ticket.
  if (status.sistema && dados.ativo === false) {
    throw new BusinessRuleError(
      `"${status.descricao}" e uma coluna do sistema e nao pode ser desativada.`,
    );
  }

  return repo.atualizarStatus(empresaId, id, dados);
}

export async function excluirStatus(empresaId: number, id: number): Promise<void> {
  const status = await exigirStatus(empresaId, id);

  if (status.sistema) {
    throw new BusinessRuleError(
      `"${status.descricao}" e uma coluna do sistema e nao pode ser excluida.`,
    );
  }

  // Excluir levaria os tickets para `fkStatus` nulo — sumiriam do quadro sem
  // aviso. Quem quiser esvaziar, move os cards primeiro.
  const ocupada = await repo.contarTicketsNoStatus(empresaId, id);
  if (ocupada > 0) {
    throw new BusinessRuleError(
      `"${status.descricao}" tem ${ocupada} ticket(s). Mova-os antes de excluir a coluna.`,
    );
  }

  await repo.excluirStatus(empresaId, id);
}

/**
 * Move o ticket de coluna.
 *
 * As duas colunas de faturamento sao consequencia do dinheiro, nao decisao de
 * quem opera: arrastar um ticket para "Encerrada" sem faturar diria que ele foi
 * cobrado. Entrar e sair delas so acontece pelo gatilho.
 */
export async function moverTicket(
  empresaId: number,
  ticketId: number,
  statusId: number,
): Promise<Ticket> {
  const [ticket, destino] = await Promise.all([
    obterTicket(empresaId, ticketId),
    exigirStatus(empresaId, statusId),
  ]);

  if (ehDoFaturamento(destino.chave)) {
    throw new BusinessRuleError(
      `"${destino.descricao}" e definida pelo faturamento: gere a conta a receber para o ticket chegar la.`,
    );
  }

  if (ehDoFaturamento(ticket.statusChave)) {
    throw new BusinessRuleError(
      `O ticket ${ticketId} ja foi faturado e sai de "${ticket.status}" apenas se a cobranca for desfeita.`,
    );
  }

  if (!destino.ativo) {
    throw new BusinessRuleError(`A coluna "${destino.descricao}" esta inativa.`);
  }

  /*
   * Sair do orcamento exige ao menos um servico.
   *
   * "Na fila" quer dizer trabalho aprovado esperando execucao — sem servico
   * lancado nao ha o que executar nem o que faturar depois, e o ticket entraria
   * na operacao como uma linha vazia que ninguem sabe o que e.
   *
   * A checagem e por SAIR do orcamento, nao por entrar em "Na fila": vale
   * igual para qualquer coluna que o usuario crie depois dela.
   */
  if (ticket.statusChave === "ORCAMENTO" && destino.chave !== "ORCAMENTO" && ticket.itens.length === 0) {
    throw new BusinessRuleError(
      "Lance ao menos um serviço antes de tirar o ticket do orçamento.",
    );
  }

  await repo.moverTicket(empresaId, ticketId, statusId);
  return obterTicket(empresaId, ticketId);
}

async function exigirStatus(empresaId: number, id: number): Promise<StatusTicket> {
  const status = await repo.buscarStatus(empresaId, id);
  if (!status) throw new NotFoundError("Coluna nao encontrada");
  return status;
}
