import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, somar, subtrair, ZERO, type Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { intervalo, type Paginacao, type Pagina } from "@/shared/utils/paginacao";
import type { Parcela } from "@/shared/domain/parcelas";
import { nomeDaConta } from "@/shared/domain/conta-bancaria";
import type {
  AnexoDaConta,
  BaixaNova,
  BaixaPagar,
  BaixaPagarResumo,
  CartaoDaBaixa,
  CartaoNovo,
  BancoDaLista,
  FaturaDeCartao,
  DestinoDaBaixa,
  ContaPagarNova,
  ContaPagarResumo,
  FiltroBaixas,
  FiltroContas,
  IndicadoresDeBaixaPagar,
  LancamentoComNome,
  LancamentoDaConta,
  OrigemDaConta,
  ParcelaAPagar,
  TipoDeDocumento,
  TipoDeOrigem,
} from "@/modules/contas-pagar/contas-pagar.types";
import { rateioDosLancamentos } from "@/modules/contas-pagar/contas-pagar.types";

/** Unica porta de acesso aos dados de contas a pagar. */

const COLUNAS =
  "id, numero, descricao, fkFornecedor, data, total, pago, cancelada, suspensa, fkStatus";

export async function listar(
  empresaId: number,
  filtro: FiltroContas,
  paginacao: Paginacao,
): Promise<Pagina<ContaPagarResumo>> {
  const supabase = await serverClient();
  const [de, ate] = intervalo(paginacao);

  let query = supabase
    .from("contaspagar")
    .select(`${COLUNAS}, clientes(razao, nomefantasia)`, { count: "exact" })
    .eq("fkEmpresa", empresaId);

  if (!filtro.incluirCanceladas) query = query.eq("cancelada", false);
  if (filtro.fornecedorId) query = query.eq("fkFornecedor", filtro.fornecedorId);

  const { data, error, count } = await query.order("id", { ascending: false }).range(de, ate);
  if (error) throw error;

  const linhas = data ?? [];
  const parcelas = await resumoDeParcelas(linhas.map((l) => l.id));

  return {
    itens: linhas.map((l) => paraDominio(l, parcelas.get(l.id))),
    total: count ?? 0,
  };
}

type ResumoParcelas = {
  qtd: number;
  pagas: number;
  proximo: DataISO | null;
  /** Quanto das parcelas ja foi pago, para o cartao do quadro. */
  valorPago: Centavos;
  /**
   * Todo o dinheiro que saiu ja foi conferido no extrato.
   *
   * ⚠️ Comeca `true` e so cai para `false` quando aparece uma parcela paga sem
   * conferencia. Conta sem nenhuma parcela paga nao tem o que conferir, e
   * `quitada` e testado antes de `conciliada` em `situacaoDaConta`, entao o
   * `true` inicial nunca vira BAIXADA sozinho.
   */
  conciliada: boolean;
};

/** Quais dos pagamentos ja foram conferidos no extrato. */
async function pagamentosConciliados(ids: (number | null)[]): Promise<Set<number>> {
  const alvos = [...new Set(ids.filter((i): i is number => i != null))];
  if (alvos.length === 0) return new Set();

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("pagamentos")
    .select("id, conciliado")
    .in("id", alvos)
    .eq("conciliado", true);

  if (error) throw error;
  return new Set((data ?? []).map((p) => p.id));
}

/**
 * Parcelas de todas as contas da pagina numa consulta so.
 *
 * O legado buscava conta a conta dentro do laco de renderizacao — 25 linhas na
 * tela viravam 25 idas ao banco.
 */
async function resumoDeParcelas(contaIds: number[]): Promise<Map<number, ResumoParcelas>> {
  const mapa = new Map<number, ResumoParcelas>();
  if (contaIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("contaspagarparcelas")
    .select("fkContaPagar, vencimento, pago, valor, total, fkPagamento")
    .in("fkContaPagar", contaIds)
    .order("vencimento", { ascending: true });

  if (error) throw error;

  /*
   * A conferencia do extrato vem em consulta PROPRIA, e nao por embed.
   *
   * `database.types.ts` e escrito a mao e declara `Relationships: []`, entao o
   * cliente do Supabase nao resolve o vinculo parcela -> pagamento e o resultado
   * inteiro perde o tipo. Uma consulta a mais por pagina e barata.
   */
  const conciliados = await pagamentosConciliados(
    (data ?? []).map((l) => l.fkPagamento),
  );

  for (const linha of data ?? []) {
    const id = linha.fkContaPagar;
    if (id == null) continue;

    const atual = mapa.get(id) ?? {
      qtd: 0,
      pagas: 0,
      proximo: null,
      valorPago: ZERO,
      conciliada: true,
    };
    atual.qtd += 1;

    if (linha.pago) {
      atual.pagas += 1;
      // `total` manda e `valor` cobre a parcela antiga que nasceu sem total —
      // a mesma regra de `devido_da_parcela`, que o gatilho usa.
      atual.valorPago = somar(
        atual.valorPago,
        linha.total == null ? doBanco(linha.valor) : doBanco(linha.total),
      );

      if (linha.fkPagamento == null || !conciliados.has(linha.fkPagamento)) {
        atual.conciliada = false;
      }
    }
    // Ordenado por vencimento: a primeira em aberto e a mais proxima.
    else if (!atual.proximo && linha.vencimento) {
      atual.proximo = linha.vencimento.slice(0, 10) as DataISO;
    }
    mapa.set(id, atual);
  }
  return mapa;
}

type Linha = {
  id: number;
  numero?: number | null;
  descricao: string | null;
  fkFornecedor: number | null;
  data: string | null;
  total: number | null;
  pago: boolean | null;
  cancelada: boolean | null;
  suspensa?: boolean | null;
  clientes?: unknown;
};

function paraDominio(linha: Linha, parcelas?: ResumoParcelas): ContaPagarResumo {
  const fornecedor = linha.clientes as { razao: string | null; nomefantasia: string | null } | null;

  return {
    id: linha.id,
    numero: linha.numero ?? null,
    descricao: linha.descricao ?? "",
    fornecedorId: linha.fkFornecedor,
    fornecedorNome: primeiroPreenchido(fornecedor?.nomefantasia, fornecedor?.razao),
    emissao: linha.data ? ((linha.data.slice(0, 10)) as DataISO) : null,
    proximoVencimento: parcelas?.proximo ?? null,
    total: doBanco(linha.total),
    pago: linha.pago ?? false,
    valorPago: parcelas?.valorPago ?? ZERO,
    suspensa: linha.suspensa ?? false,
    conciliada: parcelas?.conciliada ?? false,
    cancelada: linha.cancelada ?? false,
    qtdParcelas: parcelas?.qtd ?? 0,
    parcelasPagas: parcelas?.pagas ?? 0,
  };
}

export type ParcelaConta = {
  id: number;
  numero: number;
  vencimento: DataISO | null;
  valor: Centavos;
  acrescimo: Centavos;
  desconto: Centavos;
  total: Centavos;
  pago: boolean;
  /** O dinheiro desta parcela ja bateu no extrato. */
  conciliado: boolean;
  nfs: string | null;
  boleto: string | null;
  /** A prova de que o dinheiro saiu. */
  comprovante: string | null;
};

export type ContaPagarDetalhe = ContaPagarResumo & {
  observacoes: string | null;
  fornecedorDoc: string | null;
  documento: string | null;
  tipoDocumentoId: number | null;
  /** A sigla resolvida, para a tela escrever "NFS-e 1234" sem outra consulta. */
  tipoDocumentoSigla: string | null;
  centroCustoId: number | null;
  centroCustoNome: string | null;
  parcelas: ParcelaConta[];
  anexos: AnexoDaConta[];
  lancamentos: LancamentoComNome[];
  rateio: { centroCustoId: number | null; centroCustoNome: string | null; valor: number }[];
  origens: OrigemDaConta[];
};

export async function buscarPorId(
  empresaId: number,
  id: number,
): Promise<ContaPagarDetalhe | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagar")
    .select(
      `${COLUNAS}, observacoes, documento, fkTipoDocumento, fkCentroCusto, clientes(razao, nomefantasia, cnpj)`,
    )
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  /*
   * O nome do centro vem em consulta PROPRIA, e nao por embed.
   *
   * `database.types.ts` e escrito a mao e declara `Relationships: []` em todas
   * as tabelas, entao o cliente do Supabase nao resolve o vinculo
   * contaspagar -> centrodecusto e o resultado inteiro perde o tipo. Uma
   * consulta a mais na abertura de um drawer e barata; perder o tipo do detalhe
   * inteiro nao e.
   */
  const [parcelas, anexos, centro, tipos, lancamentos, origens] = await Promise.all([
    listarParcelas(id),
    listarAnexos(id),
    nomeDoCentro(data.fkCentroCusto),
    listarTiposDeDocumento(),
    listarLancamentos(id),
    listarOrigens(id),
  ]);

  const tipo = tipos.find((t) => t.id === data.fkTipoDocumento);
  const resumo = paraDominio(data, {
    qtd: parcelas.length,
    pagas: parcelas.filter((p) => p.pago).length,
    proximo: parcelas.find((p) => !p.pago)?.vencimento ?? null,
    valorPago: parcelas
      .filter((p) => p.pago)
      .reduce<Centavos>((s, p) => somar(s, p.total), ZERO),
    conciliada: parcelas.filter((p) => p.pago).every((p) => p.conciliado),
  });

  return {
    ...resumo,
    observacoes: data.observacoes,
    // O documento do fornecedor: e o que se confere quando dois nomes parecidos
    // disputam a mesma conta, e o que vai para o comprovante.
    fornecedorDoc:
      (data.clientes as unknown as { cnpj: string | null } | null)?.cnpj ?? null,
    documento: data.documento,
    tipoDocumentoId: data.fkTipoDocumento,
    tipoDocumentoSigla: tipo?.sigla ?? null,
    centroCustoId: data.fkCentroCusto,
    centroCustoNome: centro,
    parcelas,
    anexos,
    lancamentos,
    // O rateio nao e lido do banco: ele e o agrupamento das linhas por centro.
    rateio: rateioDosLancamentos(lancamentos),
    origens,
  };
}

