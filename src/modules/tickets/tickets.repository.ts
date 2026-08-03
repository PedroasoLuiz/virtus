import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, type Centavos } from "@/shared/utils/money";
import { hoje, type DataISO } from "@/shared/utils/datas";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { intervalo, type Paginacao, type Pagina } from "@/shared/utils/paginacao";
import {
  repartirRecebimento,
  type ChaveStatus,
  type FaturaDoTicket,
  type FiltroTickets,
  type ItemTicket,
  type OrigemTicket,
  type StatusTicket,
  type UnidadeItem,
  type Ticket,
  type TicketResumo,
} from "@/modules/tickets/tickets.types";

/**
 * Unica porta de acesso aos dados de ticket.
 *
 * Os totais vem da view `vw_tickets_faturamento`, que calcula orcamento,
 * faturado e saldo numa consulta so — evita o N+1 de somar itens e vinculos
 * por linha da tela.
 */

const COLUNAS =
  "id, idtenant, fkCentroCusto, fkEndereco, titulo, descricao, apontamento, local, prioridade, cancelada, origem, datainicio, datafim, fkCliente, fkStatus";

/** So na leitura de um ticket: a listagem nao mostra autoria. */
const COLUNAS_DETALHE = `${COLUNAS}, created_at, updated_at, fkUserCriacao, fkUserModificacao`;

/**
 * O status vem por join e nao pela coluna `status` (texto livre) da tabela: o
 * quadro precisa da coluna cadastrada, com indice e chave. O texto legado segue
 * na tabela por causa das RPCs `get_*` da aplicacao de origem.
 *
 * O embed vem qualificado pelo nome da constraint porque `ordensservico` tem
 * DUAS chaves estrangeiras para `ordensservicostatus` — `fkStatus` e
 * `fkStatusRetorno`. Sem qualificar, o PostgREST responde PGRST201 (ambiguo)
 * em vez de escolher uma.
 */
const RELACOES =
  "clientes(razao, nomefantasia, centrodecusto(descricao)), coluna:ordensservicostatus!ordensservico_fkStatus_fkey(descricao, chave)";

/**
 * O endereco entra so na leitura de UM ticket.
 *
 * Na listagem seriam 200 tickets trazendo endereco que nenhum card mostra —
 * peso de rede por dado que ninguem le.
 *
 * ⚠️ Escrito por extenso, e nao derivado de `RELACOES` com `.replace()`: o
 * supabase-js interpreta a string do `select` EM TEMPO DE TIPO, e qualquer
 * manipulacao em runtime devolve `ParserError` no lugar da linha tipada.
 */
const RELACOES_DETALHE =
  "clientes(razao, nomefantasia, cnpj, centrodecusto(descricao), clientesenderecos(logradouro, numero, complemento, bairro, cidade, uf, cep, principal)), coluna:ordensservicostatus!ordensservico_fkStatus_fkey(descricao, chave)";

export async function listar(
  empresaId: number,
  filtro: FiltroTickets,
  paginacao: Paginacao,
): Promise<Pagina<TicketResumo>> {
  const supabase = await serverClient();
  const [de, ate] = intervalo(paginacao);

  let query = supabase
    .from("ordensservico")
    .select(`${COLUNAS}, ${RELACOES}`, { count: "exact" })
    .eq("fkEmpresa", empresaId);

  if (!filtro.incluirCancelados) query = query.eq("cancelada", false);
  if (filtro.statusId) query = query.eq("fkStatus", filtro.statusId);
  if (filtro.origem) query = query.eq("origem", filtro.origem);
  if (filtro.clienteId) query = query.eq("fkCliente", filtro.clienteId);

  const { data, error, count } = await query.order("id", { ascending: false }).range(de, ate);
  if (error) throw error;

  const linhas = data ?? [];
  const ids = linhas.map((l) => l.id);
  const [totais, servicos] = await Promise.all([faturamentoDe(ids), qtdServicosDe(ids)]);

  return {
    itens: linhas.map((l) => paraDominio(l, totais.get(l.id), servicos.get(l.id))),
    total: count ?? 0,
  };
}

/**
 * Quantos servicos cada ticket tem — o card do quadro mostra a contagem.
 *
 * Uma consulta para a pagina inteira, nao uma por card: com 200 tickets em tela
 * o N+1 seria visivel.
 */
