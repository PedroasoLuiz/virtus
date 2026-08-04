import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, somar, ZERO, type Centavos } from "@/shared/utils/money";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { intervalo, type Pagina, type Paginacao } from "@/shared/utils/paginacao";
import type { DataISO } from "@/shared/utils/datas";
import { SEM_COBRANCA, type ParametrosDeCobranca } from "@/shared/domain/cobranca";
import type {
  DestinoDoRecebimento,
  FiltroRecebimentos,
  ParcelaEmAberto,
  Recebimento,
  RecebimentoNovo,
  RecebimentoResumo,
} from "@/modules/recebimentos/recebimentos.types";

/**
 * Unica porta de acesso aos dados de recebimento.
 *
 * `pagamentos` e o extrato: o que entrou, quando e em qual conta. Ele nao tem
 * vinculo com fatura nenhuma, e e justamente isso que permite um pagamento so
 * cobrir varias contas. Quem liga o dinheiro as dividas e `pagamentosxparcelas`.
 */

/*
 * ⚠️ "Receitas", exatamente assim. Nao e escolha de estilo.
 *
 * A view `vwsaldo` decide o saldo de cada conta bancaria com
 * `case when natureza ilike 'Receitas' then +valor when 'Despesas' then -valor
 * else 0 end`. Qualquer outra palavra cai no ELSE e o dinheiro entra valendo
 * ZERO no saldo — sem erro, sem aviso, so um saldo menor do que o extrato.
 *
 * O banco herdado ja tem 884 linhas com esse vocabulario. Quem se adapta e o
 * codigo novo.
 */
const RECEITA = "Receitas";

/**
 * Marca de onde o lancamento veio. Puramente descritiva: nada filtra por ela.
 *
 * O legado grava "Importação", "Manual" e "on" — este ultimo e um bug do
 * FlutterFlow, que serializou um switch ligado no lugar do rotulo. Nao vale
 * reproduzir.
 */
const ORIGEM = "FATURA";

/**
 * ⚠️ Literal, nunca concatenada.
 *
 * O supabase-js interpreta a string do `select` em tempo de tipo; montada com
 * `+` ela vira `GenericStringError` e o resultado inteiro perde o tipo.
 */
const CAMPOS_DESTINO =
  "fkPagamento, fkParcela, valor, juros, multa, desconto, faturasparcelas!inner(id, numeroparcela, vencimento, fkFatura, faturas!inner(id, fkCliente, clientes(razao, nomefantasia)))";

/**
 * O que a parcela realmente deve.
 *
 * ⚠️ Nao e `coalesce(total, valor)`: tres parcelas antigas tem `total = 0` com o
 * valor de verdade em `valor`, e o coalesce as daria como quitadas. Espelha a
 * funcao `public.devido_da_parcela`, que o gatilho de baixa usa — se as duas
 * divergirem, a tela mostra um saldo que o banco nao reconhece.
 */
function devido(total: number | null, valor: number | null): Centavos {
  return doBanco(total || valor || 0);
}

// ── Leitura ─────────────────────────────────────────────────────────────────

/**
 * As parcelas de um cliente que ainda esperam dinheiro, de TODAS as contas dele.
 *
 * Canceladas ficam de fora: nao se recebe o que deixou de ser cobrado.
 */