async function nomeDoCentro(centroId: number | null): Promise<string | null> {
  if (centroId == null) return null;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("centrodecusto")
    .select("descricao")
    .eq("id", centroId)
    .maybeSingle();

  // A RLS ja limita ao tenant: centro de outra empresa volta vazio, e nao erro.
  if (error) throw error;
  return data?.descricao ?? null;
}

export async function listarParcelas(contaId: number): Promise<ParcelaConta[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagarparcelas")
    .select(
      "id, numeroparcela, vencimento, valor, acrescimo, desconto, total, pago, nfs, boleto, comprovante, fkPagamento",
    )
    .eq("fkContaPagar", contaId)
    .order("numeroparcela", { ascending: true });

  if (error) throw error;

  const conciliados = await pagamentosConciliados((data ?? []).map((l) => l.fkPagamento));

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
    conciliado: l.fkPagamento != null && conciliados.has(l.fkPagamento),
    nfs: l.nfs,
    boleto: l.boleto,
    comprovante: l.comprovante,
  }));
}

/**
 * Grava (ou limpa) a referencia de um documento da parcela.
 *
 * ⚠️ O nome da coluna vem de um conjunto FECHADO, e nao do que a rota mandar:
 * `tipo` chega da query string, e interpolar isso num update deixaria a borda
 * escolher qual coluna escrever.
 */
export async function gravarDocumentoDaParcela(
  parcelaId: number,
  usuarioId: string,
  tipo: "nfs" | "boleto" | "comprovante",
  caminho: string | null,
): Promise<void> {
  const supabase = await serverClient();

  /*
   * A coluna e escolhida por um objeto FIXO, e nao por chave dinamica.
   *
   * Com `[tipo]: caminho`, o tipo do update vira um indice generico e o cliente
   * do Supabase perde a checagem da coluna — passaria qualquer nome. Aqui as
   * tres possibilidades estao escritas, e o compilador confere cada uma.
   */
  const mudanca =
    tipo === "nfs"
      ? { nfs: caminho }
      : tipo === "boleto"
        ? { boleto: caminho }
        : { comprovante: caminho };

  const { error } = await supabase
    .from("contaspagarparcelas")
    .update({
      ...mudanca,
      fkUserModificacao: usuarioId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parcelaId);

  if (error) throw error;
}

// ── Baixas ──────────────────────────────────────────────────────────────────

/*
 * ⚠️ "Despesas", exatamente assim, e o espelho de "Receitas" do outro lado.
 *
 * A view `vwsaldo` decide o saldo de cada conta bancaria com
 * `case when natureza ilike 'Receitas' then +valor when 'Despesas' then -valor
 * else 0 end`. Qualquer outra palavra cai no ELSE e o dinheiro sai valendo ZERO
 * no saldo — sem erro, sem aviso, so um saldo maior que o extrato.
 */
const DESPESA = "Despesas";

/**
 * ⚠️ Literal, nunca concatenada: o supabase-js interpreta a string do `select`
 * em tempo de tipo, e montada com `+` o resultado inteiro perde o tipo.
 */
const CAMPOS_BAIXA =
  "id, data, tipo, valor, conciliado, descricao, contasbancarias(apelido, banco, conta), contaspagarparcelas!inner(id, fkContaPagar, contaspagar(numero, clientes(razao, nomefantasia)))";

/**
 * O dinheiro que saiu para quitar conta a pagar.
 *
 * ⚠️ O que define uma baixa aqui e a PARCELA APONTAR para o pagamento
 * (`contaspagarparcelas.fkPagamento`), e nao haver linha em
 * `pagamentosxparcelaspagar`.
 *
 * O criterio do outro lado e o rateio, e copia-lo aqui abriria a tela vazia: o
 * rateio e novo e tem zero linhas, enquanto 171 baixas reais, feitas pelo
 * legado, so existem por este vinculo. Ele tambem vale para as baixas novas — o
 * gatilho `recalcula_baixa_da_parcela_pagar` grava `fkPagamento` sempre que
 * escreve rateio.
 *
 * ⚠️ O furo conhecido: a parcela guarda so o ULTIMO pagamento. Duas baixas
 * parciais sobre a mesma parcela fariam a primeira sumir desta lista. Nao existe
 * nenhum caso assim hoje, e a saida definitiva e o rateio virar fonte unica.
 *
 * As demais despesas — 466 das 637 — sao gasto direto, sem titulo, e o lugar
 * delas e o extrato.
 */
export async function listarBaixas(
  empresaId: number,
  filtro: FiltroBaixas,
  paginacao: Paginacao,
): Promise<Pagina<BaixaPagarResumo>> {
  const supabase = await serverClient();
  const [de, ate] = intervalo(paginacao);

  let query = supabase
    .from("pagamentos")
    .select(CAMPOS_BAIXA, { count: "exact" })
    .eq("fkEmpresa", empresaId)
    .ilike("natureza", DESPESA);

  if (filtro.de) query = query.gte("data", filtro.de);
  if (filtro.ate) query = query.lte("data", filtro.ate);

  const { data, error, count } = await query
    .order("data", { ascending: false })
    .order("id", { ascending: false })
    .range(de, ate);

  if (error) throw error;

  return { itens: (data ?? []).map(paraBaixa), total: count ?? 0 };
}

/**
 * Uma baixa e as parcelas que ela quitou.
 *
 * ⚠️ Duas consultas para o rateio, e nao um embed. As parcelas vem pelo vinculo
 * do legado (`fkPagamento`), e o valor aplicado vem de
 * `pagamentosxparcelaspagar` quando existe. Nas 171 baixas antigas o rateio nao
 * existe, e ai o valor aplicado e o proprio total da parcela — que e o que o
 * legado gravou, porque ele sobrescrevia o total com o que foi pago.
 */
export async function buscarBaixaPorId(
  empresaId: number,
  id: number,
): Promise<BaixaPagar | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .select(`${CAMPOS_BAIXA}, observacoes, created_at`)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .ilike("natureza", DESPESA)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [parcelas, rateio] = await Promise.all([
    supabase
      .from("contaspagarparcelas")
      .select("id, numeroparcela, vencimento, valor, total, fkContaPagar")
      .eq("fkPagamento", id)
      .order("numeroparcela", { ascending: true }),
    supabase.from("pagamentosxparcelaspagar").select("fkParcela, valor").eq("fkPagamento", id),
  ]);

  if (parcelas.error) throw parcelas.error;
  if (rateio.error) throw rateio.error;

  const aplicado = new Map((rateio.data ?? []).map((r) => [r.fkParcela, doBanco(r.valor)]));
  const contas = await contasDasParcelas((parcelas.data ?? []).map((p) => p.fkContaPagar));

  const destinos: DestinoDaBaixa[] = (parcelas.data ?? []).map((p) => {
    const total = p.total == null ? doBanco(p.valor) : doBanco(p.total);
    const conta = p.fkContaPagar == null ? undefined : contas.get(p.fkContaPagar);

    return {
      parcelaId: p.id,
      contaId: p.fkContaPagar ?? 0,
      contaNumero: conta?.numero ?? null,
      contaDescricao: conta?.descricao ?? null,
      numero: p.numeroparcela ?? 0,
      vencimento: p.vencimento ? ((p.vencimento.slice(0, 10)) as DataISO) : null,
      total,
      valor: aplicado.get(p.id) ?? total,
    };
  });

  return {
    ...paraBaixa(data),
    observacoes: data.observacoes,
    registradoEm: data.created_at,
    destinos,
  };
}

