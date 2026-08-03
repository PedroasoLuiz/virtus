import { serverClient } from "@/infra/supabase/client";
import { doBanco, type Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { intervalo, type Paginacao, type Pagina } from "@/shared/utils/paginacao";
import type { ContaPagarResumo, FiltroContas } from "@/modules/contas-pagar/contas-pagar.types";

/** Unica porta de acesso aos dados de contas a pagar. */

const COLUNAS = "id, descricao, fkFornecedor, data, total, pago, cancelada, fkStatus";

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

type ResumoParcelas = { qtd: number; pagas: number; proximo: DataISO | null };

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
    .select("fkContaPagar, vencimento, pago")
    .in("fkContaPagar", contaIds)
    .order("vencimento", { ascending: true });

  if (error) throw error;

  for (const linha of data ?? []) {
    const id = linha.fkContaPagar;
    if (id == null) continue;

    const atual = mapa.get(id) ?? { qtd: 0, pagas: 0, proximo: null };
    atual.qtd += 1;
    if (linha.pago) atual.pagas += 1;
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
  descricao: string | null;
  fkFornecedor: number | null;
  data: string | null;
  total: number | null;
  pago: boolean | null;
  cancelada: boolean | null;
  clientes?: unknown;
};

function paraDominio(linha: Linha, parcelas?: ResumoParcelas): ContaPagarResumo {
  const fornecedor = linha.clientes as { razao: string | null; nomefantasia: string | null } | null;

  return {
    id: linha.id,
    descricao: linha.descricao ?? "",
    fornecedorId: linha.fkFornecedor,
    fornecedorNome: primeiroPreenchido(fornecedor?.nomefantasia, fornecedor?.razao),
    emissao: linha.data ? ((linha.data.slice(0, 10)) as DataISO) : null,
    proximoVencimento: parcelas?.proximo ?? null,
    total: doBanco(linha.total),
    pago: linha.pago ?? false,
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
  nfs: string | null;
  boleto: string | null;
};

export type ContaPagarDetalhe = ContaPagarResumo & {
  observacoes: string | null;
  centroCustoId: number | null;
  parcelas: ParcelaConta[];
};

export async function buscarPorId(
  empresaId: number,
  id: number,
): Promise<ContaPagarDetalhe | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagar")
    .select(`${COLUNAS}, observacoes, fkCentroCusto, clientes(razao, nomefantasia)`)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const parcelas = await listarParcelas(id);
  const resumo = paraDominio(data, {
    qtd: parcelas.length,
    pagas: parcelas.filter((p) => p.pago).length,
    proximo: parcelas.find((p) => !p.pago)?.vencimento ?? null,
  });

  return {
    ...resumo,
    observacoes: data.observacoes,
    centroCustoId: data.fkCentroCusto,
    parcelas,
  };
}

export async function listarParcelas(contaId: number): Promise<ParcelaConta[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contaspagarparcelas")
    .select(
      "id, numeroparcela, vencimento, valor, acrescimo, desconto, total, pago, nfs, boleto",
    )
    .eq("fkContaPagar", contaId)
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
    nfs: l.nfs,
    boleto: l.boleto,
  }));
}
