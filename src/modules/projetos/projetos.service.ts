import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/shared/errors/app-error";
import type { Centavos } from "@/shared/utils/money";
import type { ContratoDoProjeto, TicketDisponivel } from "@/modules/projetos/projetos.types";
import * as repo from "@/modules/projetos/projetos.repository";
import type {
  FiltroProjetos,
  Projeto,
  ProjetoNovo,
  ProjetoResumo,
} from "@/modules/projetos/projetos.types";

/** Regra de negocio de projetos. */

export function listarProjetos(
  empresaId: number,
  filtro: FiltroProjetos,
): Promise<ProjetoResumo[]> {
  return repo.listar(empresaId, filtro);
}

export async function obterProjeto(empresaId: number, id: number): Promise<Projeto> {
  const projeto = await repo.buscarPorId(empresaId, id);
  if (!projeto) throw new NotFoundError("Projeto nao encontrado");
  return projeto;
}

export async function criarProjeto(
  empresaId: number,
  usuarioId: string | null,
  entrada: ProjetoNovo,
): Promise<Projeto> {
  const id = await repo.criar(empresaId, usuarioId, entrada);
  // O quadro nasce junto, pelo gatilho `semeia_quadro_do_projeto`.
  return obterProjeto(empresaId, id);
}

export async function atualizarProjeto(
  empresaId: number,
  usuarioId: string | null,
  id: number,
  entrada: Partial<ProjetoNovo> & { ativo?: boolean; cancelado?: boolean },
): Promise<Projeto> {
  const atual = await obterProjeto(empresaId, id);

  /*
   * A modalidade congela depois que o dinheiro entrou.
   *
   * Ir de FECHADO para POR_DEMANDA deixaria um ticket com o valor cheio e
   * demandas que passariam a gerar tickets proprios — o projeto cobraria duas
   * vezes. O caminho inverso e igualmente ruim: os tickets ja gerados por
   * demanda ficariam orfaos de um projeto que agora diz ter valor unico.
   */
  if (
    entrada.modalidade !== undefined &&
    entrada.modalidade !== atual.modalidade &&
    (atual.tickets.length > 0 || atual.demandas.some((d) => d.ticketId != null))
  ) {
    throw new BusinessRuleError(
      "Este projeto ja gerou ticket. A modalidade nao pode mais ser trocada.",
    );
  }

  await repo.atualizar(empresaId, id, usuarioId, entrada);
  return obterProjeto(empresaId, id);
}

// ── Demandas ────────────────────────────────────────────────────────────────

export async function criarDemanda(
  empresaId: number,
  usuarioId: string | null,
  projetoId: number,
  entrada: {
    titulo: string;
    descricao?: string | null;
    colunaId?: number | null;
    responsavelId?: string | null;
    inicio?: string | null;
    prazo?: string | null;
  },
): Promise<Projeto> {
  const projeto = await obterProjeto(empresaId, projetoId);

  // Sem coluna informada, entra na primeira do quadro — o backlog.
  const colunaId = entrada.colunaId ?? projeto.colunas.find((c) => c.ativo)?.id ?? null;

  await repo.criarDemanda(projetoId, usuarioId, { ...entrada, colunaId });
  return obterProjeto(empresaId, projetoId);
}

export async function atualizarDemanda(
  empresaId: number,
  usuarioId: string | null,
  demandaId: number,
  entrada: {
    titulo?: string;
    descricao?: string | null;
    colunaId?: number | null;
    responsavelId?: string | null;
    inicio?: string | null;
    prazo?: string | null;
    valor?: number;
    concluida?: boolean;
  },
): Promise<Projeto> {
  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);

  /*
   * Valor de tarefa ja cobrada nao muda mais.
   *
   * O ticket copiou o numero no momento da geracao — mexer aqui depois nao o
   * corrige, so faz a tarefa dizer um valor e a cobranca outro, sem nada na tela
   * denunciando a diferenca. Reajuste de verdade se faz no ticket.
   */
  if (entrada.concluida === false) {
    const projeto = await obterProjeto(empresaId, projetoId);
    const tarefa = projeto.demandas.find((d) => d.id === demandaId);

    // Desmarcar uma tarefa ja cobrada faria o ticket referenciar uma entrega que
    // o projeto passou a dizer que nao aconteceu.
    if (tarefa?.ticketId != null) {
      throw new BusinessRuleError(
        `Esta tarefa foi cobrada no ticket ${tarefa.ticketId}. Remova a cobranca antes de reabri-la.`,
      );
    }
  }

  if (entrada.valor !== undefined) {
    const projeto = await obterProjeto(empresaId, projetoId);
    const tarefa = projeto.demandas.find((d) => d.id === demandaId);

    if (tarefa?.ticketId != null) {
      throw new BusinessRuleError(
        `Esta tarefa ja foi cobrada no ticket ${tarefa.ticketId}. Ajuste o valor por la.`,
      );
    }
  }

  await repo.atualizarDemanda(demandaId, usuarioId, entrada);
  return obterProjeto(empresaId, projetoId);
}