async function contasDasParcelas(
  contaIds: (number | null)[],
): Promise<Map<number, { numero: number | null; descricao: string | null }>> {
  const ids = [...new Set(contaIds.filter((i): i is number => i != null))];
  const mapa = new Map<number, { numero: number | null; descricao: string | null }>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("contaspagar")
    .select("id, numero, descricao")
    .in("id", ids);

  if (error) throw error;
  for (const c of data ?? []) mapa.set(c.id, { numero: c.numero, descricao: c.descricao });
  return mapa;
}

/**
 * Os numeros dos cartoes do topo, sobre TUDO e nao sobre a pagina.
 *
 * ⚠️ Tres consultas, e nao uma. A serie mensal precisa da janela inteira; "a
 * conciliar" e o total precisam de qualquer epoca, porque uma baixa de marco que
 * ninguem conferiu continua sendo trabalho pendente hoje. Uma consulta so teria
 * de trazer o historico inteiro para responder as tres.
 *
 * ⚠️ O `contaspagarparcelas!inner` fica em todas: e o mesmo recorte da listagem
 * — despesa que quitou parcela e o que e baixa —, e sem ele os cartoes contariam
 * as 466 despesas diretas e nunca bateriam com a tabela logo abaixo.
 */
export async function indicadoresDeBaixas(
  empresaId: number,
  desdeMes: string,
  ateMes: string,
): Promise<IndicadoresDeBaixaPagar> {
  const supabase = await serverClient();

  const [janela, pendentes, total] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("id, data, valor, tipo, conciliado, contaspagarparcelas!inner(id)")
      .eq("fkEmpresa", empresaId)
      .ilike("natureza", DESPESA)
      .gte("data", `${desdeMes}-01`),
    supabase
      .from("pagamentos")
      .select("id, valor, contaspagarparcelas!inner(id)")
      .eq("fkEmpresa", empresaId)
      .ilike("natureza", DESPESA)
      .eq("conciliado", false),
    supabase
      .from("pagamentos")
      .select("id, contaspagarparcelas!inner(id)", { count: "exact", head: true })
      .eq("fkEmpresa", empresaId)
      .ilike("natureza", DESPESA),
  ]);

  if (janela.error) throw janela.error;
  if (pendentes.error) throw pendentes.error;
  if (total.error) throw total.error;

  const porMes = new Map<string, { valor: Centavos; qtd: number }>();
  const porForma = new Map<string, Centavos>();

  for (const l of janela.data ?? []) {
    const valor = doBanco(l.valor);
    const mes = l.data ? l.data.slice(0, 7) : null;

    if (mes) {
      const atual = porMes.get(mes) ?? { valor: ZERO, qtd: 0 };
      porMes.set(mes, { valor: somar(atual.valor, valor), qtd: atual.qtd + 1 });
    }

    // Sem forma preenchida vira "Outros": o legado tem lancamento antigo com o
    // campo vazio, e uma fatia sem nome nao se explica.
    const tipo = l.tipo?.trim() || "Outros";
    porForma.set(tipo, somar(porForma.get(tipo) ?? ZERO, valor));
  }

  return {
    /*
     * ⚠️ A serie sai COMPLETA, com o mes vazio valendo zero. Montada so com os
     * meses que tem lancamento, ela pula o mes parado — e o cartao passa a
     * comparar maio com marco escrevendo "mes passado".
     */
    meses: mesesEntre(desdeMes, ateMes).map((mes) => ({
      mes,
      valor: porMes.get(mes)?.valor ?? ZERO,
      qtd: porMes.get(mes)?.qtd ?? 0,
    })),
    aConciliar: {
      valor: (pendentes.data ?? []).reduce<Centavos>((s, l) => somar(s, doBanco(l.valor)), ZERO),
      qtd: (pendentes.data ?? []).length,
    },
    totalDeBaixas: total.count ?? 0,
    porForma: [...porForma.entries()]
      .map(([tipo, valor]) => ({ tipo, valor }))
      .sort((a, b) => b.valor - a.valor),
  };
}

/**
 * Todo mes de "AAAA-MM" ate "AAAA-MM", inclusive.
 *
 * ⚠️ Sobre a string, e nao sobre `Date`: passando pelo objeto, o fuso do
 * servidor empurra o primeiro dia do mes para o mes anterior.
 */
function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = [];
  const [anoDe, mesDe] = de.split("-").map(Number);
  const [anoAte, mesAte] = ate.split("-").map(Number);

  for (let n = anoDe * 12 + (mesDe - 1); n <= anoAte * 12 + (mesAte - 1); n++) {
    meses.push(`${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`);
  }
  return meses;
}

type LinhaBaixa = {
  id: number;
  data: string | null;
  tipo: string | null;
  valor: number | null;
  conciliado: boolean | null;
  descricao: string | null;
  contasbancarias: unknown;
  contaspagarparcelas: unknown;
};