async function qtdServicosDe(ids: number[]): Promise<Map<number, number>> {
  const mapa = new Map<number, number>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("ordensservicoxservicos")
    .select("fkOrdem")
    .in("fkOrdem", ids);

  if (error) throw error;

  for (const l of data ?? []) {
    if (l.fkOrdem == null) continue;
    mapa.set(l.fkOrdem, (mapa.get(l.fkOrdem) ?? 0) + 1);
  }
  return mapa;
}

type Faturamento = { total: number; faturado: number; saldo: number; qtdFaturas: number };

async function faturamentoDe(ids: number[]): Promise<Map<number, Faturamento>> {
  const mapa = new Map<number, Faturamento>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("vw_origens_faturamento")
    .select("origem_id, total, faturado, saldo, qtd_contas")
    .eq("tipo", "TICKET")
    .in("origem_id", ids);

  if (error) throw error;

  for (const l of data ?? []) {
    mapa.set(l.origem_id, {
      total: l.total ?? 0,
      faturado: l.faturado ?? 0,
      saldo: l.saldo ?? 0,
      qtdFaturas: l.qtd_contas ?? 0,
    });
  }
  return mapa;
}

export async function buscarPorId(empresaId: number, id: number): Promise<Ticket | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservico")
    .select(`${COLUNAS_DETALHE}, ${RELACOES_DETALHE}`)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [itens, totais, faturas, empresa] = await Promise.all([
    listarItens(id),
    faturamentoDe([id]),
    listarFaturas(id),
    dadosDaEmpresa(empresaId),
  ]);

  const cliente = data.clientes as {
    cnpj?: string | null;
    clientesenderecos?: LinhaEndereco[];
  } | null;
  const enderecos = cliente?.clientesenderecos ?? [];

  return {
    ...paraDominio(data, totais.get(id), itens.length),
    autoria: {
      criadoPor: await nomeDoUsuario(data.fkUserCriacao),
      criadoEm: data.created_at,
      editadoPor: await nomeDoUsuario(data.fkUserModificacao),
      editadoEm: data.fkUserModificacao ? data.updated_at : null,
    },
    empresa,
    clienteDoc: cliente?.cnpj ?? null,
    clienteEndereco: enderecos.find((e) => e.principal) ?? enderecos[0] ?? null,
    descricao: data.descricao,
    apontamento: data.apontamento,
    local: enderecoDoCliente(data.clientes),
    itens,
    faturas,
  };
}

/** Emitente do documento — cabecalho do PDF. */
async function dadosDaEmpresa(empresaId: number) {
  const supabase = await serverClient();
  const { data } = await supabase
    .from("empresas")
    .select("razaosocial, fantasia, nome, cnpj, logo, logradouro, bairro, cidade, cep")
    .eq("id", empresaId)
    .maybeSingle();

  const e = data as Record<string, string | null> | null;

  return {
    razaoSocial: primeiroPreenchido(e?.razaosocial, e?.fantasia, e?.nome),
    endereco: primeiroPreenchido(
      [e?.logradouro, e?.bairro, e?.cidade, e?.cep].filter(Boolean).join(" · "),
    ),
    cnpj: primeiroPreenchido(e?.cnpj),
    logo: primeiroPreenchido(e?.logo),
  };
}

/**
 * Nome do usuario a partir do uuid.
 *
 * `usuarios` e visivel por `usuarios_visiveis()`, entao um usuario de outra
 * empresa volta nulo em vez de vazar o nome. A tela mostra "—" nesse caso.
 */
async function nomeDoUsuario(id: string | null): Promise<string | null> {
  if (!id) return null;

  const supabase = await serverClient();
  const { data } = await supabase
    .from("usuarios")
    .select("nome, email")
    .eq("fkUser", id)
    .maybeSingle();

  return primeiroPreenchido(data?.nome, data?.email);
}

/**
 * Contas a receber que consumiram valor deste ticket.
 *
 * O `valor` do vinculo e o que saiu DESTE ticket para aquela fatura; o total da
 * fatura pode ser maior, porque ela pode juntar valor de varios tickets.
 */
