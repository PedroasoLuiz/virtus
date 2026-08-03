import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, type Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { intervalo, type Paginacao, type Pagina } from "@/shared/utils/paginacao";
import {
  STATUS_FATURA,
  type Fatura,
  type FaturaResumo,
  type FiltroFaturas,
  type OrigemNova,
  type ParcelaFatura,
  type Historico,
  type TicketDaFatura,
  type SituacaoFatura,
  type StatusFatura,
} from "@/modules/faturas/faturas.types";
import type { Parcela } from "@/shared/domain/parcelas";

/**
 * Unica porta de acesso aos dados de faturas.
 *
 * Duas responsabilidades: falar com o Postgres e traduzir linha de tabela em
 * entidade de dominio. Toda conversao de dinheiro (double no banco <-> centavos
 * no dominio) acontece aqui — nenhum outro arquivo do sistema ve `double`.
 *
 * Nomes de coluna seguem o banco herdado: timestamps em snake_case
 * (`created_at`), chaves estrangeiras em camelCase (`fkEmpresa`).
 */

const COLUNAS_FATURA =
  "id, fkCliente, dataInicio, dataFim, status, cancelada, total, observacoes, rodape, parcelas";

// ── Leitura ─────────────────────────────────────────────────────────────────

export async function listar(
  empresaId: number,
  filtro: FiltroFaturas,
  paginacao: Paginacao,
): Promise<Pagina<FaturaResumo>> {
  const supabase = await serverClient();
  const [de, ate] = intervalo(paginacao);

  let query = supabase
    .from("faturas")
    .select(`${COLUNAS_FATURA}, clientes(razao, nomefantasia)`, { count: "exact" })
    .eq("fkEmpresa", empresaId);

  if (filtro.status) query = query.eq("status", filtro.status);
  if (filtro.clienteId) query = query.eq("fkCliente", filtro.clienteId);
  // Canceladas ficam fora por padrao — sao ruido na operacao do dia a dia.
  if (!filtro.incluirCanceladas) query = query.eq("cancelada", false);

  const { data, error, count } = await query.order("id", { ascending: false }).range(de, ate);
  if (error) throw error;

  const linhas = data ?? [];
  const ids = linhas.map((l) => l.id);
  const [vencimentos, tickets, pagos] = await Promise.all([
    proximosVencimentos(ids),
    contarTickets(ids),
    somarPago(ids),
  ]);

  return {
    itens: linhas.map((l) =>
      paraDominioResumo(
        l,
        vencimentos.get(l.id) ?? null,
        tickets.get(l.id) ?? 0,
        pagos.get(l.id) ?? 0,
      ),
    ),
    total: count ?? 0,
  };
}

/**
 * Proxima parcela em aberto de cada fatura, numa consulta so.
 *
 * O legado buscava parcela a parcela dentro do laco de renderizacao — 25 linhas
 * na tela viravam 25 idas ao banco.
 */
