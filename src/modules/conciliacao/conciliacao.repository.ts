import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, type Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import { chaveDaLinha } from "@/shared/domain/conciliacao";
import type {
  LancamentoConciliavel,
  LinhaDoExtrato,
  LinhaImportada,
  ResultadoDaImportacao,
} from "@/modules/conciliacao/conciliacao.types";

/**
 * Unica porta de acesso aos dados da conciliacao.
 *
 * Duas tabelas: `extratobancario`, que e o que o banco mandou, e `pagamentos`,
 * que e o que a empresa lancou. O vinculo mora nas duas pontas — `fkPagamento`
 * de um lado e `conciliado` do outro —, e e por isso que gravar e desfazer
 * passam por aqui e nao por dois caminhos separados.
 */

/*
 * ⚠️ "Receitas" e "Despesas", exatamente assim: e o vocabulario que a `vwsaldo`
 * usa para decidir o sinal, e o mesmo que o modulo de recebimentos ja segue.
 */
const RECEITA = "Receitas";

export async function linhasDoExtrato(
  empresaId: number,
  contaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<LinhaDoExtrato[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("extratobancario")
    .select("id, data, valor, nome, descricao, conciliado, fkPagamento")
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .gte("data", de)
    .lte("data", ate)
    .order("data", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id,
    data: (l.data ?? de) as DataISO,
    /*
     * ⚠️ O sinal vem do PROPRIO valor gravado, e nao do tipo.
     *
     * O legado gravou o valor em modulo e a direcao em `descricao`
     * ("DEBIT"/"CREDIT"). Importacao nova grava com sinal. Ler os dois exige
     * respeitar o sinal quando ele existe e deduzir do tipo quando nao existe —
     * senao metade do extrato casa invertido.
     */
    valor: (l.valor != null && l.valor < 0
      ? doBanco(l.valor)
      : ehSaida(l.descricao)
        ? (-doBanco(l.valor) as Centavos)
        : doBanco(l.valor)) as Centavos,
    nome: l.nome?.trim() || l.descricao?.trim() || "",
    tipo: l.descricao?.trim() || "OTHER",
    conciliado: l.conciliado ?? false,
    pagamentoId: l.fkPagamento,
  }));
}

function ehSaida(tipo: string | null): boolean {
  return (tipo ?? "").toUpperCase().includes("DEBIT");
}

/**
 * Os lancamentos da conta no periodo, com o sinal da natureza.
 *
 * ⚠️ Filtra por `data_caixa` e nao por `data`, pela mesma razao que o extrato:
 * o banco enxerga o dia em que o dinheiro se moveu.
 */