function paraBaixa(linha: LinhaBaixa): BaixaPagarResumo {
  const conta = linha.contasbancarias as {
    apelido: string | null;
    banco: string | null;
    conta: string | null;
  } | null;

  const parcelas = (linha.contaspagarparcelas ?? []) as {
    id: number;
    fkContaPagar: number | null;
    contaspagar: { numero: number | null; clientes: unknown } | null;
  }[];

  const nomes = [
    ...new Set(
      parcelas
        .map((p) => {
          const f = p.contaspagar?.clientes as {
            razao: string | null;
            nomefantasia: string | null;
          } | null;
          return primeiroPreenchido(f?.nomefantasia, f?.razao);
        })
        .filter(Boolean),
    ),
  ] as string[];

  return {
    id: linha.id,
    data: linha.data ? ((linha.data.slice(0, 10)) as DataISO) : null,
    tipo: linha.tipo,
    valor: doBanco(linha.valor),
    // Um pagamento e de UM recebedor. Mais de um nome aqui so aconteceria com
    // dado herdado torto, e mostrar o primeiro e melhor que mostrar vazio.
    fornecedorNome: nomes[0] ?? null,
    contaNome: nomeDaConta(conta ?? {}) || null,
    conciliado: linha.conciliado ?? false,
    descricao: linha.descricao,
    qtdParcelas: parcelas.length,
    qtdContas: new Set(parcelas.map((p) => p.fkContaPagar)).size,
  };
}

// ── Escrita ─────────────────────────────────────────────────────────────────

/**
 * O proximo numero da empresa, contado pelo BANCO.
 *
 * ⚠️ Pela RPC, e nao lendo `zsequencias` e somando um. A leitura seguida de
 * escrita da duas pessoas o mesmo numero quando cadastram junto; a RPC trava a
 * linha com `for update` e serializa. O indice unico `(fkEmpresa, numero)` e a
 * ultima linha de defesa, mas contar certo aqui evita que ela precise recusar.
 */
/**
 * As especies de documento que a empresa pode escolher.
 *
 * ⚠️ Sem filtro por empresa na consulta: quem recorta e a POLICY, que devolve os
 * do sistema (`fkEmpresa` nulo) mais os da empresa. Um `.eq("fkEmpresa", ...)`
 * aqui esconderia justamente a lista que nasce pronta.
 */
export async function listarTiposDeDocumento(): Promise<TipoDeDocumento[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("documentostipos")
    .select("id, sigla, nome, fkEmpresa")
    .eq("ativo", true)
    .order("sigla", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((t) => ({
    id: t.id,
    sigla: t.sigla,
    nome: t.nome,
    doSistema: t.fkEmpresa == null,
  }));
}

/** O tipo existe e a empresa pode usar. A RLS ja recorta; aqui so se confere. */
async function tipoDeDocumentoVisivel(tipoId: number): Promise<boolean> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("documentostipos")
    .select("id")
    .eq("id", tipoId)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

/**
 * O status com que uma conta nasce, na tabela da PROPRIA empresa.
 *
 * ⚠️ `contaspagar.fkStatus` aponta para `contaspagarstatus`, que tem `fkEmpresa`
 * — os ids nao sao globais. Hoje as quatro linhas existentes (ABERTA, PARC.
 * PAGA, PAGA, CONGELADA) sao todas da empresa 1; cravar `1` no codigo faria
 * qualquer outra empresa nascer apontando para o status de uma empresa alheia.
 *
 * Sem status cadastrado, a conta nasce com nulo. A situacao que a tela mostra
 * vem de `situacaoDaConta`, que le `pago`, `cancelada` e as parcelas, entao a
 * ausencia nao quebra nada.
 */
async function statusInicial(empresaId: number): Promise<number | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagarstatus")
    .select("id")
    .eq("fkEmpresa", empresaId)
    .eq("ativo", true)
    .order("nivel", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function proximoNumero(empresaId: number): Promise<number> {
  const supabase = await serverClient();
  const { data, error } = await supabase.rpc("get_next_seq_contaspagar", { p_empresa: empresaId });

  if (error) throw error;
  return Number(data);
}

/**
 * Confere que fornecedor e centro de custo sao da empresa de quem cadastra.
 *
 * ⚠️ A RLS nao pega isto sozinha. Ela recusa LER a linha de outra empresa, mas o
 * INSERT de `contaspagar` carrega o id como valor: gravar um `fkFornecedor`
 * alheio produz uma conta cujo tenant esta correto e cujo fornecedor aponta para
 * fora. Foi exatamente o buraco que a importacao do extrato tinha.
 */
export async function pertencemAEmpresa(
  empresaId: number,
  fornecedorId: number,
  tipoDocumentoId: number,
): Promise<{ fornecedor: boolean; tipoDocumento: boolean }> {
  const supabase = await serverClient();

  const [fornecedor, tipoDocumento] = await Promise.all([
    supabase
      .from("clientes")
      .select("id")
      .eq("fkEmpresa", empresaId)
      .eq("id", fornecedorId)
      .maybeSingle(),
    tipoDeDocumentoVisivel(tipoDocumentoId),
  ]);

  if (fornecedor.error) throw fornecedor.error;

  // O centro de custo saiu daqui: quem o confere agora e `conferirRateio`, que
  // ja precisa varrer a lista inteira e checar tipo e tenant de uma vez.
  return { fornecedor: fornecedor.data != null, tipoDocumento };
}

/**
 * Cria a conta e as parcelas.
 *
 * ⚠️ Duas chamadas sem transacao — limitacao do PostgREST, a mesma de
 * `faturas.criar`. Ate a RPC existir: insert das parcelas em LOTE (o legado
 * inseria uma por vez, e parava no meio quando uma falhava, deixando a conta com
 * metade do cronograma) e compensacao manual apagando o cabecalho.
 */
export async function criar(
  empresaId: number,
  usuarioId: string,
  numero: number,
  entrada: ContaPagarNova,
  total: Centavos,
  parcelas: Parcela[],
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagar")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      numero,
      fkFornecedor: entrada.fornecedorId,
      descricao: entrada.descricao,
      data: entrada.emissao,
      total: paraBanco(total),
      /*
       * ⚠️ `fkCentroCusto` NAO e escrito. Ele e a coluna legada; o rateio em
       * `contaspagarcentrocusto` e a verdade. Escrevendo nos dois, a conta com
       * dois centros teria de eleger um "principal" que nao significa nada, e a
       * primeira edicao do rateio deixaria os dois discordando.
       */
      documento: entrada.documento,
      fkTipoDocumento: entrada.tipoDocumentoId,
      observacoes: entrada.observacoes,
      /*
       * `pago` nasce falso e quem o move dali e o gatilho `fecha_conta_a_pagar`.
       *
       * Era a ausencia desse dono que fazia 126 contas com todas as parcelas
       * pagas continuarem aparecendo como abertas.
       */
      pago: false,
      cancelada: false,
      fkStatus: await statusInicial(empresaId),
    })
    .select("id")
    .single();

  if (error) throw error;
  const contaId = data.id;

  try {
    const { error: erroParcelas } = await supabase.from("contaspagarparcelas").insert(
      parcelas.map((p) => ({
        fkContaPagar: contaId,
        fkUserCriacao: usuarioId,
        numeroparcela: p.numero,
        vencimento: p.vencimento,
        valor: paraBanco(p.valor),
        /*
         * ⚠️ `total` nasce igual ao `valor` e NAO e reescrito na baixa.
         *
         * O legado sobrescrevia o total da parcela com o valor pago. Depois
         * disso nao havia como saber quanto a parcela valia, e estornar exigia
         * inventar o numero. O ajuste mora no vinculo, em
         * `pagamentosxparcelaspagar`, e o gatilho compara o pago contra este
         * total para decidir se a parcela quitou.
         */
        total: paraBanco(p.valor),
        acrescimo: 0,
        desconto: 0,
        pago: false,
      })),
    );
    if (erroParcelas) throw erroParcelas;

    /*
     * Rateio e origem entram DENTRO do mesmo try.
     *
     * Gravados fora dele, uma falha aqui deixaria a conta de pe sem
     * classificacao e sem procedencia — e ela ja seria cobravel. Com a
     * compensacao cobrindo os tres, ou nasce inteira ou nao nasce.
     */
    const { error: erroLancamentos } = await supabase.from("contaspagarcentrocusto").insert(
      entrada.lancamentos.map((l, i) => ({
        fkContaPagar: contaId,
        fkUserCriacao: usuarioId,
        descricao: l.descricao,
        fkCentroCusto: l.centroCustoId,
        valor: paraBanco(l.valor),
        ordem: i + 1,
      })),
    );
    if (erroLancamentos) throw erroLancamentos;

    const origem = entrada.origem ?? { tipo: "AVULSA" as const };
    const { error: erroOrigem } = await supabase.from("contaspagarorigens").insert({
      fkContaPagar: contaId,
      fkUserCriacao: usuarioId,
      origem: origem.tipo,
      fkOrdem: origem.ordemId ?? null,
      fkContrato: origem.contratoId ?? null,
      valor: paraBanco(total),
    });
    if (erroOrigem) throw erroOrigem;

    return contaId;
  } catch (err) {
    // Sem transacao, compensacao manual: melhor apagar o cabecalho do que
    // deixar conta sem parcelas, que e divida invisivel e nunca cobrada.
    await supabase.from("contaspagar").delete().eq("id", contaId);
    throw err;
  }
}