async function proximosVencimentos(faturaIds: number[]): Promise<Map<number, DataISO>> {
  const mapa = new Map<number, DataISO>();
  if (faturaIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("faturasparcelas")
    .select("fkFatura, vencimento, pago")
    .in("fkFatura", faturaIds)
    .eq("pago", false)
    .order("vencimento", { ascending: true });

  if (error) throw error;

  for (const linha of data ?? []) {
    if (linha.fkFatura == null || !linha.vencimento) continue;
    // Ordenado por vencimento: o primeiro que chega e o mais proximo.
    if (!mapa.has(linha.fkFatura)) {
      mapa.set(linha.fkFatura, linha.vencimento.slice(0, 10) as DataISO);
    }
  }
  return mapa;
}

/** Quanto ja entrou em cada conta, somado das parcelas baixadas. */
async function somarPago(faturaIds: number[]): Promise<Map<number, number>> {
  const mapa = new Map<number, number>();
  if (faturaIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("faturasparcelas")
    .select("fkFatura, total")
    .eq("pago", true)
    .in("fkFatura", faturaIds);

  if (error) throw error;

  for (const l of data ?? []) {
    if (l.fkFatura == null) continue;
    mapa.set(l.fkFatura, (mapa.get(l.fkFatura) ?? 0) + (l.total ?? 0));
  }
  return mapa;
}

/** Quantos tickets cada conta juntou. Uma consulta para a pagina inteira. */
async function contarTickets(faturaIds: number[]): Promise<Map<number, number>> {
  const mapa = new Map<number, number>();
  if (faturaIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("faturasorigens")
    .select('"fkFatura"')
    .eq("origem", "TICKET")
    .in("fkFatura", faturaIds);

  if (error) throw error;

  for (const l of data ?? []) {
    mapa.set(l.fkFatura, (mapa.get(l.fkFatura) ?? 0) + 1);
  }
  return mapa;
}

export async function buscarPorId(empresaId: number, id: number): Promise<Fatura | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturas")
    .select(
      `${COLUNAS_FATURA}, created_at, updated_at, fkUserCriacao, fkUserModificacao, clientes(razao, nomefantasia)`,
    )
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [parcelas, tickets, historico] = await Promise.all([
    listarParcelas(id),
    listarTickets(id),
    montarHistorico(data.created_at, data.updated_at, data.fkUserCriacao, data.fkUserModificacao),
  ]);
  const proximo = parcelas.find((p) => !p.pago)?.vencimento ?? null;

  return {
    // A contagem vem da lista que ja foi buscada, e nao de outra consulta.
    ...paraDominioResumo(
      data,
      proximo,
      tickets.length,
      parcelas.filter((p) => p.pago).reduce((s, p) => s + p.total, 0),
    ),
    observacoes: data.observacoes,
    rodape: data.rodape,
    parcelas,
    tickets,
    historico,
  };
}

/**
 * Quanto de cada ticket ainda esta em aberto, direto da view.
 *
 * A tela ja mostra o saldo, mas o valor que chega no POST vem do navegador e
 * pode estar velho: outra fatura pode ter consumido o ticket enquanto a tela
 * estava aberta. Quem decide e esta consulta, no momento de gravar.
 */
export async function saldoDosTickets(
  empresaId: number,
  ids: number[],
): Promise<Map<number, { numero: string; saldo: Centavos; cancelado: boolean }>> {
  const mapa = new Map<number, { numero: string; saldo: Centavos; cancelado: boolean }>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("vw_origens_faturamento")
    .select("origem_id, descricao, saldo, cancelada")
    .eq("tipo", "TICKET")
    .eq("empresa_id", empresaId)
    .in("origem_id", ids);

  if (error) throw error;

  for (const l of data ?? []) {
    mapa.set(l.origem_id, {
      // A view nao traz o numero por tenant; `descricao` e o rotulo que ela ja
      // monta para a tela de faturamento.
      numero: l.descricao ?? String(l.origem_id),
      saldo: doBanco(l.saldo ?? 0),
      cancelado: l.cancelada ?? false,
    });
  }
  return mapa;
}

/**
 * Tickets que originaram esta conta a receber.
 *
 * E o que a tela mostra no lugar da lista de servicos: no modelo novo o servico
 * vive no ticket, e a conta a receber e composta por VALOR de um ou mais deles.
 */
export async function listarTickets(faturaId: number): Promise<TicketDaFatura[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasorigens")
    .select("valor, fkOrdem, ordensservico!inner(id, idtenant, titulo, status, datafim, clientes(razao, nomefantasia))")
    .eq("fkFatura", faturaId)
    .eq("origem", "TICKET")
    .order("fkOrdem", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((l) => {
    const t = l.ordensservico as unknown as {
      id: number;
      idtenant: number | null;
      titulo: string | null;
      status: string | null;
      datafim: string | null;
      clientes: { razao: string | null; nomefantasia: string | null } | null;
    };

    return {
      ticketId: t.id,
      numero: t.idtenant ?? t.id,
      valor: doBanco(l.valor),
      titulo: (t.titulo ?? "").trim(),
      status: (t.status ?? "").trim() || "—",
      clienteNome: primeiroPreenchido(t.clientes?.nomefantasia, t.clientes?.razao),
      encerradoEm: t.datafim ? ((t.datafim.slice(0, 10)) as DataISO) : null,
    };
  });
}

/**
 * Nomes de quem criou e de quem editou por ultimo.
 *
 * Uma consulta so para os dois: quando criacao e edicao sao da mesma pessoa —
 * o caso comum — nem ha segunda ida ao banco.
 */
async function montarHistorico(
  criadoEm: string | null,
  editadoEm: string | null,
  criadoPor: string | null,
  editadoPor: string | null,
): Promise<Historico> {
  const ids = [criadoPor, editadoPor].filter((i): i is string => i != null);

  if (ids.length === 0) {
    return { criadoEm, criadoPor: null, editadoEm, editadoPor: null };
  }

  const supabase = await serverClient();
  const { data } = await supabase
    .from("usuarios")
    .select("fkUser, nome")
    .in("fkUser", Array.from(new Set(ids)));

  const nomes = new Map((data ?? []).map((u) => [u.fkUser, u.nome]));

  return {
    criadoEm,
    criadoPor: criadoPor ? (nomes.get(criadoPor) ?? null) : null,
    editadoEm,
    editadoPor: editadoPor ? (nomes.get(editadoPor) ?? null) : null,
  };
}


export async function listarParcelas(faturaId: number): Promise<ParcelaFatura[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasparcelas")
    .select(
      "id, numeroparcela, vencimento, valor, acrescimo, desconto, total, pago, fkPagamento, nfs, boleto",
    )
    .eq("fkFatura", faturaId)
    .order("numeroparcela", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id,
    numero: l.numeroparcela ?? 0,
    vencimento: l.vencimento ? ((l.vencimento.slice(0, 10)) as DataISO) : null,
    valor: doBanco(l.valor),
    acrescimo: doBanco(l.acrescimo),
    desconto: doBanco(l.desconto),
    // `total` pode vir nulo em registro antigo; nesse caso o valor e a verdade.
    total: l.total == null ? doBanco(l.valor) : doBanco(l.total),
    pago: l.pago ?? false,
    pagamentoId: l.fkPagamento,
    nfs: l.nfs,
    boleto: l.boleto,
  }));
}

/** Totais por situacao — alimenta os indicadores do topo da listagem. */
export async function resumoPorSituacao(
  empresaId: number,
): Promise<{ status: StatusFatura; cancelada: boolean; total: Centavos }[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturas")
    .select("status, cancelada, total")
    .eq("fkEmpresa", empresaId);

  if (error) throw error;

  return (data ?? []).map((l) => ({
    status: normalizarStatus(l.status),
    cancelada: l.cancelada ?? false,
    total: doBanco(l.total),
  }));
}

// ── Escrita ─────────────────────────────────────────────────────────────────

export type EntradaCriar = {
  empresaId: number;
  usuarioId: string;
  clienteId: number;
  apuracaoInicio: DataISO;
  apuracaoFim: DataISO;
  status: StatusFatura;
  total: Centavos;
  observacoes: string | null;
  rodape: string | null;
  origens: OrigemNova[];
  parcelas: Parcela[];
};

/**
 * Cria fatura, itens e parcelas.
 *
 * ⚠️ Tres chamadas sem transacao — limitacao do PostgREST, que nao expoe
 * transacao entre requisicoes. A correcao planejada e a RPC
 * `criar_fatura(payload jsonb)` (docs/04 §2). Ate la: inserts em LOTE (o legado
 * fazia um por vez) e compensacao manual se um filho falhar.
 */
export async function criar(entrada: EntradaCriar): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturas")
    .insert({
      fkEmpresa: entrada.empresaId,
      fkUserCriacao: entrada.usuarioId,
      fkCliente: entrada.clienteId,
      dataInicio: entrada.apuracaoInicio,
      dataFim: entrada.apuracaoFim,
      status: entrada.status,
      cancelada: false,
      total: paraBanco(entrada.total),
      observacoes: entrada.observacoes ?? "",
      rodape: entrada.rodape ?? "",
      parcelas: entrada.parcelas.length,
    })
    .select("id")
    .single();

  if (error) throw error;
  const faturaId = data.id;

  try {
    /*
     * `faturasorigens` e o que baixa o saldo do ticket.
     *
     * Vai ANTES das parcelas de proposito: se ela falhar, o `catch` apaga a
     * fatura inteira. Gravada depois, uma falha aqui deixaria fatura com parcela
     * cobravel e ticket ainda aberto — dinheiro cobrado duas vezes.
     */
    if (entrada.origens.length > 0) {
      const { error: erroOrigens } = await supabase.from("faturasorigens").insert(
        entrada.origens.map((o) => ({
          fkFatura: faturaId,
          fkUserCriacao: entrada.usuarioId,
          origem: "TICKET",
          fkOrdem: o.ticketId,
          valor: paraBanco(o.valor),
        })),
      );
      if (erroOrigens) throw erroOrigens;
    }

    const { error: erroParcelas } = await supabase.from("faturasparcelas").insert(
      entrada.parcelas.map((p) => ({
        fkFatura: faturaId,
        fkUserCriacao: entrada.usuarioId,
        numeroparcela: p.numero,
        vencimento: p.vencimento,
        valor: paraBanco(p.valor),
        total: paraBanco(p.valor),
        pago: false,
      })),
    );
    if (erroParcelas) throw erroParcelas;

    return faturaId;
  } catch (err) {
    // Sem transacao, compensacao manual: melhor apagar o cabecalho do que
    // deixar fatura sem parcelas no banco.
    await supabase.from("faturas").delete().eq("id", faturaId);
    throw err;
  }
}