export async function listarFaturas(ticketId: number): Promise<FaturaDoTicket[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasorigens")
    .select(
      'valor, observacoes, fkFatura, faturas!inner(id, total, status, cancelada, "dataInicio", faturasparcelas(numeroparcela, total, vencimento, pago))',
    )
    .eq("origem", "TICKET")
    .eq("fkOrdem", ticketId)
    .order("fkFatura", { ascending: false });

  if (error) throw error;

  const agora = hoje();

  return (data ?? []).map((l) => {
    const f = l.faturas as unknown as {
      id: number;
      total: number | null;
      status: string | null;
      cancelada: boolean | null;
      dataInicio: string | null;
      faturasparcelas:
        | {
            numeroparcela: number | null;
            total: number;
            vencimento: string | null;
            pago: boolean | null;
          }[]
        | null;
    };

    const r = repartirRecebimento(f.faturasparcelas ?? [], agora);

    return {
      faturaId: f.id,
      valor: doBanco(l.valor),
      totalFatura: doBanco(f.total),
      // Cancelada vence o status, como no resto do sistema.
      situacao: f.cancelada ? "CANCELADA" : ((f.status ?? "").trim().toUpperCase() || "ABERTA"),
      emitidaEm: f.dataInicio ? ((f.dataInicio.slice(0, 10)) as DataISO) : null,
      observacoes: l.observacoes,
      pago: doBanco(r.pago),
      atrasado: doBanco(r.atrasado),
      aVencer: doBanco(r.aVencer),
      proximoVencimento: r.proximoVencimento,
      parcelas: (f.faturasparcelas ?? [])
        .map((x) => ({
          numero: x.numeroparcela,
          vencimento: x.vencimento ? ((x.vencimento.slice(0, 10)) as DataISO) : null,
          valor: doBanco(x.total),
          pago: x.pago ?? false,
        }))
        .sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? "")),
    };
  });
}

/**
 * Servicos do ticket.
 *
 * O nome do cadastro vem por embed e NAO e copiado para dentro do item:
 * renomear um servico tem de refletir nos tickets que o usam. A `descricao` do
 * item e complemento livre ("Instalacao — 3o andar"), e fica vazia na maioria —
 * 51 dos 298 itens migrados nao tem nenhuma.
 */
export async function listarItens(ticketId: number): Promise<ItemTicket[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservicoxservicos")
    .select(
      "id, fkServico, fkDemanda, descricao, data, quantidade, unidade, valor, desconto, acrescimo, total, servicos(descricao), projetosdemandas(titulo), ordensservicoxservicosdespesas(id, descricao, valor)",
    )
    .eq("fkOrdem", ticketId)
    .order("id", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id,
    servicoId: l.fkServico,
    servicoNome: nomeDoServico(l),
    descricao: (l.descricao ?? "").trim(),
    demandaId: l.fkDemanda,
    demandaTitulo:
      (l.projetosdemandas as unknown as { titulo: string | null } | null)?.titulo ?? null,
    data: l.data ? ((l.data.slice(0, 10)) as DataISO) : null,
    quantidade: l.quantidade,
    unidade: (l.unidade === "H" ? "H" : "UN") as UnidadeItem,
    valorUnitario: doBanco(l.valor),
    desconto: doBanco(l.desconto),
    acrescimo: doBanco(l.acrescimo),
    despesas: despesasDoItem(l),
    total: doBanco(l.total),
  }));
}

function despesasDoItem(linha: { ordensservicoxservicosdespesas?: unknown }) {
  const linhas = (linha.ordensservicoxservicosdespesas ?? []) as {
    id: number;
    descricao: string | null;
    valor: number | null;
  }[];

  return linhas.map((d) => ({
    id: d.id,
    descricao: (d.descricao ?? "").trim(),
    valor: doBanco(d.valor),
  }));
}

type LinhaEndereco = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  principal: boolean | null;
};

/**
 * Endereco do cliente em uma linha.
 *
 * Pega o marcado como `principal`; sem nenhum marcado, o primeiro. Um cliente
 * do cadastro tem dois enderecos, entao escolher por posicao sozinha traria o
 * errado nele.
 *
 * Monta so o que existe: "Rua X, , , Sao Paulo" e pior que endereco incompleto.
 */
function enderecoDoCliente(cliente: unknown): string | null {
  const enderecos = (cliente as { clientesenderecos?: LinhaEndereco[] } | null)?.clientesenderecos;
  if (!enderecos?.length) return null;

  const e = enderecos.find((x) => x.principal) ?? enderecos[0];

  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const cidadeUf = [e.cidade, e.uf].filter(Boolean).join("/");
  const linha = [rua, e.complemento, e.bairro, cidadeUf, e.cep].filter(Boolean).join(" · ");

  return linha || null;
}

function nomeDoServico(linha: { servicos?: unknown }): string | null {
  const servico = linha.servicos as { descricao: string | null } | null;
  return (servico?.descricao ?? "").trim() || null;
}

// ── Traducao linha -> dominio ───────────────────────────────────────────────

