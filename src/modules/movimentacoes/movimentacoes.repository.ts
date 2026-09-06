import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import {
  TIPO_TRANSFERENCIA,
  type Movimentacao,
  type MovimentacaoNova,
} from "@/modules/movimentacoes/movimentacoes.types";

/** As colunas que as duas pontas trazem, e o apelido da conta de cada uma. */
const CAMPOS =
  "id, data, valor, natureza, observacoes, conciliado, transferencia, fkContaBancaria, contasbancarias(apelido, banco, conta)";

type Ponta = {
  id: number;
  data: string | null;
  valor: number | null;
  natureza: string | null;
  observacoes: string | null;
  conciliado: boolean | null;
  transferencia: string | null;
  fkContaBancaria: number | null;
  contasbancarias?: unknown;
};

/**
 * O nome da conta como o resto do sistema escreve: numero na frente, banco
 * depois. Vem de `shared/domain/conta-bancaria`, e nao de um formato proprio.
 */
function nomeDaConta(bruto: unknown): string {
  const c = bruto as { apelido?: string | null; banco?: string | null; conta?: string | null } | null;
  return c?.apelido?.trim() || [c?.conta, c?.banco].filter(Boolean).join(" | ") || "Conta";
}

/**
 * Junta as duas pontas de cada transferencia numa linha so.
 *
 * ⚠️ Uma transferencia sem par NAO aparece na lista. Ela existe no banco — sao
 * as que o legado gravou de um lado so —, mas aqui ela seria uma linha sem
 * origem ou sem destino, e a tela nao teria o que mostrar na coluna. Elas
 * continuam no extrato da conta, que e onde a falta se resolve.
 */
function juntar(pontas: Ponta[]): Movimentacao[] {
  const porChave = new Map<string, Ponta[]>();

  for (const p of pontas) {
    if (!p.transferencia) continue;
    porChave.set(p.transferencia, [...(porChave.get(p.transferencia) ?? []), p]);
  }

  const movimentacoes: Movimentacao[] = [];

  for (const [chave, lados] of porChave) {
    const saida = lados.find((l) => (l.natureza ?? "").toLowerCase().startsWith("despesa"));
    const entrada = lados.find((l) => (l.natureza ?? "").toLowerCase().startsWith("receita"));
    if (!saida || !entrada || !saida.data) continue;

    movimentacoes.push({
      id: chave,
      data: saida.data.slice(0, 10) as DataISO,
      valor: doBanco(saida.valor),
      origemId: saida.fkContaBancaria ?? 0,
      origemNome: nomeDaConta(saida.contasbancarias),
      destinoId: entrada.fkContaBancaria ?? 0,
      destinoNome: nomeDaConta(entrada.contasbancarias),
      observacoes: saida.observacoes ?? entrada.observacoes,
      conciliada: Boolean(saida.conciliado && entrada.conciliado),
      conferidas: Number(Boolean(saida.conciliado)) + Number(Boolean(entrada.conciliado)),
    });
  }

  return movimentacoes.sort((a, b) => b.data.localeCompare(a.data));
}

export async function listar(
  empresaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<Movimentacao[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .select(CAMPOS)
    .eq("fkEmpresa", empresaId)
    .not("transferencia", "is", null)
    .gte("data", de)
    .lte("data", ate)
    .order("data", { ascending: false });

  if (error) throw error;
  return juntar((data ?? []) as unknown as Ponta[]);
}

export async function contaPertence(empresaId: number, contaId: number): Promise<boolean> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contasbancarias")
    .select("id")
    .eq("fkEmpresa", empresaId)
    .eq("id", contaId)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

/**
 * Grava as duas pontas de uma vez, com o mesmo `transferencia`.
 *
 * ⚠️ INSERT unico com as duas linhas, e nao dois inserts em sequencia. O
 * PostgREST nao expoe transacao entre requisicoes: em duas idas, uma falha no
 * meio deixaria a metade que passou — que e exatamente o defeito que esta tela
 * existe para acabar.
 */
export async function criar(
  empresaId: number,
  usuarioId: string,
  nova: MovimentacaoNova,
  descricao: string,
): Promise<string> {
  const supabase = await serverClient();
  const chave = crypto.randomUUID();

  const base = {
    fkEmpresa: empresaId,
    fkUserCriacao: usuarioId,
    data: nova.data,
    valor: paraBanco(nova.valor),
    tipo: TIPO_TRANSFERENCIA,
    descricao,
    observacoes: nova.observacoes,
    transferencia: chave,
    conciliado: false,
  };

  const { error } = await supabase.from("pagamentos").insert([
    { ...base, fkContaBancaria: nova.origemId, natureza: "Despesas" },
    { ...base, fkContaBancaria: nova.destinoId, natureza: "Receitas" },
  ]);

  if (error) throw error;
  return chave;
}

/** As duas pontas, para o servico decidir se pode estornar. */
export async function pontas(
  empresaId: number,
  id: string,
): Promise<{ pagamentoId: number; conciliado: boolean }[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .select("id, conciliado")
    .eq("fkEmpresa", empresaId)
    .eq("transferencia", id);

  if (error) throw error;
  return (data ?? []).map((p) => ({ pagamentoId: p.id, conciliado: p.conciliado ?? false }));
}

/**
 * Apaga a transferencia inteira.
 *
 * ⚠️ Pelo `transferencia`, e nao por id de lancamento: e o filtro que garante
 * que as duas pontas saem juntas. Apagando por id, um erro de digitacao levaria
 * uma so — e um par pela metade e pior que nenhum, porque o saldo de uma conta
 * passa a mentir.
 */
export async function apagar(empresaId: number, id: string): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("pagamentos")
    .delete()
    .eq("fkEmpresa", empresaId)
    .eq("transferencia", id);

  if (error) throw error;
}