export async function atualizarStatus(
  empresaId: number,
  faturaId: number,
  status: StatusFatura,
  usuarioId: string,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("faturas")
    .update({
      status,
      fkUserModificacao: usuarioId,
      updated_at: new Date().toISOString(),
    })
    .eq("fkEmpresa", empresaId)
    .eq("id", faturaId);

  if (error) throw error;
}

export async function definirCancelada(
  empresaId: number,
  faturaId: number,
  cancelada: boolean,
  usuarioId: string,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("faturas")
    .update({ cancelada, fkUserModificacao: usuarioId, updated_at: new Date().toISOString() })
    .eq("fkEmpresa", empresaId)
    .eq("id", faturaId);

  if (error) throw error;
}

export async function substituirParcelas(
  faturaId: number,
  usuarioId: string,
  parcelas: Parcela[],
): Promise<void> {
  const supabase = await serverClient();

  const { error: erroDelete } = await supabase
    .from("faturasparcelas")
    .delete()
    .eq("fkFatura", faturaId)
    .eq("pago", false);
  if (erroDelete) throw erroDelete;

  const { error } = await supabase.from("faturasparcelas").insert(
    parcelas.map((p) => ({
      fkFatura: faturaId,
      fkUserCriacao: usuarioId,
      numeroparcela: p.numero,
      vencimento: p.vencimento,
      valor: paraBanco(p.valor),
      total: paraBanco(p.valor),
      pago: false,
    })),
  );
  if (error) throw error;
}