/**
 * Apaga o projeto inteiro — colunas, tarefas, checklist, comentarios e anexos.
 *
 * ⚠️ Projeto com ticket nao some. O ticket ficaria vivo, cobravel, apontando
 * para uma origem que deixou de existir: ninguem mais saberia dizer de onde
 * aquele valor veio. Desvincular e um gesto proprio, para que apagar por engano
 * exija ter olhado cada cobranca antes.
 */
export async function excluirProjeto(empresaId: number, projetoId: number): Promise<void> {
  const projeto = await obterProjeto(empresaId, projetoId);

  if (projeto.tickets.length > 0) {
    const numeros = projeto.tickets.map((t) => t.numero).join(", ");
    throw new BusinessRuleError(
      projeto.tickets.length === 1
        ? `Este projeto gerou o ticket ${numeros}. Remova o vinculo antes de excluir.`
        : `Este projeto gerou os tickets ${numeros}. Remova os vinculos antes de excluir.`,
    );
  }

  await repo.excluirProjeto(empresaId, projetoId);
}

// ── Contratos ───────────────────────────────────────────────────────────────

/** Os contratos que ainda podem cobrir este projeto. */
export async function contratosDisponiveis(
  empresaId: number,
  projetoId: number,
): Promise<ContratoDoProjeto[]> {
  const projeto = await obterProjeto(empresaId, projetoId);
  return repo.contratosDisponiveis(empresaId, projetoId, projeto.clienteId);
}

export async function vincularContrato(
  empresaId: number,
  usuarioId: string | null,
  projetoId: number,
  contratoId: number,
): Promise<Projeto> {
  const disponiveis = await contratosDisponiveis(empresaId, projetoId);

  if (!disponiveis.some((c) => c.id === contratoId)) {
    throw new BusinessRuleError(
      "Este contrato nao pode ser vinculado: ou ja esta no projeto, ou esta inativo, ou e de outro cliente.",
    );
  }

  await repo.vincularContrato(projetoId, contratoId, usuarioId);
  return obterProjeto(empresaId, projetoId);
}

/**
 * Solta o contrato do projeto.
 *
 * ⚠️ Nao recusa quando ha ticket: o contrato justifica a cobranca no momento em
 * que ela nasce, e o ticket ja gerado guarda o proprio valor. Travar aqui
 * impediria corrigir um vinculo errado sem antes desfazer a cobranca certa.
 */
export async function desvincularContrato(
  empresaId: number,
  projetoId: number,
  contratoId: number,
): Promise<Projeto> {
  const projeto = await obterProjeto(empresaId, projetoId);

  if (!projeto.contratos.some((c) => c.id === contratoId)) {
    throw new BusinessRuleError("Este contrato nao esta vinculado ao projeto.");
  }

  await repo.desvincularContrato(projetoId, contratoId);
  return obterProjeto(empresaId, projetoId);
}

/** Os tickets que podem ser vinculados a este projeto. */
export async function ticketsDisponiveis(
  empresaId: number,
  projetoId: number,
): Promise<TicketDisponivel[]> {
  const projeto = await obterProjeto(empresaId, projetoId);
  const livres = await repo.ticketsDisponiveis(empresaId);

  /*
   * Com cliente no projeto, so os tickets DELE aparecem — e os sem cliente, que
   * ainda podem ser atribuidos.
   *
   * Filtrar aqui e nao so recusar no clique: a lista completa da empresa faria
   * procurar o ticket certo no meio de dezenas que nunca poderiam entrar.
   */
  if (projeto.clienteId == null) return livres;
  return livres.filter((t) => t.clienteId == null || t.clienteId === projeto.clienteId);
}

/**
 * Prende ao projeto um ticket que ja existe.
 *
 * O caminho de quem cobrou primeiro e organizou depois — sem ele, ticket criado
 * pela tela de tickets nunca poderia ser reconhecido como cobranca do projeto.
 */
