import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, somar, ZERO, type Centavos } from "@/shared/utils/money";
import { primeiroPreenchido } from "@/shared/utils/texto";
import type { DataISO } from "@/shared/utils/datas";
import type {
  ContaBancaria,
  ContaNova,
  Extrato,
  MovimentoDoExtrato,
} from "@/modules/contas/contas.types";

/**
 * Unica porta de acesso aos dados de contas bancarias.
 *
 * O saldo NUNCA e lido de uma coluna: vem da view `vwsaldo`, que soma o saldo
 * inicial com tudo que passou. Saldo guardado e a primeira coisa a divergir do
 * extrato, e o legado ja tinha esse problema.
 */

const COLUNAS =
  "id, apelido, banco, agencia, conta, tipo, ativo, limite, saldoinicial";

export async function listar(empresaId: number): Promise<ContaBancaria[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contasbancarias")
    .select(COLUNAS)
    .eq("fkEmpresa", empresaId)
    .order("ativo", { ascending: false })
    .order("id", { ascending: true });

  if (error) throw error;

  const linhas = data ?? [];
  const saldos = await saldosPorConta(linhas.map((l) => l.id));

  return linhas.map((l) => paraDominio(l, saldos.get(l.id) ?? ZERO));
}

export async function buscarPorId(
  empresaId: number,
  id: number,
): Promise<ContaBancaria | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contasbancarias")
    .select(COLUNAS)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const saldos = await saldosPorConta([data.id]);
  return paraDominio(data, saldos.get(data.id) ?? ZERO);
}

/**
 * Saldo de cada conta, da view.
 *
 * ⚠️ `vwsaldo` nao filtra por empresa: ela e por conta, e o isolamento vem da
 * RLS de `contasbancarias`, que a view respeita desde a migracao de
 * `security_invoker`. Por isso a lista de ids ja chega filtrada por empresa.
 */
async function saldosPorConta(ids: number[]): Promise<Map<number, Centavos>> {
  const mapa = new Map<number, Centavos>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("vwsaldo")
    .select("conta_id, saldo")
    .in("conta_id", ids);

  if (error) throw error;

  for (const l of data ?? []) mapa.set(l.conta_id, doBanco(l.saldo));
  return mapa;
}