export async function lancamentosDaConta(
  empresaId: number,
  contaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<LancamentoConciliavel[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .select("id, data_caixa, valor, natureza, nome, descricao, tipo, conciliado")
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .gte("data_caixa", de)
    .lte("data_caixa", ate)
    .order("data_caixa", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  const documentos = await documentosDe((data ?? []).map((p) => p.id));

  return (data ?? [])
    .filter((p) => p.data_caixa != null)
    .map((p) => {
      const modulo = doBanco(Math.abs(p.valor ?? 0));
      const entrada = (p.natureza ?? "").toLowerCase().startsWith("receita");

      return {
        id: p.id,
        data: p.data_caixa!.slice(0, 10) as DataISO,
        valor: (entrada ? modulo : -modulo) as Centavos,
        nome: p.nome?.trim() || p.descricao?.trim() || "",
        tipo: p.tipo,
        conciliado: p.conciliado ?? false,
        documento: documentos.get(p.id) ?? null,
      };
    });
}

/**
 * De que documento veio cada pagamento: conta a receber, a pagar, ou nenhuma.
 *
 * ⚠️ DUAS consultas em paralelo, e nao um join. Os dois lados do dinheiro moram
 * em tabelas diferentes — `pagamentosxparcelas` para o que entra e
 * `contaspagarparcelas` para o que sai — e nao ha caminho unico do pagamento ate
 * o documento. Uma consulta por pagamento seria N idas ao banco numa lista que
 * costuma ter dezenas.
 *
 * ⚠️ A PARCELA entra junto quando ha uma so. "CR 214" nao basta numa conta
 * parcelada em seis: o valor do extrato bate com uma das seis, e e a parcela que
 * diz qual. Com mais de uma, o rotulo volta a falar so da conta e acrescenta
 * quantas — a linha tem largura para um numero, e nao para uma lista.
 *
 * ⚠️ Sem conta nenhuma, o rotulo e "MOV" mais o id do lancamento. Tarifa,
 * rendimento e transferencia entre contas existem sem documento, e deixa-los sem
 * marca faria parecer que falta dado — quando o que falta e o documento, que
 * nunca existiu.
 */
async function documentosDe(pagamentoIds: number[]): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (pagamentoIds.length === 0) return mapa;

  const supabase = await serverClient();

  const [receber, pagar] = await Promise.all([
    supabase
      .from("pagamentosxparcelas")
      .select("fkPagamento, faturasparcelas!inner(fkFatura, numeroparcela)")
      .in("fkPagamento", pagamentoIds),
    supabase
      .from("contaspagarparcelas")
      .select("fkPagamento, fkContaPagar, numeroparcela")
      .in("fkPagamento", pagamentoIds),
  ]);

  if (receber.error) throw receber.error;
  if (pagar.error) throw pagar.error;

  type Origem = { sigla: string; contas: Set<number>; parcelas: Set<number> };
  const origens = new Map<number, Origem>();

  const juntar = (
    pagamentoId: number | null,
    sigla: string,
    contaId: number | null,
    parcela: number | null,
  ) => {
    if (pagamentoId == null || contaId == null) return;

    const atual = origens.get(pagamentoId) ?? {
      sigla,
      contas: new Set<number>(),
      parcelas: new Set<number>(),
    };
    atual.contas.add(contaId);
    if (parcela != null) atual.parcelas.add(parcela);
    origens.set(pagamentoId, atual);
  };

  for (const l of receber.data ?? []) {
    const p = l.faturasparcelas as unknown as {
      fkFatura: number | null;
      numeroparcela: number | null;
    } | null;
    juntar(l.fkPagamento, "CR", p?.fkFatura ?? null, p?.numeroparcela ?? null);
  }
  for (const l of pagar.data ?? []) {
    juntar(l.fkPagamento, "CP", l.fkContaPagar, l.numeroparcela);
  }

  for (const id of pagamentoIds) {
    const origem = origens.get(id);

    if (!origem) {
      mapa.set(id, `MOV ${id}`);
      continue;
    }

    const contas = [...origem.contas].sort((a, b) => a - b);
    const sobra = contas.length - 1;
    const parcelas = [...origem.parcelas];

    const base = `${origem.sigla} ${contas[0]}`;
    const comParcela = sobra === 0 && parcelas.length === 1 ? `${base} P ${parcelas[0]}` : base;

    mapa.set(id, sobra > 0 ? `${comParcela} +${sobra}` : comParcela);
  }

  return mapa;
}

/**
 * Grava as linhas lidas do arquivo, pulando as que ja existem.
 *
 * ⚠️ A dedup e por CHAVE e nao por consulta previa. Duas importacoes do mesmo
 * arquivo ao mesmo tempo passariam as duas por um "ja existe?" antes de qualquer
 * uma gravar; comparando com o conjunto de chaves ja gravadas e ignorando o
 * conflito, a segunda simplesmente nao acrescenta nada.
 *
 * ⚠️ O INDICE de cada linha e a posicao dela DENTRO DO DIA, e nao no arquivo.
 * E assim que o legado montou as 99 chaves existentes: reimportar dezembro com
 * um arquivo que comeca antes precisa produzir as mesmas chaves, senao o mes
 * inteiro duplica.
 */
export async function gravarLinhas(
  empresaId: number,
  contaId: number,
  linhas: LinhaImportada[],
): Promise<ResultadoDaImportacao> {
  const supabase = await serverClient();

  const porDia = new Map<string, number>();
  const candidatas = linhas.map((l) => {
    const indice = (porDia.get(l.data) ?? 0) + 1;
    porDia.set(l.data, indice);

    return {
      fkEmpresa: empresaId,
      fkContaBancaria: contaId,
      data: l.data,
      valor: paraBanco(l.valor),
      nome: l.nome,
      descricao: l.tipo,
      conciliado: false,
      hash: chaveDaLinha({
        contaId,
        data: l.data,
        valor: Math.abs(l.valor),
        tipo: l.tipo,
        nome: l.nome,
        indice,
      }),
    };
  });

  const { data: existentes, error: erroLeitura } = await supabase
    .from("extratobancario")
    .select("hash")
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .in("hash", candidatas.map((c) => c.hash));

  if (erroLeitura) throw erroLeitura;

  const jaGravadas = new Set((existentes ?? []).map((e) => e.hash));
  const novas = candidatas.filter((c) => !jaGravadas.has(c.hash));

  if (novas.length > 0) {
    const { error } = await supabase.from("extratobancario").insert(novas);
    if (error) throw error;
  }

  return { lidas: linhas.length, gravadas: novas.length, repetidas: linhas.length - novas.length };
}

/**
 * Afirma que a linha e o lancamento sao o mesmo dinheiro.
 *
 * ⚠️ As DUAS pontas, sempre. `extratobancario.fkPagamento` diz com quem a linha
 * casou; `pagamentos.conciliado` e o que a tela de extrato e o fechamento leem.
 * Gravando so uma, o extrato mostra conferido e a conciliacao mostra pendente —
 * e nao ha como saber qual das duas esta certa.
 */
export async function vincular(
  empresaId: number,
  linhaId: number,
  pagamentoId: number,
): Promise<void> {
  const supabase = await serverClient();

  const { error: erroLinha } = await supabase
    .from("extratobancario")
    .update({ fkPagamento: pagamentoId, conciliado: true })
    .eq("fkEmpresa", empresaId)
    .eq("id", linhaId);

  if (erroLinha) throw erroLinha;

  const { error: erroPagamento } = await supabase
    .from("pagamentos")
    .update({ conciliado: true })
    .eq("fkEmpresa", empresaId)
    .eq("id", pagamentoId);

  if (erroPagamento) throw erroPagamento;
}

/** Desfaz o vinculo, nas duas pontas. */
export async function desvincular(empresaId: number, linhaId: number): Promise<void> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("extratobancario")
    .select("fkPagamento")
    .eq("fkEmpresa", empresaId)
    .eq("id", linhaId)
    .maybeSingle();

  if (error) throw error;

  const { error: erroLinha } = await supabase
    .from("extratobancario")
    .update({ fkPagamento: null, conciliado: false })
    .eq("fkEmpresa", empresaId)
    .eq("id", linhaId);

  if (erroLinha) throw erroLinha;

  if (data?.fkPagamento == null) return;

  const { error: erroPagamento } = await supabase
    .from("pagamentos")
    .update({ conciliado: false })
    .eq("fkEmpresa", empresaId)
    .eq("id", data.fkPagamento);

  if (erroPagamento) throw erroPagamento;
}