export async function vincularTicket(
  empresaId: number,
  usuarioId: string | null,
  projetoId: number,
  ticketId: number,
): Promise<Projeto> {
  const projeto = await obterProjeto(empresaId, projetoId);

  if (projeto.tickets.some((t) => t.id === ticketId)) {
    throw new BusinessRuleError("Este ticket ja esta vinculado ao projeto.");
  }

  const disponiveis = await ticketsDisponiveis(empresaId, projetoId);
  if (!disponiveis.some((t) => t.id === ticketId)) {
    throw new BusinessRuleError(
      "Este ticket nao pode ser vinculado: ou ja pertence a outro projeto, ou foi cancelado, ou e de outro cliente.",
    );
  }

  await repo.vincularTicket(projetoId, ticketId, usuarioId);
  return obterProjeto(empresaId, projetoId);
}

/**
 * Solta um ticket do projeto, sem apagar o ticket.
 *
 * E o passo que destrava a exclusao do projeto, e tambem o unico jeito de
 * desfazer uma cobranca gerada por engano sem cancelar o ticket.
 */
export async function desvincularTicket(
  empresaId: number,
  projetoId: number,
  ticketId: number,
): Promise<Projeto> {
  const projeto = await obterProjeto(empresaId, projetoId);

  if (!projeto.tickets.some((t) => t.id === ticketId)) {
    throw new BusinessRuleError("Este ticket nao pertence ao projeto.");
  }

  await repo.desvincularTicket(projetoId, ticketId);
  return obterProjeto(empresaId, projetoId);
}

export async function excluirDemanda(empresaId: number, demandaId: number): Promise<Projeto> {
  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);
  const projeto = await obterProjeto(empresaId, projetoId);

  // Demanda que virou ticket nao some: o ticket continuaria apontando para uma
  // origem que deixou de existir, e o valor cobrado perderia a justificativa.
  const demanda = projeto.demandas.find((d) => d.id === demandaId);
  if (demanda?.ticketId != null) {
    throw new BusinessRuleError(
      "Esta demanda ja gerou um ticket. Cancele o ticket antes de excluir a demanda.",
    );
  }

  await repo.excluirDemanda(demandaId);
  return obterProjeto(empresaId, projetoId);
}

// ── Checklist e comentarios ─────────────────────────────────────────────────

export async function criarItem(
  empresaId: number,
  usuarioId: string | null,
  demandaId: number,
  descricao: string,
): Promise<Projeto> {
  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);
  await repo.criarItem(demandaId, usuarioId, descricao);
  return obterProjeto(empresaId, projetoId);
}

export async function alternarItem(
  empresaId: number,
  itemId: number,
  feito: boolean,
): Promise<Projeto> {
  const demandaId = await repo.demandaDoItem(itemId);
  if (demandaId == null) throw new NotFoundError("Item nao encontrado");

  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);
  await repo.alternarItem(itemId, feito);
  return obterProjeto(empresaId, projetoId);
}

export async function excluirItem(empresaId: number, itemId: number): Promise<Projeto> {
  const demandaId = await repo.demandaDoItem(itemId);
  if (demandaId == null) throw new NotFoundError("Item nao encontrado");

  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);
  await repo.excluirItem(itemId);
  return obterProjeto(empresaId, projetoId);
}

export async function comentar(
  empresaId: number,
  usuarioId: string | null,
  demandaId: number,
  texto: string,
): Promise<Projeto> {
  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);
  await repo.comentar(demandaId, usuarioId, texto);
  return obterProjeto(empresaId, projetoId);
}

export async function anexar(
  empresaId: number,
  usuarioId: string | null,
  demandaId: number,
  entrada: { url: string; nome?: string | null },
): Promise<Projeto> {
  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);
  await repo.anexar(demandaId, usuarioId, entrada);
  return obterProjeto(empresaId, projetoId);
}

export async function excluirAnexo(empresaId: number, anexoId: number): Promise<Projeto> {
  const demandaId = await repo.demandaDoAnexo(anexoId);
  if (demandaId == null) throw new NotFoundError("Anexo nao encontrado");

  const projetoId = await exigirProjetoDaDemanda(empresaId, demandaId);
  await repo.excluirAnexo(anexoId);
  return obterProjeto(empresaId, projetoId);
}

// ── Ponte com o dinheiro ────────────────────────────────────────────────────

/**
 * As checagens daqui existem para dar mensagem legivel; quem garante sao as
 * RPCs, que repetem as regras DENTRO da transacao. Confiar so nestas deixaria a
 * porta aberta para quem chama a API direto.
 */
