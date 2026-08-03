import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * Ticket — a ordem de servico, que no modelo novo e o ponto de partida do
 * orcamento e a origem da conta a receber.
 *
 * No banco a tabela chama `ordensservico`: veio da aplicacao de origem e e
 * referenciada pelas RPCs `get_*`. "Ticket" e o nome da interface. Ver docs/10.
 */

/** De onde o ticket veio. Migrado nao e execucao real — ver docs/10. */
export type OrigemTicket = "EXECUCAO" | "MIGRACAO" | "CONTRATO";

// ── Colunas do quadro ───────────────────────────────────────────────────────

/**
 * As cinco colunas que o sistema gerencia.
 *
 *   ORCAMENTO  proposta enviada
 *   FILA       aprovada, aguardando execucao
 *   CONCLUIDO  executado, ainda nao faturado — e daqui que a fatura se monta
 *   PARCIAL    conta a receber emitida, sem baixa  (rotulo "Faturado")
 *   ENCERRADA  a conta ja teve baixa
 *
 * `PARCIAL` e `ENCERRADA` sao consequencia do dinheiro, nao decisao de quem
 * opera: um gatilho no banco move o ticket para elas quando a conta a receber e
 * criada. Por isso nao aparecem como destino de arrastar.
 */
export const CHAVES_STATUS = [
  "ORCAMENTO",
  "FILA",
  "CONCLUIDO",
  "PARCIAL",
  "ENCERRADA",
] as const;
export type ChaveStatus = (typeof CHAVES_STATUS)[number];

/** Colunas cuja ocupacao e decidida pelo faturamento — o usuario nao move. */
export const STATUS_DO_FATURAMENTO: ChaveStatus[] = ["PARCIAL", "ENCERRADA"];

export function ehDoFaturamento(chave: string | null): boolean {
  return STATUS_DO_FATURAMENTO.includes(chave as ChaveStatus);
}

export type StatusTicket = {
  id: number;
  descricao: string;
  /** Nulo nas colunas criadas pelo usuario. */
  chave: ChaveStatus | null;
  /** Do sistema: nao pode ser excluida nem desativada. */
  sistema: boolean;
  /** Posicao no quadro. Fixas ocupam 1, 2, 900 e 1000. */
  indice: number;
  cor: string;
  ativo: boolean;
};

/**
 * Gasto lancado no servico — abastecimento, pedagio, material.
 *
 * Tem nome proprio, ao contrario de `acrescimo`: um numero solto responde
 * "quanto", nunca "de que", e e o "de que" que sustenta a conversa com o
 * cliente sobre o valor cobrado.
 */
export type DespesaItem = {
  id: number;
  descricao: string;
  valor: Centavos;
};

export const UNIDADES_ITEM = ["UN", "H"] as const;
export type UnidadeItem = (typeof UNIDADES_ITEM)[number];

export type ItemTicket = {
  id: number;
  servicoId: number | null;
  /**
   * Nome do servico no cadastro. Separado de `descricao` porque o card mostra
   * os dois: o cadastro em cima, o texto livre embaixo. Fundir os dois num
   * campo so foi o que fazia a descricao propria sumir quando existia.
   */
  servicoNome: string | null;
  /** Texto livre do item — complemento, nao substituto do nome. */
  descricao: string;
  /**
   * A tarefa de projeto que virou esta linha. Nulo em servico digitado a mao.
   *
   * Existe para o ticket poder dizer de ONDE veio o valor. Sem ela a
   * correspondencia vivia so na ordem em que as linhas foram inseridas, e a
   * primeira edicao do ticket a desfazia.
   */
  demandaId: number | null;
  demandaTitulo: string | null;
  /** Data de execucao. Se durou mais de um dia, vale o primeiro. */
  data: DataISO | null;
  quantidade: number;
  /** Como a quantidade foi lancada. Guardada, nunca inferida — ver docs/10. */
  unidade: UnidadeItem;
  valorUnitario: Centavos;
  desconto: Centavos;
  acrescimo: Centavos;
  despesas: DespesaItem[];
  /** Ja inclui as despesas. Calculado no servico, nunca aceito do cliente. */
  total: Centavos;
};

export type TicketResumo = {
  /** Chave interna. Usada em rota e vinculo — nunca mostrada ao usuario. */
  id: number;
  /**
   * Numero DENTRO da empresa, gerado por `zsequencias`. E o que aparece na
   * tela e no documento: num SaaS, o `id` global faria a segunda empresa a
   * entrar comecar os tickets no 4712.
   */
  numero: number;
  titulo: string;
  clienteId: number | null;
  clienteNome: string | null;
  /** Centro de custo escolhido no ticket, entre os do cliente. */
  centroCustoId: number | null;
  centroCustoNome: string | null;
  /** Endereco de execucao, entre os do centro escolhido. */
  enderecoId: number | null;
  /** Coluna do quadro. Nulo em ticket antigo que nunca passou pelo fluxo novo. */
  statusId: number | null;
  status: string;
  statusChave: ChaveStatus | null;
  prioridade: string | null;
  cancelada: boolean;
  origem: OrigemTicket;
  /**
   * Periodo — DERIVADO da menor e maior data entre os servicos, pelo gatilho
   * `sincroniza_periodo_do_ticket`. Nao se escreve nele.
   */
  inicio: DataISO | null;
  fim: DataISO | null;
  /** Soma dos itens do orcamento. */
  total: Centavos;
  /** Quanto ja entrou em alguma conta a receber. */
  faturado: Centavos;
  /** O que ainda pode ser faturado. Calculado, nunca armazenado. */
  saldo: Centavos;
  qtdFaturas: number;
  qtdServicos: number;
};