export async function parcelasEmAberto(
  empresaId: number,
  clienteId: number,
): Promise<ParcelaEmAberto[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasparcelas")
    .select(
      "id, numeroparcela, vencimento, valor, total, pago, pagamentosxparcelas(valor), faturas!inner(id, fkEmpresa, fkCliente, cancelada, parcelas)",
    )
    .eq("pago", false)
    .eq("faturas.fkEmpresa", empresaId)
    .eq("faturas.fkCliente", clienteId)
    .eq("faturas.cancelada", false)
    .order("vencimento", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((l) => {
      const f = l.faturas as unknown as { id: number; parcelas: number | null };
      const total = devido(l.total, l.valor);
      const recebido = doBanco(
        ((l.pagamentosxparcelas ?? []) as unknown as { valor: number }[]).reduce(
          (soma, v) => soma + (v.valor ?? 0),
          0,
        ),
      );

      return {
        parcelaId: l.id,
        faturaId: f.id,
        // O numero da conta E o id: `faturas` nunca teve coluna de numeracao
        // propria, e a tela de contas a receber ja mostra o id como numero.
        faturaNumero: f.id,
        numero: l.numeroparcela ?? 0,
        totalParcelas: f.parcelas ?? 0,
        vencimento: l.vencimento ? ((l.vencimento.slice(0, 10)) as DataISO) : null,
        total,
        recebido,
        emAberto: (total - recebido) as Centavos,
        // Quem decide e o servico, que conhece a fila de cada conta.
        liberada: false,
      };
    })
    .filter((p) => p.emAberto > 0);
}

export async function listar(
  empresaId: number,
  filtro: FiltroRecebimentos,
  paginacao: Paginacao,
): Promise<Pagina<RecebimentoResumo>> {
  const supabase = await serverClient();
  const [de, ate] = intervalo(paginacao);

  /*
   * O que faz um pagamento ser uma BAIXA e ter rateio, nao a palavra na coluna
   * `origem`.
   *
   * O legado grava tres origens diferentes para a mesma coisa ("Importação",
   * "Manual", "on"), e filtrar por uma delas escondia os 107 recebimentos
   * antigos que ja existiam. O `!inner` no rateio responde a pergunta certa:
   * este dinheiro abateu alguma parcela? As receitas sem rateio sao dinheiro que
   * entrou sem quitar conta a receber nenhuma, e o lugar delas e o extrato.
   */
  let query = supabase
    .from("pagamentos")
    .select(
      "id, data, tipo, valor, conciliado, descricao, contasbancarias(apelido, banco, conta), pagamentosxparcelas!inner(id)",
      { count: "exact" },
    )
    .eq("fkEmpresa", empresaId)
    .ilike("natureza", RECEITA);

  if (filtro.de) query = query.gte("data", filtro.de);
  if (filtro.ate) query = query.lte("data", filtro.ate);

  const { data, error, count } = await query
    .order("data", { ascending: false })
    .order("id", { ascending: false })
    .range(de, ate);

  if (error) throw error;

  const linhas = data ?? [];
  const destinos = await destinosDe(linhas.map((l) => l.id));

  const itens = linhas
    .map((l) => {
      const linhasDoRateio = destinos.get(l.id) ?? [];
      return { resumo: paraResumo(l, linhasDoRateio), clientes: clientesDe(linhasDoRateio) };
    })
    // O filtro por cliente e aplicado aqui e nao no `where` porque o cliente
    // nao mora em `pagamentos`: ele vem pelo caminho parcela -> conta -> cliente,
    // e o PostgREST nao filtra a raiz por um embed de terceiro nivel.
    .filter((r) => !filtro.clienteId || r.clientes.includes(filtro.clienteId))
    .map((r) => r.resumo);

  return { itens, total: count ?? 0 };
}

export async function buscarPorId(empresaId: number, id: number): Promise<Recebimento | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .select(
      "id, data, tipo, valor, conciliado, descricao, observacoes, created_at, fkUserCriacao, contasbancarias(apelido, banco, conta)",
    )
    .eq("fkEmpresa", empresaId)
    .ilike("natureza", RECEITA)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const linhas = (await destinosDe([id])).get(id) ?? [];

  return {
    ...paraResumo(data, linhas),
    observacoes: data.observacoes,
    registradoPor: await nomeDoUsuario(data.fkUserCriacao),
    registradoEm: data.created_at,
    destinos: linhas.map((d) => d.destino),
  };
}

/**
 * Nome de quem lancou.
 *
 * Consulta separada e nao embed: `pagamentos.fkUserCriacao` aponta para
 * `usuarios.fkUser`, que nao e a chave primaria da tabela — o PostgREST nao
 * monta relacionamento por coluna que nao seja chave.
 */