export async function gerarTicketDoProjeto(
  empresaId: number,
  usuarioId: string | null,
  projetoId: number,
  valor: Centavos,
  titulo: string | null,
): Promise<{ projeto: Projeto; ticketId: number }> {
  const projeto = await obterProjeto(empresaId, projetoId);

  if (projeto.modalidade !== "FECHADO") {
    throw new BusinessRuleError(
      "Neste projeto o valor vive na tarefa. Cobre pelas tarefas concluidas.",
    );
  }
  if (projeto.cancelado) {
    throw new BusinessRuleError("Projeto cancelado nao gera cobranca.");
  }

  /*
   * Sem contrato PASSA, de proposito.
   *
   * O contrato e o que justifica o valor, e cobrar sem ele deixa a cobranca sem
   * documento por tras caso seja questionada — mas projeto fechado no boca a
   * boca existe, e travar impedia registrar o que ja aconteceu. A tela avisa; a
   * regra nao impede.
   */
  if (valor <= 0) throw new BusinessRuleError("Informe o valor do escopo.");

  const ticketId = await repo.gerarTicketDoProjeto(projetoId, usuarioId, valor, titulo);
  return { projeto: await obterProjeto(empresaId, projetoId), ticketId };
}

/**
 * Um lote de tarefas concluidas vira UM ticket, com uma linha para cada.
 *
 * Uma cobranca por tarefa faria doze entregas no mes virarem doze faturas para o
 * mesmo cliente. O lote e como se fatura de verdade: o periodo inteiro numa nota
 * so, discriminado item a item.
 */
export async function gerarTicketDasDemandas(
  empresaId: number,
  usuarioId: string | null,
  projetoId: number,
  demandaIds: number[],
): Promise<{ projeto: Projeto; ticketId: number }> {
  const projeto = await obterProjeto(empresaId, projetoId);

  if (demandaIds.length === 0) {
    throw new BusinessRuleError("Selecione ao menos uma tarefa.");
  }
  if (projeto.modalidade !== "POR_DEMANDA") {
    throw new BusinessRuleError("Neste projeto o valor vive no ticket do escopo, nao na tarefa.");
  }
  if (projeto.cancelado) {
    throw new BusinessRuleError("Projeto cancelado nao gera cobranca.");
  }

  /*
   * As tarefas sao conferidas UMA A UMA para a mensagem dizer qual recusou: com
   * dez selecionadas, "alguma tarefa nao pode ser cobrada" nao ajuda ninguem.
   *
   * A RPC repete tudo isto dentro da transacao — estas checagens existem para a
   * mensagem, nao para a garantia. Confiar so nelas deixaria a porta aberta para
   * quem chama a API direto.
   */
  for (const id of demandaIds) {
    const tarefa = projeto.demandas.find((d) => d.id === id);

    if (!tarefa) throw new BusinessRuleError("Alguma das tarefas selecionadas nao existe mais.");
    if (tarefa.ticketId != null) {
      throw new BusinessRuleError(
        `A tarefa "${tarefa.titulo}" ja foi cobrada no ticket ${tarefa.ticketId}.`,
      );
    }
    if (!tarefa.concluidaEm) {
      throw new BusinessRuleError(
        `A tarefa "${tarefa.titulo}" precisa estar concluida para virar cobranca.`,
      );
    }
    if (tarefa.valor <= 0) {
      throw new BusinessRuleError(`Informe o valor da tarefa "${tarefa.titulo}".`);
    }
  }

  const ticketId = await repo.gerarTicketDasDemandas(demandaIds, usuarioId);
  return { projeto: await obterProjeto(empresaId, projetoId), ticketId };
}

/**
 * Demanda nao tem `fkEmpresa` — o tenant vem do projeto.
 *
 * A RLS ja barraria a escrita, mas sem esta checagem o erro chegaria como falha
 * de banco em vez de "nao encontrado", e o servico devolveria o projeto de
 * outra empresa para quem pediu.
 */
async function exigirProjetoDaDemanda(empresaId: number, demandaId: number): Promise<number> {
  const projetoId = await repo.projetoDaDemanda(demandaId);
  if (projetoId == null) throw new NotFoundError("Demanda nao encontrada");

  const projeto = await repo.buscarPorId(empresaId, projetoId);
  if (!projeto) throw new ForbiddenError("Demanda de outra empresa");

  return projetoId;
}
