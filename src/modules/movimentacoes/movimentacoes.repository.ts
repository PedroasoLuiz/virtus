import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, ZERO, type Centavos } from "@/shared/utils/money";
import { nomeDaConta } from "@/shared/domain/conta-bancaria";
import type { DataISO } from "@/shared/utils/datas";
import {
  DESCRICAO_TRANSFERENCIA,
  TIPO_TRANSFERENCIA,
  type Movimentacao,
  type MovimentacaoNova,
} from "@/modules/movimentacoes/movimentacoes.types";

/**
 * As colunas que as duas pontas trazem, com a conta e quem lancou.
 *
 * ⚠️ Literal, nunca concatenada: o supabase-js interpreta a string do `select`
 * em tempo de tipo, e montada com `+` o resultado inteiro perde o tipo.
 */
const CAMPOS =
  "id, idtenant, data, valor, natureza, observacoes, conciliado, transferencia, fkContaBancaria, fkUserCriacao, contasbancarias(id, apelido, banco, conta)";

type Ponta = {
  id: number;
  idtenant: number | null;
  data: string | null;
  valor: number | null;
  natureza: string | null;
  observacoes: string | null;
  conciliado: boolean | null;
  transferencia: string | null;
  fkContaBancaria: number | null;
  fkUserCriacao: string | null;
  contasbancarias?: unknown;
};

/**
 * Junta as duas pontas de cada transferencia numa linha so.
 *
 * ⚠️ Uma transferencia sem par NAO aparece na lista. Ela existe no banco — sao
 * as que o legado gravou de um lado so —, mas aqui ela seria uma linha sem
 * origem ou sem destino, e a tela nao teria o que mostrar na coluna. Elas
 * continuam no extrato da conta, que e onde a falta se resolve.
 */
function juntar(pontas: Ponta[], nomes: Map<string, string>): Movimentacao[] {
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
      /* As duas pontas trazem o mesmo numero; ler o da saida basta. */
      numero: saida.idtenant ?? entrada.idtenant,
      data: saida.data.slice(0, 10) as DataISO,
      valor: doBanco(saida.valor),
      origemId: saida.fkContaBancaria ?? 0,
      /*
       * ⚠️ O nome vem de `shared/domain/conta-bancaria`, e nao de um formato
       * proprio daqui.
       *
       * Havia uma copia local que punha o APELIDO na frente; a do dominio poe o
       * NUMERO ("27370-8 | Cresol"), que e como o resto do sistema escreve conta
       * bancaria. Dois formatos faziam a mesma conta aparecer com dois nomes em
       * duas telas.
       */
      origemNome: nomeDaConta(conta(saida.contasbancarias)),
      destinoId: entrada.fkContaBancaria ?? 0,
      destinoNome: nomeDaConta(conta(entrada.contasbancarias)),
      observacoes: saida.observacoes ?? entrada.observacoes,
      conciliada: Boolean(saida.conciliado && entrada.conciliado),
      conferidas: Number(Boolean(saida.conciliado)) + Number(Boolean(entrada.conciliado)),
      /* Quem lancou vem da ponta de SAIDA: as duas nascem no mesmo insert, com
         o mesmo usuario, e ler as duas so daria duas vezes a mesma resposta. */
      criadoPor: saida.fkUserCriacao ? (nomes.get(saida.fkUserCriacao) ?? null) : null,
    });
  }

  return movimentacoes.sort((a, b) => b.data.localeCompare(a.data));
}

function conta(bruto: unknown) {
  return (bruto ?? {}) as {
    id?: number | null;
    apelido?: string | null;
    banco?: string | null;
    conta?: string | null;
  };
}

/**
 * O nome de quem lancou, para a coluna de autoria.
 *
 * ⚠️ UMA consulta para a pagina inteira, e nao uma por linha. Perguntando linha
 * a linha, trinta transferencias eram trinta idas ao banco para responder a
 * mesma pergunta com o id trocado.
 *
 * ⚠️ Falha em silencio: `usuarios` tem policy de leitura propria, e uma
 * transferencia sem autor conhecido continua sendo uma transferencia. A coluna
 * mostra um traco, e nao a tela inteira um erro.
 */
async function nomesDosAutores(ids: (string | null)[]): Promise<Map<string, string>> {
  const alvos = [...new Set(ids.filter((i): i is string => i != null))];
  const mapa = new Map<string, string>();
  if (alvos.length === 0) return mapa;

  const supabase = await serverClient();
  const { data } = await supabase.from("usuarios").select("fkUser, nome").in("fkUser", alvos);

  for (const u of data ?? []) {
    if (u.nome) mapa.set(u.fkUser, u.nome);
  }
  return mapa;
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

  const pontas = (data ?? []) as unknown as Ponta[];
  const nomes = await nomesDosAutores(pontas.map((p) => p.fkUserCriacao));

  return juntar(pontas, nomes);
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
 * Quanto a conta tem disponivel HOJE: o saldo mais o limite.
 *
 * ⚠️ O saldo vem da `vwsaldo`, e nunca de uma coluna. Saldo guardado e a
 * primeira coisa a divergir do extrato, e aqui ele decide se a transferencia
 * acontece — um numero velho autorizaria uma saida que a conta nao aguenta.
 *
 * ⚠️ `vwsaldo` nao filtra por empresa: ela e por conta, e o isolamento vem de
 * `contaPertence`, que o servico chama antes.
 */
export async function disponivelDaConta(contaId: number): Promise<Centavos> {
  const supabase = await serverClient();

  const [saldo, conta] = await Promise.all([
    supabase.from("vwsaldo").select("saldo").eq("conta_id", contaId).maybeSingle(),
    supabase.from("contasbancarias").select("limite").eq("id", contaId).maybeSingle(),
  ]);

  if (saldo.error) throw saldo.error;
  if (conta.error) throw conta.error;

  const emConta = saldo.data ? doBanco(saldo.data.saldo) : ZERO;
  const limite = conta.data ? doBanco(conta.data.limite) : ZERO;

  return (emConta + limite) as Centavos;
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
  empresaNome: string,
): Promise<string> {
  const supabase = await serverClient();
  const chave = crypto.randomUUID();

  const base = {
    fkEmpresa: empresaId,
    fkUserCriacao: usuarioId,
    data: nova.data,
    valor: paraBanco(nova.valor),
    tipo: TIPO_TRANSFERENCIA,
    descricao: DESCRICAO_TRANSFERENCIA,
    /*
     * ⚠️ `nome` e a EMPRESA, e e ele que o extrato mostra.
     *
     * O extrato le `nome` e so cai em `descricao` quando ele esta vazio. Sem
     * gravar, a linha aparecia com a descricao no lugar do historico — e as 55
     * transferencias que ja existem trazem a razao social aqui. Numa
     * transferencia entre contas proprias, quem esta dos dois lados e a propria
     * empresa: e ela o "favorecido".
     */
    nome: empresaNome,
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