async function nomeDoUsuario(fkUser: string | null): Promise<string | null> {
  if (!fkUser) return null;

  const supabase = await serverClient();
  const { data } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("fkUser", fkUser)
    .maybeSingle();

  return data?.nome ?? null;
}

type LinhaDestino = {
  destino: DestinoDoRecebimento;
  clienteId: number | null;
  clienteNome: string | null;
};

/**
 * Os destinos de varios pagamentos de uma vez.
 *
 * Uma consulta para N pagamentos, e nao uma por linha da listagem: com 100
 * recebimentos na tela, o caminho ingenuo faria 100 idas ao banco.
 */
async function destinosDe(ids: number[]): Promise<Map<number, LinhaDestino[]>> {
  const mapa = new Map<number, LinhaDestino[]>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("pagamentosxparcelas")
    .select(CAMPOS_DESTINO)
    .in("fkPagamento", ids);

  if (error) throw error;

  for (const l of data ?? []) {
    const p = l.faturasparcelas as unknown as {
      id: number;
      numeroparcela: number | null;
      vencimento: string | null;
      faturas: {
        id: number;
        fkCliente: number | null;
        clientes: { razao: string | null; nomefantasia: string | null } | null;
      };
    };

    const lista = mapa.get(l.fkPagamento) ?? [];
    lista.push({
      destino: {
        parcelaId: p.id,
        faturaId: p.faturas.id,
        faturaNumero: p.faturas.id,
        numero: p.numeroparcela ?? 0,
        vencimento: p.vencimento ? ((p.vencimento.slice(0, 10)) as DataISO) : null,
        valor: doBanco(l.valor),
        juros: doBanco(l.juros),
        multa: doBanco(l.multa),
        desconto: doBanco(l.desconto),
      },
      clienteId: p.faturas.fkCliente,
      clienteNome: primeiroPreenchido(
        p.faturas.clientes?.nomefantasia,
        p.faturas.clientes?.razao,
      ),
    });
    mapa.set(l.fkPagamento, lista);
  }

  return mapa;
}

function paraResumo(
  linha: {
    id: number;
    data: string | null;
    tipo: string | null;
    valor: number | null;
    conciliado: boolean | null;
    descricao: string | null;
    contasbancarias: unknown;
  },
  destinos: LinhaDestino[],
): RecebimentoResumo {
  const conta = linha.contasbancarias as {
    apelido: string | null;
    banco: string | null;
    conta: string | null;
  } | null;

  const nomes = [...new Set(destinos.map((d) => d.clienteNome).filter(Boolean))] as string[];

  return {
    id: linha.id,
    data: linha.data ? ((linha.data.slice(0, 10)) as DataISO) : null,
    tipo: linha.tipo,
    valor: doBanco(linha.valor),
    abatido: destinos.reduce<Centavos>((s, d) => somar(s, d.destino.valor), ZERO),
    juros: destinos.reduce<Centavos>((s, d) => somar(s, d.destino.juros), ZERO),
    multa: destinos.reduce<Centavos>((s, d) => somar(s, d.destino.multa), ZERO),
    // Um pagamento e de UM pagador. Mais de um nome aqui so aconteceria com
    // dado herdado torto, e mostrar o primeiro e melhor que mostrar vazio.
    clienteNome: nomes[0] ?? null,
    contaNome:
      primeiroPreenchido(
        conta?.apelido,
        conta?.banco ? `${conta.banco}${conta.conta ? ` · ${conta.conta}` : ""}` : null,
      ) ?? null,
    conciliado: linha.conciliado ?? false,
    descricao: linha.descricao,
    qtdParcelas: destinos.length,
    qtdContas: new Set(destinos.map((d) => d.destino.faturaId)).size,
  };
}