export async function criar(
  empresaId: number,
  usuarioId: string,
  entrada: ContaNova,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contasbancarias")
    .insert({ ...paraBancoDeDados(entrada), fkEmpresa: empresaId, fkUserCriacao: usuarioId })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function atualizar(
  empresaId: number,
  usuarioId: string,
  id: number,
  entrada: ContaNova,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("contasbancarias")
    .update({
      ...paraBancoDeDados(entrada),
      updated_at: new Date().toISOString(),
      fkUserModificacao: usuarioId,
    })
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

export async function excluir(empresaId: number, id: number): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("contasbancarias")
    .delete()
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/** Quantos lancamentos passaram pela conta. Zero permite excluir; acima disso, nao. */
export async function movimentosDaConta(empresaId: number, id: number): Promise<number> {
  const supabase = await serverClient();
  const { count, error } = await supabase
    .from("pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", id);

  if (error) throw error;
  return count ?? 0;
}

/**
 * O extrato de uma conta num periodo.
 *
 * Duas perguntas, duas consultas: os MOVIMENTOS vem do PostgREST, com todas as
 * colunas (inclusive `id` e `conciliado`, que o RPC antigo nao devolvia e sem os
 * quais nao ha como marcar uma linha como conferida); o SALDO DE ABERTURA vem de
 * uma funcao, porque e uma agregacao sobre tudo que veio antes e trazer isso
 * para ca significaria baixar anos de lancamento a cada abertura de tela.
 */
export async function extrato(
  empresaId: number,
  contaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<Extrato | null> {
  const conta = await buscarPorId(empresaId, contaId);
  if (!conta) return null;

  const supabase = await serverClient();

  const [abertura, lancamentos] = await Promise.all([
    supabase.rpc("saldo_da_conta_antes", { p_conta: contaId, p_data: de }),
    supabase
      .from("pagamentos")
      /*
       * ⚠️ O extrato pergunta por `data_caixa`, e nao por `data`.
       *
       * `data` e quando o cliente pagou; `data_caixa` e quando o dinheiro se
       * moveu NA CONTA. Uma venda no cartao no dia 20 de agosto nao aparece no
       * extrato de agosto: ela cai em setembro, e o extrato do banco vai
       * mostra-la la. Perguntando pela data do pagamento, a conciliacao acusava
       * diferenca todo mes.
       */
      .select("id, data_caixa, nome, descricao, valor, natureza, tipo, origem, conciliado")
      .eq("fkEmpresa", empresaId)
      .eq("fkContaBancaria", contaId)
      .gte("data_caixa", de)
      .lte("data_caixa", ate)
      // Data primeiro, id depois: o id desempata dois lancamentos do mesmo dia e
      // congela a ordem, senao o saldo acumulado mudaria de uma consulta para a
      // outra sem nada ter mudado no banco.
      .order("data_caixa", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (abertura.error) throw abertura.error;
  if (lancamentos.error) throw lancamentos.error;

  const saldoInicial = doBanco(abertura.data as number | null);
  let corrente = saldoInicial;
  let entradas = ZERO;
  let saidas = ZERO;

  const movimentos: MovimentoDoExtrato[] = (lancamentos.data ?? [])
    // Natureza fora do par conhecido nao entra: `vwsaldo` a ignora no saldo, e
    // mostra-la no extrato produziria uma linha que nao mexe no acumulado.
    .filter((m) => ehReceita(m.natureza) || ehDespesa(m.natureza))
    .map((m) => {
      const valor = doBanco(Math.abs(m.valor ?? 0));
      const entrada = ehReceita(m.natureza);

      if (entrada) entradas = somar(entradas, valor);
      else saidas = somar(saidas, valor);

      corrente = (corrente + (entrada ? valor : -valor)) as Centavos;

      return {
        id: m.id,
        // A data do EXTRATO e a do caixa: e o dia em que o banco viu o dinheiro.
        data: m.data_caixa ? ((m.data_caixa.slice(0, 10)) as DataISO) : null,
        nome: m.nome,
        tipo: entrada ? ("ENTRADA" as const) : ("SAIDA" as const),
        valor,
        origem: m.origem,
        descricao: m.descricao,
        formaPagamento: m.tipo,
        conciliado: m.conciliado ?? false,
        saldoApos: corrente,
      };
    });

  return {
    contaId,
    contaNome: conta.nome,
    de,
    ate,
    saldoInicial,
    saldoFinal: corrente,
    entradas,
    saidas,
    movimentos,
  };
}

/**
 * ⚠️ Comparacao sem diferenciar maiuscula, igual a `vwsaldo` e ao RPC do extrato.
 *
 * O banco herdado tem "Receitas" e "Despesas"; se algum caminho gravar em caixa
 * diferente, o saldo e o extrato precisam continuar concordando um com o outro.
 */
function ehReceita(natureza: string | null): boolean {
  return (natureza ?? "").toUpperCase() === "RECEITAS";
}

function ehDespesa(natureza: string | null): boolean {
  return (natureza ?? "").toUpperCase() === "DESPESAS";
}

/**
 * Marca (ou desmarca) um lancamento como conferido no extrato do banco.
 *
 * A empresa entra no `where` e nao so na leitura: sem ela, um id de outro tenant
 * chegaria ao update e a RLS seria a unica linha de defesa.
 */
export async function definirConciliacao(
  empresaId: number,
  pagamentoId: number,
  conciliado: boolean,
  usuarioId: string,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("pagamentos")
    .update({
      conciliado,
      updated_at: new Date().toISOString(),
      fkUserModificacao: usuarioId,
    })
    .eq("fkEmpresa", empresaId)
    .eq("id", pagamentoId);

  if (error) throw error;
}

// ── Traducao ────────────────────────────────────────────────────────────────

function paraDominio(
  linha: {
    id: number;
    apelido: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipo: string | null;
    ativo: boolean | null;
    limite: number | null;
    saldoinicial: number | null;
  },
  saldo: Centavos,
): ContaBancaria {
  return {
    id: linha.id,
    apelido: linha.apelido,
    banco: linha.banco,
    agencia: linha.agencia,
    conta: linha.conta,
    tipo: linha.tipo,
    ativo: linha.ativo ?? true,
    limite: doBanco(linha.limite),
    saldoInicial: doBanco(linha.saldoinicial),
    saldo,
    nome:
      primeiroPreenchido(
        linha.apelido,
        linha.banco ? `${linha.banco}${linha.conta ? ` · ${linha.conta}` : ""}` : null,
      ) ?? `Conta ${linha.id}`,
  };
}

function paraBancoDeDados(entrada: ContaNova) {
  return {
    apelido: entrada.apelido,
    banco: entrada.banco,
    agencia: entrada.agencia,
    conta: entrada.conta,
    tipo: entrada.tipo,
    ativo: entrada.ativo,
    limite: paraBanco(entrada.limite),
    saldoinicial: paraBanco(entrada.saldoInicial),
  };
}