type Linha = {
  id: number;
  idtenant: number | null;
  fkCentroCusto: number | null;
  fkEndereco: number | null;
  titulo: string | null;
  prioridade: string | null;
  cancelada: boolean | null;
  origem: string;
  datainicio: string | null;
  datafim: string | null;
  fkCliente: number | null;
  fkStatus: number | null;
  clientes?: unknown;
  coluna?: unknown;
};

function paraDominio(linha: Linha, f?: Faturamento, qtdServicos = 0): TicketResumo {
  const cliente = linha.clientes as {
    razao: string | null;
    nomefantasia: string | null;
    centrodecusto: { descricao: string | null } | null;
  } | null;
  const status = linha.coluna as { descricao: string | null; chave: string | null } | null;

  return {
    id: linha.id,
    // Ticket anterior a numeracao cai no proprio id — melhor um numero
    // estranho que um vazio no lugar do identificador.
    numero: linha.idtenant ?? linha.id,
    titulo: linha.titulo ?? "",
    clienteId: linha.fkCliente,
    clienteNome: primeiroPreenchido(cliente?.nomefantasia, cliente?.razao),
    centroCustoId: linha.fkCentroCusto,
    centroCustoNome: cliente?.centrodecusto?.descricao ?? null,
    enderecoId: linha.fkEndereco,
    statusId: linha.fkStatus,
    status: (status?.descricao ?? "").trim() || "—",
    statusChave: (status?.chave as ChaveStatus | null) ?? null,
    prioridade: linha.prioridade,
    cancelada: linha.cancelada ?? false,
    origem: (linha.origem as OrigemTicket) ?? "EXECUCAO",
    inicio: linha.datainicio ? ((linha.datainicio.slice(0, 10)) as DataISO) : null,
    fim: linha.datafim ? ((linha.datafim.slice(0, 10)) as DataISO) : null,
    total: doBanco(f?.total ?? 0),
    faturado: doBanco(f?.faturado ?? 0),
    saldo: doBanco(f?.saldo ?? 0),
    qtdFaturas: f?.qtdFaturas ?? 0,
    qtdServicos,
  };
}

// ── Escrita ─────────────────────────────────────────────────────────────────

/**
 * `inicio` e `fim` NAO entram: o periodo e derivado das datas dos servicos pelo
 * gatilho `sincroniza_periodo_do_ticket`. Aceitar aqui criaria um segundo dono
 * do mesmo numero.
 */
export type CamposTicket = {
  clienteId?: number | null;
  centroCustoId?: number | null;
  enderecoId?: number | null;
  titulo?: string | null;
  descricao?: string | null;
  statusId?: number | null;
  cancelada?: boolean;
};

/** Item ja com o total calculado pelo servico, em centavos. */
export type DespesaParaGravar = { descricao: string; valor: number };

export type ItemParaGravar = {
  servicoId: number | null;
  unidade: string;
  descricao: string;
  data: string | null;
  despesas: DespesaParaGravar[];
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  acrescimo: number;
  total: number;
};

