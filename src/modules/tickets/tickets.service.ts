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

    if (atual.faturado > 0) checaComposicaoCongelada(atual, itens);
  }

  await repo.atualizar(empresaId, id, usuarioId, campos);
  if (itens !== undefined) await repo.substituirItens(id, usuarioId, paraGravar(itens));

  return obterTicket(empresaId, id);
}

/**
 * A COMPOSICAO do ticket faturado nao muda mais — so o texto.
 *
 * ⚠️ Nao bastava barrar o total para baixo.
 *
 * O ticket 158, de R$ 200, ja virou conta a receber. Sem esta regra dava para
 * trocar o servico dele por outro — de outro centro de custo, de outro preco —
 * mantendo o mesmo total: a conta continuava fechando, e o rateio contabil
 * passava a apontar para uma categoria que nunca foi cobrada. A operacao do
 * outro lado pode ate ja estar encerrada, e ninguem seria avisado.
 *
 * O que fica LIVRE e a descricao: ela nao entra em nenhuma conta, e e onde se
 * corrige um nome errado no documento sem mexer no que foi cobrado.
 *
 * ⚠️ E o numero de itens tambem congela: acrescentar servico depois de faturado
 * criaria saldo a faturar num ticket que ja fechou, e o modelo cobra o ticket
 * por inteiro. Servico novo e ticket novo.
 *
 * Vive no servico e nao so na tela porque a API tambem e caminho de escrita.
 */
function checaComposicaoCongelada(atual: Ticket, itens: ItemEntrada[]): void {
  if (itens.length !== atual.itens.length) {
    throw new BusinessRuleError(
      itens.length > atual.itens.length
        ? "Este ticket ja foi faturado. Servico novo entra num ticket novo."
        : "Este ticket ja foi faturado. Os servicos dele nao podem mais ser removidos.",
    );
  }

  const gravaveis = paraGravar(itens);

  for (const [i, novo] of gravaveis.entries()) {
    const antigo = atual.itens[i];

    /* Despesas entram na assinatura: elas somam no total do item, e trocar uma
       de 50 por outra de 50 mudaria o que a nota discrimina. */
    const assinatura = (x: {
      servicoId: number | null;
      quantidade: number;
      unidade: string;
      valorUnitario: number;
      desconto: number;
      acrescimo: number;
      despesas: { descricao: string; valor: number }[];
    }) =>
      JSON.stringify([
        x.servicoId,
        x.quantidade,
        x.unidade,
        x.valorUnitario,
        x.desconto,
        x.acrescimo,
        x.despesas.map((d) => [d.descricao, d.valor]),
      ]);

    if (assinatura(novo) !== assinatura(antigo)) {
      throw new BusinessRuleError(
        `Este ticket ja tem ${reais(atual.faturado)} faturado. Servico, valores e despesas nao mudam mais; so a descricao.`,
      );
    }
  }
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

/**
 * Liga o ticket a uma obra — e so isso.
 *
 * ⚠️ Passa por cima da trava de ticket ENCERRADO, de proposito. `atualizarTicket`
 * congela tudo depois que o ticket foi faturado e recebido, porque qualquer
 * mudanca ali diverge do que o cliente ja pagou. A obra nao entra nessa conta:
 * ela nao muda valor, cliente nem servico, nao aparece em documento emitido e
 * nao vai para a DRE — ela diz a que trabalho aquele lancamento pertence.
 *
 * E e exatamente o ticket velho que precisa disso. Tickets fechados antes de
 * existirem projetos ficariam sem obra para sempre, e o relatorio por obra
 * nasceria com um buraco que ninguem poderia tapar.
 *
 * ⚠️ A obra tem que ser do MESMO cliente do ticket. A RLS barra a obra de outra
 * empresa, mas nao sabe nada sobre cliente: sem esta checagem daria para pendurar
 * o ticket da OCB numa obra da Federal e o relatorio de cada uma mentiria.
 */
export async function definirProjetoDoTicket(
  empresaId: number,
  id: number,
  projetoId: number | null,
): Promise<Ticket> {
  const ticket = await obterTicket(empresaId, id);

  if (projetoId != null) {
    const dono = await repo.clienteDoProjeto(empresaId, projetoId);

    if (dono == null) {
      throw new NotFoundError(`Projeto ${projetoId} nao encontrado.`);
    }
    if (ticket.clienteId != null && dono !== ticket.clienteId) {
      throw new BusinessRuleError(
        "Este projeto e de outro cliente. O ticket so pode ser ligado a um projeto do proprio cliente.",
      );
    }
  }

  await repo.definirProjetoDoTicket(id, projetoId);
  return obterTicket(empresaId, id);
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

/**
 * Cancela o ticket, ou desfaz o cancelamento.
 *
 * ⚠️ Recusa quando alguma conta a receber deste ticket ja tem baixa.
 *
 * Cancelar solta as origens: as tarefas voltam a poder ser cobradas e o vinculo
 * com o projeto sai. Com dinheiro ja recebido, isso deixaria um pagamento
 * apontando para uma cobranca que o sistema passou a dizer que nao existe — e a
 * mesma entrega poderia ser cobrada de novo. Estorna-se o recebimento primeiro.
 *
 * ⚠️ Faturado sem baixa CANCELA. A conta gerada continua la e a decisao sobre
 * ela e de quem cuida do financeiro; o gatilho so devolve o saldo da origem.
 */
export async function cancelarTicket(
  empresaId: number,
  usuarioId: string | null,
  id: number,
  cancelada = true,
): Promise<Ticket> {
  const ticket = await obterTicket(empresaId, id);

  if (ticket.cancelada === cancelada) return ticket; // idempotente

  if (cancelada && ticket.faturas.some((f) => f.pago > 0)) {
    throw new BusinessRuleError(
      "Este ticket ja tem recebimento na conta a receber. Estorne a baixa antes de cancelar.",
    );
  }

  await repo.definirCancelada(empresaId, id, cancelada, usuarioId);
  return obterTicket(empresaId, id);
}

/**
 * Apaga o ticket.
 *
 * ⚠️ Recusa quando ele ja gerou conta a receber, mesmo sem baixa.
 *
 * A conta guarda o valor que saiu daqui; sumindo o ticket, ninguem mais sabe
 * dizer de onde aquele numero veio, e a composicao da conta fica apontando para
 * um registro que nao existe. Ticket que ja virou cobranca se CANCELA — ele
 * continua na tela, e a memoria fica.
 */
export async function excluirTicket(empresaId: number, id: number): Promise<void> {
  const ticket = await obterTicket(empresaId, id);

  if (ticket.faturas.length > 0) {
    throw new BusinessRuleError(
      `Este ticket ja gerou a conta a receber ${ticket.faturas
        .map((f) => f.numero)
        .join(", ")}. Cancele em vez de excluir.`,
    );
  }

  await repo.excluirTicket(empresaId, id);
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
