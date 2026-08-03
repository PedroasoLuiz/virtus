import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * Projeto — a camada de EXECUCAO, separada da de dinheiro.
 *
 * O quadro de tickets ja mistura dois relogios: "Orcamento -> Na fila ->
 * Concluido" e execucao, "Faturado -> Encerrada" e cobranca. Demanda de projeto
 * nao cabe la sem fazer a mesma coluna significar duas coisas. Ver docs/11.
 */

/**
 * O que liga demanda a dinheiro.
 *
 * FECHADO      o valor combinado vive num ticket so; as demandas medem
 *              progresso e nao carregam valor — ratear preco por tarefa seria
 *              inventar numero.
 * POR_DEMANDA  cada demanda concluida vira servico num ticket proprio.
 */
export const MODALIDADES = ["FECHADO", "POR_DEMANDA"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

/**
 * Etapa do PROJETO — nao confundir com a coluna do quadro de demandas.
 *
 * Sao duas perguntas: "em que pe esta o projeto" e "em que pe esta cada tarefa
 * dele". Conjunto fixo porque e ciclo de vida, nao fluxo de trabalho — o que
 * varia por equipe e o quadro de demandas, que ja e por projeto.
 */
export const SITUACOES = ["FILA", "ANDAMENTO", "PAUSADO", "CONCLUIDO", "ENCERRADO"] as const;
export type SituacaoProjeto = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<SituacaoProjeto, string> = {
  FILA: "Na fila",
  ANDAMENTO: "Em andamento",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  ENCERRADO: "Encerrado",
};

export const TOM_SITUACAO: Record<SituacaoProjeto, string> = {
  FILA: "neutral",
  ANDAMENTO: "info",
  PAUSADO: "warning",
  CONCLUIDO: "success",
  ENCERRADO: "neutral",
};

export type ColunaProjeto = {
  id: number;
  descricao: string;
  indice: number;
  cor: string;
  ativo: boolean;
  /** A coluna que significa "feito". Libera virar servico em POR_DEMANDA. */
  conclui: boolean;
};

export type ItemDaTarefa = {
  id: number;
  descricao: string;
  feito: boolean;
};

export type Anexo = {
  id: number;
  url: string;
  /** Rotulo legivel. Sem ele a lista viraria uma coluna de URLs cruas. */
  nome: string;
};

export type Comentario = {
  id: number;
  texto: string;
  autorNome: string | null;
  em: string;
};

export type Demanda = {
  id: number;
  titulo: string;
  descricao: string | null;
  colunaId: number | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  inicio: DataISO | null;
  /** Fim previsto. Com `inicio`, forma o periodo da tarefa. */
  prazo: DataISO | null;
  concluidaEm: string | null;
  /*
   * O que o registro sabe do proprio passado. Nao e trilha de auditoria: sao as
   * colunas que a tabela ja mantinha. Uma trilha de verdade guardaria CADA
   * mudanca, e essas quatro so guardam a ultima.
   */
  criadaEm: string;
  criadaPor: string | null;
  alteradaEm: string | null;
  alteradaPor: string | null;
  /** So faz sentido em POR_DEMANDA — no FECHADO o valor vive no ticket. */
  valor: Centavos;
  /** Ticket gerado por esta demanda. So em projeto POR_DEMANDA. */
  ticketId: number | null;
  itens: ItemDaTarefa[];
  comentarios: Comentario[];
  anexos: Anexo[];
};

/** Progresso do checklist. Zero itens nao e zero por cento — e "sem checklist". */
export function progressoDoChecklist(itens: ItemDaTarefa[]): { feitos: number; total: number } {
  return { feitos: itens.filter((i) => i.feito).length, total: itens.length };
}

/** Um ticket que o projeto gerou. Escopo fechado com aditivo tem mais de um. */
export type TicketDoProjeto = {
  id: number;
  /** Numero dentro da empresa — e o que aparece na tela. */
  numero: number;
  /**
   * Nulo quando o registro nao tem titulo PROPRIO.
   *
   * Na base migrada `ordensservico.titulo` guarda o numero antigo do
   * FlutterFlow — "173" ao lado de "TICKET 100" e o mesmo ticket contado duas
   * vezes, com dois numeros que nao conversam.
   */
  titulo: string | null;
  valor: Centavos;
  /** Em que coluna do quadro de tickets ele esta. */
  situacao: string | null;
  inicio: DataISO | null;
};

/** Um contrato que cobre o projeto. */
export type ContratoDoProjeto = {
  id: number;
  numero: string | null;
  descricao: string | null;
  valor: Centavos;
  inicio: DataISO | null;
  fim: DataISO | null;
  ativo: boolean;
};

/** Ticket que ainda nao pertence a projeto nenhum, e por isso pode ser vinculado. */
export type TicketDisponivel = TicketDoProjeto & {
  clienteId: number | null;
};

export type ProjetoResumo = {
  id: number;
  /** Numero dentro da empresa. E o que aparece na tela — ver docs/10. */
  numero: number;
  nome: string;
  clienteId: number | null;
  clienteNome: string | null;
  modalidade: Modalidade;
  situacao: SituacaoProjeto;
  /** Quantos tickets o projeto ja gerou. Zero enquanto nao houve cobranca. */
  qtdTickets: number;
  /** Soma dos tickets do projeto. O cancelado sai da conta ao ser cancelado. */
  valor: Centavos;
  inicio: DataISO | null;
  fim: DataISO | null;
  ativo: boolean;
  cancelado: boolean;
  qtdDemandas: number;
  qtdConcluidas: number;
};

export type Projeto = ProjetoResumo & {
  descricao: string | null;
  colunas: ColunaProjeto[];
  demandas: Demanda[];
  tickets: TicketDoProjeto[];
  contratos: ContratoDoProjeto[];
  /** Quem criou e quem mexeu por ultimo. Nao e trilha: guarda so a ultima. */
  autoria: {
    criadoEm: string;
    criadoPor: string | null;
    editadoEm: string | null;
    editadoPor: string | null;
  };
};

/**
 * Tarefa que ja pode virar cobranca: concluida, com valor e ainda nao cobrada.
 *
 * As tres condicoes juntas, e nao so "concluida": tarefa sem valor geraria linha
 * de zero no ticket, e tarefa ja cobrada entraria duas vezes na mesma nota.
 */
export function faturavel(d: Demanda): boolean {
  return d.concluidaEm != null && d.valor > 0 && d.ticketId == null;
}

export type ProjetoNovo = {
  nome: string;
  descricao?: string | null;
  clienteId?: number | null;
  modalidade: Modalidade;
  situacao?: SituacaoProjeto;
  inicio?: DataISO | null;
  fim?: DataISO | null;
};

export type FiltroProjetos = {
  clienteId?: number;
  modalidade?: Modalidade;
  incluirEncerrados?: boolean;
};

/**
 * Quanto do projeto ja foi entregue, de 0 a 1.
 *
 * Conta DEMANDA, nao valor: no projeto fechado o valor nao esta nas demandas, e
 * no por demanda ele so existe depois de concluida. Contar tarefa e a unica
 * medida que vale nas duas modalidades.
 *
 * Pura e neste arquivo porque a tela tambem a usa — em `service.ts` ela
 * arrastaria o Supabase para o bundle do cliente.
 */
export function progresso(p: { qtdDemandas: number; qtdConcluidas: number }): number {
  if (p.qtdDemandas <= 0) return 0;
  return Math.min(1, p.qtdConcluidas / p.qtdDemandas);
}