// ── Traducao linha -> dominio ───────────────────────────────────────────────

type LinhaFatura = {
  id: number;
  fkCliente: number | null;
  dataInicio: string | null;
  dataFim: string | null;
  status: string | null;
  cancelada: boolean | null;
  total: number | null;
  observacoes: string | null;
  rodape: string | null;
  parcelas: number | null;
  clientes?: unknown;
};

function paraDominioResumo(
  linha: LinhaFatura,
  proximoVencimento: DataISO | null,
  qtdTickets = 0,
  pago = 0,
): FaturaResumo {
  const cliente = linha.clientes as { razao: string | null; nomefantasia: string | null } | null;
  const status = normalizarStatus(linha.status);
  const cancelada = linha.cancelada ?? false;

  return {
    id: linha.id,
    numero: linha.id,
    clienteId: linha.fkCliente,
    clienteNome: primeiroPreenchido(cliente?.nomefantasia, cliente?.razao),
    apuracaoInicio: linha.dataInicio ? ((linha.dataInicio.slice(0, 10)) as DataISO) : null,
    apuracaoFim: linha.dataFim ? ((linha.dataFim.slice(0, 10)) as DataISO) : null,
    proximoVencimento,
    status,
    cancelada,
    // `cancelada` e coluna separada do status no banco. Na tela vira uma
    // situacao unica, porque e assim que o usuario pensa.
    situacao: (cancelada ? "CANCELADA" : status) as SituacaoFatura,
    total: doBanco(linha.total),
    qtdParcelas: linha.parcelas ?? 0,
    qtdTickets,
    pago: doBanco(pago),
  };
}