/** Uma conta a receber que consumiu valor deste ticket. */
export type FaturaDoTicket = {
  faturaId: number;
  /** Quanto DESTE ticket entrou naquela fatura — nao o total da fatura. */
  valor: Centavos;
  totalFatura: Centavos;
  situacao: string;
  emitidaEm: DataISO | null;
  observacoes: string | null;
  /**
   * Recebimento da CONTA inteira, nao da parte deste ticket.
   *
   * Ratear a baixa entre as origens exigiria decidir qual ticket foi pago
   * primeiro numa conta composta — invencao, nao dado. A tela mostra os dois
   * lados: "deste ticket" e o que a conta recebeu.
   */
  pago: Centavos;
  atrasado: Centavos;
  aVencer: Centavos;
  /** Vencimento em aberto mais proximo. Nulo se nao ha parcela a vencer. */
  proximoVencimento: DataISO | null;
  /** Detalhe das parcelas — usado pelo PDF, nao pela tela. */
  parcelas: ParcelaDaConta[];
};

export type EnderecoCliente = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
};

export type ParcelaCrua = {
  total: number;
  vencimento: string | null;
  pago: boolean | null;
};

/**
 * Reparte o valor de uma conta entre pago, atrasado e a vencer.
 *
 * Parcela sem vencimento conta como a vencer: sem data nao da para afirmar que
 * atrasou, e acusar atraso indevido e pior que deixar de acusar.
 *
 * Funcao pura e neste arquivo porque a tela tambem a usa — em `service.ts` ela
 * arrastaria o Supabase para o bundle do cliente.
 */
export function repartirRecebimento(
  parcelas: ParcelaCrua[],
  hoje: DataISO,
): { pago: number; atrasado: number; aVencer: number; proximoVencimento: DataISO | null } {
  let pago = 0;
  let atrasado = 0;
  let aVencer = 0;
  let proximo: DataISO | null = null;

  for (const p of parcelas) {
    const valor = p.total ?? 0;

    if (p.pago) {
      pago += valor;
      continue;
    }

    const venc = p.vencimento ? (p.vencimento.slice(0, 10) as DataISO) : null;

    if (venc && venc < hoje) {
      atrasado += valor;
    } else {
      aVencer += valor;
      if (venc && (proximo === null || venc < proximo)) proximo = venc;
    }
  }

  return { pago, atrasado, aVencer, proximoVencimento: proximo };
}

/** Quem mexeu e quando. Nome nulo quando o usuario nao esta mais no cadastro. */
export type Autoria = {
  criadoPor: string | null;
  criadoEm: string | null;
  editadoPor: string | null;
  editadoEm: string | null;
};

/** Emitente do documento. Sai no cabecalho do PDF. */
export type EmpresaDoDocumento = {
  razaoSocial: string | null;
  endereco: string | null;
  cnpj: string | null;
  logo: string | null;
};

export type ParcelaDaConta = {
  numero: number | null;
  vencimento: DataISO | null;
  valor: Centavos;
  pago: boolean;
};

export type Ticket = TicketResumo & {
  autoria: Autoria;
  empresa: EmpresaDoDocumento;
  /** CNPJ ou CPF do cliente, como esta no cadastro. */
  clienteDoc: string | null;
  clienteEndereco: EnderecoCliente | null;
  descricao: string | null;
  apontamento: string | null;
  /**
   * Onde o servico foi executado — o endereco PRINCIPAL do cliente, montado na
   * leitura. Nao e campo do ticket: cliente tem um endereco so, e digitar de
   * novo criaria a chance de divergir do cadastro.
   */
  local: string | null;
  itens: ItemTicket[];
  faturas: FaturaDoTicket[];
};

export type FiltroTickets = {
  statusId?: number;
  clienteId?: number;
  origem?: OrigemTicket;
  /** Só os que ainda têm saldo — é a lista que alimenta o gerar fatura. */
  somenteFaturaveis?: boolean;
  incluirCancelados?: boolean;
};

/*
 * Nao existe mais `situacaoDeFaturamento` aqui.
 *
 * A situacao virou posicao no quadro, e quem a decide e o gatilho
 * `move_status_do_ticket` no banco. Manter a regra tambem em TypeScript daria
 * duas fontes para a mesma resposta — e a divergencia so apareceria na tela,
 * depois de o numero ja estar errado.
 *
 * O saldo continua calculado, nunca armazenado: ver `vw_origens_faturamento`.
 */