// ── Baixa: escrita ──────────────────────────────────────────────────────────

/**
 * As parcelas de um fornecedor esperando dinheiro sair, de TODAS as contas dele.
 *
 * Canceladas e suspensas ficam de fora: nao se paga o que deixou de ser devido,
 * nem o que foi posto em pausa de proposito.
 */
export async function parcelasAPagar(
  empresaId: number,
  fornecedorId: number,
): Promise<ParcelaAPagar[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagar")
    .select(
      "id, numero, descricao, contaspagarparcelas(id, numeroparcela, vencimento, valor, total, pago)",
    )
    .eq("fkEmpresa", empresaId)
    .eq("fkFornecedor", fornecedorId)
    .eq("cancelada", false)
    .eq("suspensa", false);

  if (error) throw error;

  const contas = (data ?? []) as unknown as {
    id: number;
    numero: number | null;
    descricao: string | null;
    contaspagarparcelas: {
      id: number;
      numeroparcela: number | null;
      vencimento: string | null;
      valor: number | null;
      total: number | null;
      pago: boolean | null;
    }[];
  }[];

  const parcelaIds = contas.flatMap((c) => c.contaspagarparcelas.map((p) => p.id));
  const quitados = await quitadoPorParcela(parcelaIds);

  const abertas: ParcelaAPagar[] = [];

  for (const conta of contas) {
    const todas = [...conta.contaspagarparcelas].sort(
      (a, b) => (a.numeroparcela ?? 0) - (b.numeroparcela ?? 0),
    );

    for (const p of todas) {
      if (p.pago) continue;

      const total = p.total == null ? doBanco(p.valor) : doBanco(p.total);
      const quitado = quitados.get(p.id) ?? ZERO;

      abertas.push({
        parcelaId: p.id,
        contaId: conta.id,
        contaNumero: conta.numero,
        contaDescricao: conta.descricao,
        numero: p.numeroparcela ?? 0,
        totalParcelas: todas.length,
        vencimento: p.vencimento ? ((p.vencimento.slice(0, 10)) as DataISO) : null,
        total,
        quitado,
        emAberto: subtrair(total, quitado),
        // A fila e decidida no servico, que e onde a regra de dominio mora.
        liberada: false,
      });
    }
  }

  return abertas;
}

/**
 * Quanto ja foi quitado de cada parcela: pagamento MAIS desconto.
 *
 * ⚠️ Os dois juntos, e pelo mesmo motivo que o gatilho os soma: desconto quita
 * sem passar pelo caixa. Contando so `valor`, a tela ofereceria de novo uma
 * diferenca que ja foi perdoada.
 */