/** Os clientes alcancados por um rateio. Serve ao filtro, nao a resposta. */
function clientesDe(destinos: LinhaDestino[]): number[] {
  return [...new Set(destinos.map((d) => d.clienteId).filter((c): c is number => c != null))];
}

/**
 * As parcelas alvo, com a empresa dona de cada uma.
 *
 * Existe para o servico conferir que o cliente do POST e mesmo o dono das
 * parcelas: o corpo vem do navegador, e sem esta consulta um `parcelaId` trocado
 * a mao baixaria a divida de outro cliente.
 */
export async function donasDasParcelas(
  ids: number[],
): Promise<Map<number, { empresaId: number | null; clienteId: number | null; faturaId: number }>> {
  const mapa = new Map<number, { empresaId: number | null; clienteId: number | null; faturaId: number }>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("faturasparcelas")
    .select("id, faturas!inner(id, fkEmpresa, fkCliente, cancelada)")
    .in("id", ids);

  if (error) throw error;

  for (const l of data ?? []) {
    const f = l.faturas as unknown as {
      id: number;
      fkEmpresa: number | null;
      fkCliente: number | null;
      cancelada: boolean | null;
    };
    if (f.cancelada) continue;
    mapa.set(l.id, { empresaId: f.fkEmpresa, clienteId: f.fkCliente, faturaId: f.id });
  }

  return mapa;
}

// ── Escrita ─────────────────────────────────────────────────────────────────

/**
 * Grava o recebimento: UM movimento em `pagamentos` e N linhas de rateio.
 *
 * ⚠️ Sem transacao entre as duas chamadas — limitacao do PostgREST. Se o rateio
 * falhar, o pagamento e apagado no `catch`: melhor nao existir do que existir
 * sem destino, virando dinheiro no extrato que conta nenhuma reconhece.
 */