function normalizarStatus(bruto: string | null): StatusFatura {
  const s = (bruto ?? "").trim().toUpperCase();
  return (STATUS_FATURA as readonly string[]).includes(s) ? (s as StatusFatura) : "ABERTA";
}

/** Guarda no registro a referencia do documento — caminho, nunca URL assinada. */
export async function gravarDocumentoDaParcela(
  parcelaId: number,
  usuarioId: string,
  tipo: "nfs" | "boleto",
  referencia: string | null,
): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("faturasparcelas")
    /*
     * Campos montados a mao e nao por chave dinamica: `{ [tipo]: ... }` faz o
     * TypeScript perder o nome da coluna e o tipo gerado do Supabase recusa o
     * objeto inteiro.
     */
    .update({
      ...(tipo === "nfs" ? { nfs: referencia } : { boleto: referencia }),
      updated_at: new Date().toISOString(),
      fkUserModificacao: usuarioId,
    })
    .eq("id", parcelaId);

  if (error) throw error;
}

/**
 * Para quem mandar, e em nome de quem.
 *
 * Duas consultas curtas em vez de embutir nos `select` da fatura: e dado que so
 * o envio usa, e carregar em toda abertura de conta pagaria dois joins por
 * nada.
 */
export async function destinatarioDaFatura(
  empresaId: number,
  clienteId: number | null,
): Promise<{ email: string | null; clienteNome: string | null; empresaNome: string }> {
  const supabase = await serverClient();

  const [cliente, empresa] = await Promise.all([
    clienteId == null
      ? Promise.resolve(null)
      : supabase
          .from("clientes")
          .select("email, razao, nomefantasia")
          .eq("id", clienteId)
          .maybeSingle(),
    supabase.from("empresas").select("nome, fantasia, razaosocial").eq("id", empresaId).maybeSingle(),
  ]);

  if (cliente?.error) throw cliente.error;
  if (empresa.error) throw empresa.error;

  return {
    email: (cliente?.data?.email ?? "").trim() || null,
    clienteNome: primeiroPreenchido(
      cliente?.data?.nomefantasia,
      cliente?.data?.razao,
    ),
    // `nome` primeiro: e o apelido curto que a empresa usa no dia a dia, e o
    // que o cliente reconhece no assunto do e-mail.
    empresaNome:
      primeiroPreenchido(
        empresa.data?.nome,
        empresa.data?.fantasia,
        empresa.data?.razaosocial,
      ) ?? "",
  };
}

/**
 * O token do link publico da parcela.
 *
 * Gerado no primeiro envio e REAPROVEITADO nos seguintes: token novo a cada
 * envio invalidaria o link anterior, e o cliente que guardou o primeiro e-mail
 * cairia num 404 sem entender por que.
 */
export async function tokenDaParcela(parcelaId: number): Promise<string> {
  const supabase = await serverClient();

  const { data: atual, error: erroLeitura } = await supabase
    .from("faturasparcelas")
    .select("token")
    .eq("id", parcelaId)
    .maybeSingle();

  if (erroLeitura) throw erroLeitura;
  if (atual?.token) return atual.token;

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("faturasparcelas")
    .update({ token })
    .eq("id", parcelaId);

  if (error) throw error;
  return token;
}