async function quitadoPorParcela(parcelaIds: number[]): Promise<Map<number, Centavos>> {
  const mapa = new Map<number, Centavos>();
  if (parcelaIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("pagamentosxparcelaspagar")
    .select("fkParcela, valor, desconto")
    .in("fkParcela", parcelaIds);

  if (error) throw error;

  for (const l of data ?? []) {
    const atual = mapa.get(l.fkParcela) ?? ZERO;
    mapa.set(l.fkParcela, somar(atual, somar(doBanco(l.valor), doBanco(l.desconto))));
  }
  return mapa;
}

/** A empresa e o fornecedor de cada parcela, conferidos contra o BANCO. */
export async function donasDasParcelasAPagar(
  parcelaIds: number[],
): Promise<Map<number, { empresaId: number | null; fornecedorId: number | null; contaId: number }>> {
  const mapa = new Map<
    number,
    { empresaId: number | null; fornecedorId: number | null; contaId: number }
  >();
  if (parcelaIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("contaspagarparcelas")
    .select("id, fkContaPagar, contaspagar(fkEmpresa, fkFornecedor)")
    .in("id", parcelaIds);

  if (error) throw error;

  for (const l of (data ?? []) as unknown as {
    id: number;
    fkContaPagar: number | null;
    contaspagar: { fkEmpresa: number | null; fkFornecedor: number | null } | null;
  }[]) {
    mapa.set(l.id, {
      empresaId: l.contaspagar?.fkEmpresa ?? null,
      fornecedorId: l.contaspagar?.fkFornecedor ?? null,
      contaId: l.fkContaPagar ?? 0,
    });
  }
  return mapa;
}

/**
 * Registra UM dinheiro que saiu e reparte entre as parcelas que ele quita.
 *
 * ⚠️ O `total` da parcela NAO e tocado. Era o defeito do legado: ele
 * sobrescrevia o total com o valor pago, e depois disso nao havia como saber
 * quanto a parcela valia — estornar exigia inventar o numero. Aqui o valor
 * original sobrevive e o abatimento mora na linha do rateio.
 *
 * ⚠️ Duas chamadas sem transacao, com compensacao manual: sem o rateio, o
 * pagamento seria uma saida de caixa que nao abate divida nenhuma, e a conta
 * continuaria cobravel depois de paga.
 */
export async function criarBaixa(
  empresaId: number,
  usuarioId: string,
  entrada: BaixaNova,
  total: Centavos,
  descricao: string,
  descontos: Map<number, Centavos>,
  favorecido: string | null,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      fkContaBancaria: entrada.contaBancariaId,
      data: entrada.data,
      /*
       * ⚠️ Sem `data_credito` diferente da data: quando a empresa PAGA, o
       * dinheiro sai na hora. A defasagem existe do lado que recebe, onde a
       * adquirente segura o credito. O cartao, que e o caso em que a saida
       * realmente atrasa, nao passa por aqui: la o dinheiro so sai quando a
       * conta a pagar da fatura e paga.
       */
      data_credito: entrada.data,
      valor: paraBanco(total),
      tipo: entrada.tipo,
      natureza: DESPESA,
      descricao,
      // `nome` e o que o extrato mostra como historico. Sem ele o lancamento
      // aparece na conta bancaria sem dizer para quem foi.
      nome: favorecido,
      observacoes: entrada.observacoes?.trim() || null,
      conciliado: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  const pagamentoId = data.id;

  try {
    const { error: erroRateio } = await supabase.from("pagamentosxparcelaspagar").insert(
      entrada.destinos.map((d) => ({
        fkPagamento: pagamentoId,
        fkParcela: d.parcelaId,
        valor: paraBanco(d.valor),
        juros: paraBanco(d.juros),
        multa: paraBanco(d.multa),
        // Guardado por linha para o estorno saber o que devolver: sem isso,
        // desfazer a baixa apagaria o dinheiro que saiu e deixaria a divida
        // perdoada perdida.
        desconto: paraBanco(descontos.get(d.parcelaId) ?? ZERO),
        fkUserCriacao: usuarioId,
      })),
    );
    if (erroRateio) throw erroRateio;
  } catch (erro) {
    await supabase.from("pagamentos").delete().eq("id", pagamentoId);
    throw erro;
  }

  return pagamentoId;
}

/**
 * O centro de custo de cada parcela, pela conta a que ela pertence.
 *
 * ⚠️ Pega o centro do PRIMEIRO lancamento da conta, e nao de todos. A linha da
 * fatura e uma so por parcela: com a conta rateada entre dois centros, repartir
 * a linha do cartao tambem duplicaria o mesmo valor em dois lugares — a conta a
 * pagar ja fez o rateio, e a fatura e so o espelho financeiro dela.
 */
export async function centroDeCustoDasParcelas(
  parcelaIds: number[],
): Promise<Map<number, number | null>> {
  const mapa = new Map<number, number | null>();
  if (parcelaIds.length === 0) return mapa;

  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagarparcelas")
    .select("id, fkContaPagar")
    .in("id", parcelaIds);

  if (error) throw error;

  const contaIds = [...new Set((data ?? []).map((p) => p.fkContaPagar).filter((i): i is number => i != null))];
  if (contaIds.length === 0) return mapa;

  const { data: linhas, error: erroLinhas } = await supabase
    .from("contaspagarcentrocusto")
    .select("fkContaPagar, fkCentroCusto, ordem")
    .in("fkContaPagar", contaIds)
    .order("ordem", { ascending: true, nullsFirst: false });

  if (erroLinhas) throw erroLinhas;

  const porConta = new Map<number, number | null>();
  for (const l of linhas ?? []) {
    if (l.fkContaPagar == null) continue;
    if (!porConta.has(l.fkContaPagar)) porConta.set(l.fkContaPagar, l.fkCentroCusto);
  }

  for (const p of data ?? []) {
    mapa.set(p.id, p.fkContaPagar == null ? null : (porConta.get(p.fkContaPagar) ?? null));
  }
  return mapa;
}

/**
 * Os cartoes da empresa.
 *
 * ⚠️ Traz INATIVO tambem, e quem filtra e quem chama. A tela de cadastro precisa
 * mostrar o que foi desativado — senao o cartao some e ninguem consegue
 * reativar —, e a baixa filtra os ativos por conta propria.
 */
export async function cartoesDaEmpresa(empresaId: number): Promise<CartaoDaBaixa[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("cartao")
    .select("id, apelido, bandeira, diaFechamento, diaVencimento, fkFornecedor, fkBanco, numero, ativo, limite")
    .eq("fkEmpresa", empresaId)
    .order("apelido", { ascending: true });

  if (error) throw error;

  const bancos = await listarBancos();
  const nomes = new Map(bancos.map((b) => [b.id, `${b.codigo} · ${b.nome}`]));

  return (data ?? []).map((c) => ({
    id: c.id,
    apelido: c.apelido,
    bandeira: c.bandeira,
    diaFechamento: c.diaFechamento ?? 1,
    diaVencimento: c.diaVencimento ?? 10,
    fornecedorId: c.fkFornecedor,
    bancoId: c.fkBanco,
    bancoNome: c.fkBanco == null ? null : (nomes.get(c.fkBanco) ?? null),
    ultimosDigitos: c.numero,
    ativo: c.ativo ?? true,
    limite: doBanco(c.limite),
  }));
}

/**
 * Os bancos que a empresa pode escolher.
 *
 * ⚠️ Sem filtro por empresa na consulta: quem recorta e a POLICY, que devolve os
 * do sistema (`fkEmpresa` nulo) mais os da empresa. Um `.eq("fkEmpresa", ...)`
 * aqui esconderia justamente a lista que nasce pronta.
 */
export async function listarBancos(): Promise<BancoDaLista[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("bancos")
    .select("id, codigo, nome, fkEmpresa")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((b) => ({
    id: b.id,
    codigo: b.codigo,
    nome: b.nome,
    doSistema: b.fkEmpresa == null,
  }));
}

/**
 * Acha (ou cria) o cadastro de fornecedor que representa um banco.
 *
 * ⚠️ Criar cadastro como efeito colateral e coisa a se fazer com parcimonia, e
 * aqui ela se justifica: sem o fornecedor a fatura nao vira conta a pagar, e
 * pedir para cadastrar "Nubank" como fornecedor antes de cadastrar o cartao e a
 * mesma informacao pedida duas vezes. Acontece UMA vez por banco por empresa.
 *
 * ⚠️ Procura por nome exato antes de criar. Sem isso, cada fatura fechada
 * criaria um "Nubank" novo, e a listagem de pessoas encheria de duplicatas do
 * mesmo banco.
 */
export async function fornecedorDoBanco(
  empresaId: number,
  usuarioId: string,
  nomeDoBanco: string,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("id")
    .eq("fkEmpresa", empresaId)
    .ilike("razao", nomeDoBanco)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data.id;

  const { data: novo, error: erroNovo } = await supabase
    .from("clientes")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      razao: nomeDoBanco,
      fornecedor: true,
      ativo: true,
    })
    .select("id")
    .single();

  if (erroNovo) throw erroNovo;
  return novo.id;
}