/**
 * Quais destes lancamentos sao mesmo da empresa e da conta que se esta conciliando.
 *
 * ⚠️ UMA consulta para a lista inteira. Conferindo um a um, aceitar cinquenta
 * pares eram cinquenta idas ao banco antes de gravar qualquer coisa — e a
 * pergunta e a mesma para todos, so muda o id.
 */
export async function quaisPertencem(
  empresaId: number,
  contaId: number,
  pagamentoIds: number[],
): Promise<Set<number>> {
  if (pagamentoIds.length === 0) return new Set();

  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .select("id")
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .in("id", pagamentoIds);

  if (error) throw error;
  return new Set((data ?? []).map((p) => p.id));
}

/**
 * Marca varios lancamentos como conferidos de uma vez.
 *
 * ⚠️ O lado de `pagamentos` vai numa UPDATE so; o de `extratobancario` continua
 * linha a linha porque cada uma recebe um `fkPagamento` diferente, e nao ha
 * update em lote com valor por linha sem cair em upsert — que, num erro de
 * coluna omitida, apagaria dado financeiro em vez de atualizar.
 */
export async function marcarPagamentosConciliados(
  empresaId: number,
  pagamentoIds: number[],
): Promise<void> {
  if (pagamentoIds.length === 0) return;

  const supabase = await serverClient();
  const { error } = await supabase
    .from("pagamentos")
    .update({ conciliado: true })
    .eq("fkEmpresa", empresaId)
    .in("id", pagamentoIds);

  if (error) throw error;
}

/** Aponta a linha do extrato para o lancamento, sem tocar no outro lado. */
export async function apontarLinha(
  empresaId: number,
  linhaId: number,
  pagamentoId: number,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("extratobancario")
    .update({ fkPagamento: pagamentoId, conciliado: true })
    .eq("fkEmpresa", empresaId)
    .eq("id", linhaId);

  if (error) throw error;
}

/**
 * A conta bancaria e mesmo desta empresa.
 *
 * ⚠️ Existe por causa da IMPORTACAO, que e escrita. As leituras filtram por
 * `fkEmpresa` e por `fkContaBancaria` juntas, entao um id de outra empresa so
 * devolve lista vazia. Ja o insert monta a linha com o `fkEmpresa` de quem chama
 * e o `fkContaBancaria` que veio na URL: sem esta conferencia, um id trocado a
 * mao gravaria extrato da propria empresa apontando para conta alheia — dado que
 * a RLS aceita, porque o tenant da linha esta certo, e que ninguem acha depois.
 */
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

/** Confere que o lancamento e mesmo da empresa e da conta que se esta conciliando. */
export async function lancamentoPertence(
  empresaId: number,
  contaId: number,
  pagamentoId: number,
): Promise<boolean> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .select("id")
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .eq("id", pagamentoId)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

export { RECEITA };