export async function criar(
  empresaId: number,
  usuarioId: string | null,
  campos: CamposTicket,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservico")
    .insert({
      ...paraLinha(campos),
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      // Nasce como execucao: MIGRACAO e retrato do legado e CONTRATO vem de
      // outro fluxo. Nenhum dos dois pode ser escolhido na tela.
      origem: "EXECUCAO",
      cancelada: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function atualizar(
  empresaId: number,
  id: number,
  usuarioId: string | null,
  campos: CamposTicket,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("ordensservico")
    .update({
      ...paraLinha(campos),
      fkUserModificacao: usuarioId,
      updated_at: new Date().toISOString(),
    })
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/** Monta so o que veio: enviar `undefined` apagaria coluna nao editada. */
function paraLinha(c: CamposTicket): Record<string, unknown> {
  const linha: Record<string, unknown> = {};
  if (c.clienteId !== undefined) linha.fkCliente = c.clienteId;
  if (c.centroCustoId !== undefined) linha.fkCentroCusto = c.centroCustoId;
  if (c.enderecoId !== undefined) linha.fkEndereco = c.enderecoId;
  if (c.titulo !== undefined) linha.titulo = c.titulo;
  if (c.descricao !== undefined) linha.descricao = c.descricao;
  if (c.statusId !== undefined) linha.fkStatus = c.statusId;
  if (c.cancelada !== undefined) linha.cancelada = c.cancelada;
  return linha;
}

/**
 * Troca a lista de servicos inteira, numa transacao so.
 *
 * Vai por RPC e nao por tres chamadas do PostgREST (apagar itens, inserir
 * itens, inserir despesas): entre chamadas nao ha transacao, e uma falha no
 * meio deixava o ticket SEM servico nenhum — total zerado com cobranca ja
 * emitida em cima.
 *
 * A funcao e `security invoker`, entao a RLS de `ordensservico` e das filhas
 * continua valendo: ela nao vira porta para escrever no ticket de outra
 * empresa.
 *
 * Apaga e reinsere em vez de diferenciar linha a linha porque o item nao e
 * referenciado por nada — `faturasorigens` aponta para o TICKET, nao para o
 * item. Sem referencia, diff so acrescentaria codigo para preservar ids que
 * ninguem le.
 */
export async function substituirItens(
  ticketId: number,
  usuarioId: string | null,
  itens: ItemParaGravar[],
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("salvar_itens_do_ticket", {
    p_ordem: ticketId,
    p_usuario: usuarioId,
    p_itens: itens.map((i) => ({
      servicoId: i.servicoId,
      descricao: i.descricao,
      data: i.data,
      quantidade: i.quantidade,
      unidade: i.unidade,
      // Dinheiro atravessa a fronteira em reais: as colunas do banco sao
      // `double precision`, herdadas do FlutterFlow.
      valor: paraBanco(i.valorUnitario as Centavos),
      desconto: paraBanco(i.desconto as Centavos),
      acrescimo: paraBanco(i.acrescimo as Centavos),
      total: paraBanco(i.total as Centavos),
      despesas: i.despesas.map((d) => ({
        descricao: d.descricao,
        valor: paraBanco(d.valor as Centavos),
      })),
    })),
  });

  if (error) throw error;
}

// ── Colunas do quadro ───────────────────────────────────────────────────────

const COLUNAS_STATUS = "id, descricao, indice, ativo, chave, sistema, cor";

export async function listarStatus(empresaId: number): Promise<StatusTicket[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservicostatus")
    .select(COLUNAS_STATUS)
    .eq("fkEmpresa", empresaId)
    .order("indice", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(statusParaDominio);
}

export async function buscarStatus(empresaId: number, id: number): Promise<StatusTicket | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservicostatus")
    .select(COLUNAS_STATUS)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? statusParaDominio(data) : null;
}

export async function criarStatus(
  empresaId: number,
  usuarioId: string | null,
  dados: { descricao: string; indice: number; cor: string },
): Promise<StatusTicket> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservicostatus")
    .insert({
      descricao: dados.descricao,
      indice: dados.indice,
      cor: dados.cor,
      ativo: true,
      sistema: false,
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
    })
    .select(COLUNAS_STATUS)
    .single();

  if (error) throw error;
  return statusParaDominio(data);
}

export async function atualizarStatus(
  empresaId: number,
  id: number,
  dados: { descricao?: string; indice?: number; cor?: string; ativo?: boolean },
): Promise<StatusTicket> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservicostatus")
    .update(dados)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .select(COLUNAS_STATUS)
    .single();

  if (error) throw error;
  return statusParaDominio(data);
}

export async function excluirStatus(empresaId: number, id: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("ordensservicostatus")
    .delete()
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/** Quantos tickets ocupam a coluna. Coluna ocupada nao pode ser excluida. */
export async function contarTicketsNoStatus(empresaId: number, id: number): Promise<number> {
  const supabase = await serverClient();

  const { count, error } = await supabase
    .from("ordensservico")
    .select("id", { count: "exact", head: true })
    .eq("fkEmpresa", empresaId)
    .eq("fkStatus", id);

  if (error) throw error;
  return count ?? 0;
}

export async function moverTicket(
  empresaId: number,
  ticketId: number,
  statusId: number,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("ordensservico")
    .update({ fkStatus: statusId, updated_at: new Date().toISOString() })
    .eq("fkEmpresa", empresaId)
    .eq("id", ticketId);

  if (error) throw error;
}

type LinhaStatus = {
  id: number;
  descricao: string | null;
  indice: number | null;
  ativo: boolean | null;
  chave: string | null;
  sistema: boolean;
  cor: string | null;
};

function statusParaDominio(l: LinhaStatus): StatusTicket {
  return {
    id: l.id,
    descricao: (l.descricao ?? "").trim() || "Sem nome",
    chave: (l.chave as ChaveStatus | null) ?? null,
    sistema: l.sistema,
    indice: l.indice ?? 0,
    cor: l.cor ?? "neutral",
    ativo: l.ativo ?? true,
  };
}