/** Guarda no cartao o fornecedor resolvido, para nao procurar de novo. */
export async function ligarFornecedorAoCartao(
  cartaoId: number,
  usuarioId: string,
  fornecedorId: number,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("cartao")
    .update({
      fkFornecedor: fornecedorId,
      fkUserModificacao: usuarioId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cartaoId);

  if (error) throw error;
}

export async function criarCartao(
  empresaId: number,
  usuarioId: string,
  entrada: CartaoNovo,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("cartao")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      apelido: entrada.apelido,
      bandeira: entrada.bandeira,
      /*
       * ⚠️ So os 4 ultimos, e o servico ja recortou. Guardar o PAN inteiro
       * exigiria cifragem e controle de acesso que este sistema nao tem — e
       * `ccv` nem existe como coluna, porque CVV nao se armazena.
       */
      numero: entrada.ultimosDigitos,
      fkBanco: entrada.bancoId,
      diaFechamento: entrada.diaFechamento,
      diaVencimento: entrada.diaVencimento,
      limite: paraBanco(entrada.limite),
      fkFornecedor: entrada.fornecedorId,
      fkContaBancaria: entrada.contaBancariaId,
      ativo: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function cartaoDaEmpresa(
  empresaId: number,
  cartaoId: number,
): Promise<CartaoDaBaixa | null> {
  const cartoes = await cartoesDaEmpresa(empresaId);
  return cartoes.find((c) => c.id === cartaoId) ?? null;
}

/**
 * A fatura ABERTA daquela competencia, criando-a se ainda nao existe.
 *
 * ⚠️ A fatura nasce no primeiro lancamento, e nao num processo que roda todo
 * mes. Um gerador mensal criaria faturas vazias para todo cartao ativo, e
 * quem nao usou o cartao veria uma fatura de zero esperando fechamento.
 *
 * ⚠️ Devolve tambem quando a fatura ja esta FECHADA: quem decide se aceita
 * lancamento e o servico, com `faturaAceitaLancamento`. O repositorio nao
 * decide regra.
 */
export async function faturaDaCompetencia(
  empresaId: number,
  cartaoId: number,
  competencia: DataISO,
  fechamento: DataISO,
  vencimento: DataISO,
  usuarioId: string,
): Promise<{ id: number; status: string | null }> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("cartaofaturas")
    .select("id, status")
    .eq("fkEmpresa", empresaId)
    .eq("fkCartao", cartaoId)
    .eq("competencia", competencia)
    .maybeSingle();

  if (error) throw error;
  if (data) return { id: data.id, status: data.status };

  const { data: nova, error: erroNova } = await supabase
    .from("cartaofaturas")
    .insert({
      fkEmpresa: empresaId,
      fkCartao: cartaoId,
      fkUserCriacao: usuarioId,
      competencia,
      dataFechamento: fechamento,
      dataVencimento: vencimento,
      valor: 0,
      status: "ABERTA",
    })
    .select("id, status")
    .single();

  if (erroNova) throw erroNova;
  return { id: nova.id, status: nova.status };
}

/**
 * Grava as compras da baixa como linhas da fatura do cartao.
 *
 * ⚠️ O centro de custo VAI JUNTO. O legado zerava `fkCentroCusto` quando era
 * cartao — contorno, porque a baixa dele nao sabia lidar com fatura. Zerado, a
 * despesa some do relatorio por centro no mes em que foi feita e reaparece
 * inteira no mes da fatura, num centro so.
 */
export async function lancarNaFatura(
  empresaId: number,
  faturaId: number,
  cartaoId: number,
  usuarioId: string,
  linhas: {
    fornecedorId: number;
    descricao: string;
    dataCompra: DataISO;
    competencia: DataISO;
    valor: Centavos;
    centroCustoId: number | null;
  }[],
): Promise<void> {
  if (linhas.length === 0) return;

  const supabase = await serverClient();

  const { error } = await supabase.from("cartaofaturasparcelas").insert(
    linhas.map((l) => ({
      fkEmpresa: empresaId,
      fkCartaoFatura: faturaId,
      fkCartao: cartaoId,
      fkUserModificacao: usuarioId,
      fkFornecedor: l.fornecedorId,
      descricao: l.descricao,
      dataCompra: l.dataCompra,
      competencia: l.competencia,
      numeroparcela: 1,
      valor: paraBanco(l.valor),
      fkCentroCusto: l.centroCustoId,
      status: "ABERTO",
    })),
  );

  if (error) throw error;
}

/** As faturas de um cartao, da mais recente para tras. */
export async function faturasDoCartao(
  empresaId: number,
  cartaoId?: number,
): Promise<FaturaDeCartao[]> {
  const supabase = await serverClient();

  let query = supabase
    .from("cartaofaturas")
    .select("id, fkCartao, competencia, dataFechamento, dataVencimento, valor, status, fkContaPagar")
    .eq("fkEmpresa", empresaId);

  if (cartaoId) query = query.eq("fkCartao", cartaoId);

  const { data, error } = await query.order("competencia", { ascending: false });
  if (error) throw error;

  const linhas = data ?? [];
  const cartoes = await cartoesDaEmpresa(empresaId);
  const contagens = await contarLancamentosDasFaturas(linhas.map((f) => f.id));

  return linhas.map((f) => ({
    id: f.id,
    cartaoId: f.fkCartao ?? 0,
    cartaoApelido: cartoes.find((c) => c.id === f.fkCartao)?.apelido ?? null,
    competencia: (f.competencia ?? "").slice(0, 10) as DataISO,
    fechamento: f.dataFechamento ? ((f.dataFechamento.slice(0, 10)) as DataISO) : null,
    vencimento: f.dataVencimento ? ((f.dataVencimento.slice(0, 10)) as DataISO) : null,
    total: doBanco(f.valor),
    status: (f.status ?? "ABERTA").toUpperCase(),
    contaPagarId: f.fkContaPagar,
    qtdLancamentos: contagens.get(f.id) ?? 0,
  }));
}

/** Uma consulta para a lista inteira: contar por linha seria N+1 na abertura. */
async function contarLancamentosDasFaturas(ids: number[]): Promise<Map<number, number>> {
  const mapa = new Map<number, number>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("cartaofaturasparcelas")
    .select("fkCartaoFatura")
    .in("fkCartaoFatura", ids);

  if (error) throw error;

  for (const l of data ?? []) {
    if (l.fkCartaoFatura == null) continue;
    mapa.set(l.fkCartaoFatura, (mapa.get(l.fkCartaoFatura) ?? 0) + 1);
  }
  return mapa;
}

/** O que a fatura soma hoje, a partir das linhas dela. */
export async function totalDaFatura(faturaId: number): Promise<Centavos> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("cartaofaturasparcelas")
    .select("valor")
    .eq("fkCartaoFatura", faturaId);

  if (error) throw error;
  return (data ?? []).reduce<Centavos>((s, l) => somar(s, doBanco(l.valor)), ZERO);
}

/**
 * Marca a fatura como fechada e a liga a conta a pagar que a representa.
 *
 * ⚠️ O `valor` e gravado no fechamento, e nao mantido a cada lancamento. Um
 * contador atualizado em toda escrita e a coisa que mais mente neste banco — o
 * doc 10 registra um caso em que ele errava em 32 de 123 contas. Aqui ele e
 * escrito uma vez, quando o numero para de mudar.
 */