export async function criar(
  empresaId: number,
  usuarioId: string,
  entrada: RecebimentoNovo,
  total: Centavos,
  descricao: string,
  /** Quanto cada parcela teve perdoado nesta baixa. Vazio quando ninguem quitou. */
  descontos: Map<number, Centavos>,
  /** Nome do pagador. E a coluna que o extrato mostra como historico. */
  pagador: string | null,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      fkContaBancaria: entrada.contaBancariaId,
      data: entrada.data,
      // O que o banco viu: parcelas + juros + multa. Guardar so o abatimento
      // faria o extrato divergir do lancamento real em todo atraso.
      valor: paraBanco(total),
      tipo: entrada.tipo,
      natureza: RECEITA,
      origem: ORIGEM,
      descricao,
      // `nome` e o que o RPC do extrato mostra na coluna de historico. Sem ele
      // o lancamento aparece na conta bancaria sem dizer de quem veio.
      nome: pagador,
      observacoes: entrada.observacoes?.trim() || null,
      conciliado: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  const pagamentoId = data.id;

  try {
    const { error: erroRateio } = await supabase.from("pagamentosxparcelas").insert(
      entrada.destinos.map((d) => ({
        fkPagamento: pagamentoId,
        fkParcela: d.parcelaId,
        valor: paraBanco(d.valor),
        juros: paraBanco(d.juros),
        multa: paraBanco(d.multa),
        // Guardado por linha para que o estorno saiba o que devolver: sem isso,
        // desfazer a baixa apagaria o dinheiro que entrou e deixaria a divida
        // perdoada perdida.
        desconto: paraBanco(descontos.get(d.parcelaId) ?? (0 as Centavos)),
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
 * Fecha a diferenca como desconto. Mesma regra da baixa feita pela conta.
 *
 * Some do saldo sem passar pelo caixa: nao e dinheiro que entrou, e cobranca que
 * deixou de existir.
 */
export async function encerrarDiferenca(
  parcelaId: number,
  usuarioId: string,
  novoTotal: Centavos,
  descontoAdicional: Centavos,
): Promise<void> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasparcelas")
    .select("desconto")
    .eq("id", parcelaId)
    .single();

  if (error) throw error;

  const { error: erroUpdate } = await supabase
    .from("faturasparcelas")
    .update({
      total: paraBanco(novoTotal),
      desconto: (data.desconto ?? 0) + paraBanco(descontoAdicional),
      updated_at: new Date().toISOString(),
      fkUserModificacao: usuarioId,
    })
    .eq("id", parcelaId);

  if (erroUpdate) throw erroUpdate;
}

/**
 * Desfaz um recebimento: apaga o rateio e o lancamento.
 *
 * O rateio sai PRIMEIRO, e e ele que desfaz a baixa: `trg_recalcula_baixa`
 * dispara no DELETE, recalcula o `pago` de cada parcela e devolve a conta ao
 * status anterior. Nada disso e escrito daqui.
 *
 * Na ordem inversa o `on delete cascade` do pagamento levaria o rateio junto,
 * mas o gatilho rodaria com a linha do pagamento ja destruida — e o que se ganha
 * conferindo o resultado antes de apagar o extrato se perde.
 */
export async function apagar(pagamentoId: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("pagamentosxparcelas")
    .delete()
    .eq("fkPagamento", pagamentoId);

  if (error) throw error;

  const { error: erroPagamento } = await supabase
    .from("pagamentos")
    .delete()
    .eq("id", pagamentoId);

  if (erroPagamento) throw erroPagamento;
}

/**
 * Devolve ao saldo o que a baixa tinha perdoado.
 *
 * O inverso de `encerrarDiferenca`: o total da parcela volta a subir e o
 * desconto acumulado dela cai na mesma medida.
 */
export async function devolverDesconto(
  parcelaId: number,
  usuarioId: string,
  valor: Centavos,
): Promise<void> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasparcelas")
    .select("total, desconto")
    .eq("id", parcelaId)
    .single();

  if (error) throw error;

  const { error: erroUpdate } = await supabase
    .from("faturasparcelas")
    .update({
      total: (data.total ?? 0) + paraBanco(valor),
      // Nunca negativo: registro antigo pode ter desconto menor que o da baixa
      // se alguem mexeu na coluna a mao, e um desconto negativo viraria um
      // acrescimo silencioso.
      desconto: Math.max(0, (data.desconto ?? 0) - paraBanco(valor)),
      updated_at: new Date().toISOString(),
      fkUserModificacao: usuarioId,
    })
    .eq("id", parcelaId);

  if (erroUpdate) throw erroUpdate;
}

/**
 * A politica de multa e juros que vale para este cliente.
 *
 * Duas linhas possiveis: a da empresa (sem cliente) e a dele. A dele ganha
 * quando existe — e a excecao negociada, e existir ja e a decisao.
 */
export async function parametrosDeCobranca(
  empresaId: number,
  clienteId: number,
): Promise<ParametrosDeCobranca> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("parametroscobranca")
    .select("fkCliente, multa_percentual, juros_percentual, juros_periodo, carencia_dias")
    .eq("fkEmpresa", empresaId)
    .or(`fkCliente.eq.${clienteId},fkCliente.is.null`);

  if (error) throw error;

  const linhas = data ?? [];
  const escolhida = linhas.find((l) => l.fkCliente === clienteId) ?? linhas[0];
  if (!escolhida) return SEM_COBRANCA;

  return {
    multaPercentual: escolhida.multa_percentual ?? 0,
    jurosPercentual: escolhida.juros_percentual ?? 0,
    jurosPeriodo: escolhida.juros_periodo ?? "MES",
    carenciaDias: escolhida.carencia_dias ?? 0,
  };
}

/** Nome do cliente para a descricao do lancamento no extrato. */
export async function nomeDoCliente(empresaId: number, clienteId: number): Promise<string | null> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("razao, nomefantasia")
    .eq("fkEmpresa", empresaId)
    .eq("id", clienteId)
    .maybeSingle();

  if (error) throw error;
  return data ? primeiroPreenchido(data.nomefantasia, data.razao) : null;
}