export async function marcarFaturaFechada(
  faturaId: number,
  usuarioId: string,
  total: Centavos,
  contaPagarId: number,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("cartaofaturas")
    .update({
      status: "FECHADA",
      valor: paraBanco(total),
      total: paraBanco(total),
      fkContaPagar: contaPagarId,
      fkUserModificacao: usuarioId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", faturaId);

  if (error) throw error;

  // As linhas acompanham: FECHADO diz que aquela compra ja foi cobrada.
  const { error: erroLinhas } = await supabase
    .from("cartaofaturasparcelas")
    .update({ status: "FECHADO", fkUserModificacao: usuarioId })
    .eq("fkCartaoFatura", faturaId);

  if (erroLinhas) throw erroLinhas;
}

/** O nome do fornecedor, para o historico do extrato. */
export async function nomeDoFornecedor(
  empresaId: number,
  fornecedorId: number,
): Promise<string | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("razao, nomefantasia")
    .eq("fkEmpresa", empresaId)
    .eq("id", fornecedorId)
    .maybeSingle();

  if (error) throw error;
  return data ? primeiroPreenchido(data.nomefantasia, data.razao) : null;
}

// ── Rateio e origem ─────────────────────────────────────────────────────────

export async function listarLancamentos(contaId: number): Promise<LancamentoComNome[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagarcentrocusto")
    .select("id, descricao, fkCentroCusto, valor, ordem")
    .eq("fkContaPagar", contaId)
    // `ordem` primeiro e `id` como desempate: a ordem digitada e a que a pessoa
    // reconhece, e o id sozinho embaralha assim que alguem insere no meio.
    .order("ordem", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) throw error;

  const linhas = data ?? [];
  const centros = await nomesDosCentros(linhas.map((l) => l.fkCentroCusto));

  return linhas.map((l) => {
    const centro = l.fkCentroCusto == null ? undefined : centros.get(l.fkCentroCusto);

    return {
      id: l.id,
      descricao: l.descricao ?? "",
      valor: doBanco(l.valor),
      centroCustoId: l.fkCentroCusto,
      centroCustoCodigo: centro?.codigo ?? null,
      centroCustoNome: centro?.descricao ?? null,
    };
  });
}

async function nomesDosCentros(
  ids: (number | null)[],
): Promise<Map<number, { codigo: string | null; descricao: string }>> {
  const alvos = [...new Set(ids.filter((i): i is number => i != null))];
  const mapa = new Map<number, { codigo: string | null; descricao: string }>();
  if (alvos.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("centrodecusto")
    .select("id, codigo, descricao")
    .in("id", alvos);

  if (error) throw error;
  for (const c of data ?? []) {
    mapa.set(c.id, { codigo: c.codigo ?? null, descricao: c.descricao ?? "" });
  }
  return mapa;
}

export async function listarOrigens(contaId: number): Promise<OrigemDaConta[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagarorigens")
    .select("id, origem, fkOrdem, fkContrato, valor, observacoes")
    .eq("fkContaPagar", contaId)
    .order("id", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((o) => ({
    id: o.id,
    origem: o.origem as TipoDeOrigem,
    ordemId: o.fkOrdem,
    contratoId: o.fkContrato,
    valor: doBanco(o.valor),
    observacoes: o.observacoes,
  }));
}

/** Os centros que a empresa pode usar numa despesa, para conferir o rateio. */
export async function centrosDeDespesaValidos(
  empresaId: number,
  ids: number[],
): Promise<Set<number>> {
  if (ids.length === 0) return new Set();

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("centrodecusto")
    .select("id")
    .eq("fkEmpresa", empresaId)
    .eq("tipo", "DESPESA")
    .in("id", [...new Set(ids)]);

  if (error) throw error;
  return new Set((data ?? []).map((c) => c.id));
}

/**
 * Troca a lista de lancamentos inteira.
 *
 * ⚠️ Apaga e recria, e aqui isso e seguro: o lancamento nao carrega documento,
 * nem token, nem vinculo de pagamento — ele e so descricao, valor e centro. E o
 * oposto da parcela, que NUNCA se apaga para recriar justamente porque carrega
 * boleto, nota e comprovante.
 */
export async function substituirLancamentos(
  contaId: number,
  usuarioId: string,
  lancamentos: LancamentoDaConta[],
): Promise<void> {
  const supabase = await serverClient();

  const { error: erroDelete } = await supabase
    .from("contaspagarcentrocusto")
    .delete()
    .eq("fkContaPagar", contaId);
  if (erroDelete) throw erroDelete;

  if (lancamentos.length === 0) return;

  const { error } = await supabase.from("contaspagarcentrocusto").insert(
    lancamentos.map((l, i) => ({
      fkContaPagar: contaId,
      fkUserCriacao: usuarioId,
      descricao: l.descricao,
      fkCentroCusto: l.centroCustoId,
      valor: paraBanco(l.valor),
      ordem: i + 1,
    })),
  );
  if (error) throw error;
}

export async function atualizarObservacoes(
  empresaId: number,
  contaId: number,
  usuarioId: string,
  observacoes: string | null,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("contaspagar")
    .update({
      observacoes,
      fkUserModificacao: usuarioId,
      updated_at: new Date().toISOString(),
    })
    // ⚠️ O tenant vai no WHERE alem da RLS: a policy ja recusaria, e a condicao
    // aqui torna impossivel um id de outra empresa chegar ao UPDATE por engano.
    .eq("fkEmpresa", empresaId)
    .eq("id", contaId);

  if (error) throw error;
}

export async function atualizarTotal(
  contaId: number,
  usuarioId: string,
  total: Centavos,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("contaspagar")
    .update({
      total: paraBanco(total),
      fkUserModificacao: usuarioId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contaId);

  if (error) throw error;
}

/**
 * Reescreve o valor das parcelas preservando os VENCIMENTOS.
 *
 * ⚠️ Nao apaga para recriar. As parcelas ja podem ter boleto e nota anexados, e
 * recriar as deixaria orfas no storage. Aqui so o valor muda; a data que alguem
 * combinou com o fornecedor fica.
 *
 * ⚠️ `.eq("pago", false)` como guarda a mais: o servico ja recusou mexer em conta
 * com parcela paga, e uma condicao no proprio UPDATE torna impossivel alterar
 * uma por engano.
 */
export async function atualizarValoresDasParcelas(
  contaId: number,
  usuarioId: string,
  parcelas: { id: number; numero: number; valor: Centavos }[],
): Promise<void> {
  const supabase = await serverClient();

  for (const p of parcelas) {
    const { error } = await supabase
      .from("contaspagarparcelas")
      .update({
        numeroparcela: p.numero,
        valor: paraBanco(p.valor),
        // ⚠️ `total` acompanha o `valor` na EDICAO, e so aqui. Na baixa ele
        // continua intocado — era o defeito do legado.
        total: paraBanco(p.valor),
        fkUserModificacao: usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq("fkContaPagar", contaId)
      .eq("pago", false)
      .eq("id", p.id);

    if (error) throw error;
  }
}

/**
 * Aplica um parcelamento novo PRESERVANDO as parcelas que continuam existindo.
 *
 * ⚠️ Nao apaga para recriar, e a diferenca e grave. Cada parcela carrega a nota,
 * o boleto e o COMPROVANTE do que ja foi pago: apagando e reinserindo, os
 * arquivos ficam orfaos no storage e a prova do pagamento se perde. Quem
 * continua na lista e atualizado no lugar; so entra quem e novo e so sai quem a
 * tela tirou.
 */
export async function aplicarParcelamento(
  contaId: number,
  usuarioId: string,
  plano: {
    atualizar: { id: number; numero: number; vencimento: DataISO; valor: Centavos }[];
    criar: Parcela[];
    excluir: number[];
  },
): Promise<void> {
  const supabase = await serverClient();

  if (plano.excluir.length > 0) {
    const { error } = await supabase
      .from("contaspagarparcelas")
      .delete()
      .eq("fkContaPagar", contaId)
      // Guarda a mais: o servico ja recusou mexer em parcela paga, e uma
      // condicao no proprio DELETE torna impossivel apagar uma por engano.
      .eq("pago", false)
      .in("id", plano.excluir);

    if (error) throw error;
  }

  for (const p of plano.atualizar) {
    const { error } = await supabase
      .from("contaspagarparcelas")
      .update({
        numeroparcela: p.numero,
        vencimento: p.vencimento,
        valor: paraBanco(p.valor),
        total: paraBanco(p.valor),
        fkUserModificacao: usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq("fkContaPagar", contaId)
      .eq("pago", false)
      .eq("id", p.id);

    if (error) throw error;
  }

  if (plano.criar.length > 0) {
    const { error } = await supabase.from("contaspagarparcelas").insert(
      plano.criar.map((p) => ({
        fkContaPagar: contaId,
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
}

// ── Anexos ──────────────────────────────────────────────────────────────────

export async function listarAnexos(contaId: number): Promise<AnexoDaConta[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagaranexos")
    .select("id, nome, caminho, created_at")
    .eq("fkContaPagar", contaId)
    .order("id", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    caminho: a.caminho,
    criadoEm: a.created_at,
  }));
}

export async function criarAnexo(
  contaId: number,
  usuarioId: string,
  entrada: { nome: string; caminho: string; tipo: string | null },
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.from("contaspagaranexos").insert({
    fkContaPagar: contaId,
    fkUserCriacao: usuarioId,
    nome: entrada.nome,
    caminho: entrada.caminho,
    tipo: entrada.tipo,
  });

  if (error) throw error;
}

export async function apagarAnexo(anexoId: number): Promise<AnexoDaConta | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagaranexos")
    .delete()
    .eq("id", anexoId)
    .select("id, nome, caminho, created_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return { id: data.id, nome: data.nome, caminho: data.caminho, criadoEm: data.created_at };
}

/** A conta dona de um anexo, para a rota conferir o tenant antes de apagar. */
export async function contaDoAnexo(anexoId: number): Promise<number | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagaranexos")
    .select("fkContaPagar")
    .eq("id", anexoId)
    .maybeSingle();

  if (error) throw error;
  return data?.fkContaPagar ?? null;
}
