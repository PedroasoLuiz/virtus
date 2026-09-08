import { serverClient } from "@/infra/supabase/client";
import { documentosDePagamentos } from "@/modules/documentos/documentos.repository";
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
 * Tres tabelas: `extratobancario`, que e o que o banco mandou; `pagamentos`, que
 * e o que a empresa lancou; e `extratovinculos`, que guarda a afirmacao de que
 * uma linha de cada lado sao o mesmo dinheiro.
 *
 * ⚠️ O vinculo e uma TABELA porque um credito do banco pode pagar varias contas:
 * a Cresol compensa dois boletos de clientes diferentes num deposito so. No
 * sistema sao dois recebimentos — um pagamento e de um pagador so —, e no extrato
 * e uma linha. Enquanto isso era uma coluna, um dos dois conciliava e o outro
 * ficava pendente para sempre.
 *
 * ⚠️ `conciliado` continua nas duas pontas e e CONSEQUENCIA dos vinculos, e nao o
 * registro deles: e por ele que as listas filtram, e contar vinculos a cada
 * leitura seria uma junta para responder sim ou nao. Por isso gravar e desfazer
 * passam por aqui, e nao por caminhos separados — quem escreve o vinculo escreve
 * as duas bandeiras junto.
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
    .select("id, data, valor, nome, descricao, conciliado")
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .gte("data", de)
    .lte("data", ate)
    .order("data", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  const vinculos = await vinculosDasLinhas(
    empresaId,
    (data ?? []).map((l) => l.id),
  );

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
    pagamentoIds: vinculos.get(l.id) ?? [],
  }));
}

/**
 * Com quem cada linha da pagina casou.
 *
 * ⚠️ UMA consulta para a pagina inteira, e nao uma por linha. Um extrato mensal
 * traz duzentas linhas; perguntando uma a uma, abrir a tela eram duzentas idas ao
 * banco para responder a mesma pergunta com o id trocado.
 */
async function vinculosDasLinhas(
  empresaId: number,
  linhaIds: number[],
): Promise<Map<number, number[]>> {
  const mapa = new Map<number, number[]>();
  if (linhaIds.length === 0) return mapa;

  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("extratovinculos")
    .select("id, fkExtrato, fkPagamento")
    .eq("fkEmpresa", empresaId)
    .in("fkExtrato", linhaIds)
    .order("id", { ascending: true });

  if (error) throw error;

  for (const v of data ?? []) {
    const lista = mapa.get(v.fkExtrato) ?? [];
    lista.push(v.fkPagamento);
    mapa.set(v.fkExtrato, lista);
  }

  return mapa;
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
    .select(
      "id, data_caixa, valor, natureza, nome, descricao, tipo, conciliado",
    )
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .gte("data_caixa", de)
    .lte("data_caixa", ate)
    .order("data_caixa", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  const documentos = await documentosDePagamentos(
    (data ?? []).map((p) => p.id),
  );

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
        documento: documentos.get(p.id)?.rotulo ?? null,
      };
    });
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

  /*
   * ⚠️ UMA consulta, pela JANELA DE DATAS — e nao um `in` com as chaves.
   *
   * Antes eram duas: um `in("hash", ...)` com uma chave por linha do arquivo, e
   * outro `in("data", ...)` com um dia por linha. A chave e base64 de mais de
   * cem caracteres, e o cliente do Supabase manda tudo isso na URL: com as 99
   * linhas do primeiro extrato ja dava quatorze mil caracteres, e com as 302 do
   * arquivo de um ano a URL passou do limite do servidor e a IMPORTACAO FALHOU
   * inteira. A janela pede o mesmo dado em duas datas.
   */
  const dias = candidatas.map((c) => c.data).sort();
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];

  const { data: existentes, error: erroLeitura } = await supabase
    .from("extratobancario")
    .select("id, data, valor, nome, descricao, hash")
    .eq("fkEmpresa", empresaId)
    .eq("fkContaBancaria", contaId)
    .gte("data", primeiro)
    .lte("data", ultimo);

  if (erroLeitura) throw erroLeitura;

  const jaGravadas = new Set((existentes ?? []).map((e) => e.hash));

  /*
   * ⚠️ A segunda peneira, por CONTEUDO, existe porque a chave nao basta.
   *
   * A chave e exata: `conta|data|valor|tipo|nome|indice`. Ela so reconhece uma
   * linha gravada com o MESMO texto — e o legado gravava outro. Ele guardava o
   * nome curto da contraparte ("CAMILA TEODORO MARTINS"); o OFX traz o historico
   * inteiro ("Transf Pix enviada - CAMILA TEODORO MARTINS - 148..."). Reimportar
   * um mes ja carregado pelo legado duplicaria o mes inteiro, e cada linha
   * duplicada e uma conciliacao a mais para alguem fazer contra dinheiro que ja
   * foi conferido.
   *
   * A comparacao e por DIA, VALOR ABSOLUTO e nome que se contem — e cada linha
   * ja gravada e consumida uma vez so, senao dois lancamentos iguais no mesmo
   * dia casariam os dois com a mesma linha antiga e o segundo sumiria.
   */
  const disponiveis = new Map<string, { id: number; textos: string[] }[]>();
  for (const linha of existentes ?? []) {
    const chave = `${linha.data?.slice(0, 10)}|${Math.abs(doBanco(linha.valor))}`;
    const lista = disponiveis.get(chave) ?? [];

    /*
     * ⚠️ `nome` e `descricao` entram SEPARADOS, e nao juntos num texto so.
     *
     * Ha DUAS geracoes de linha antiga no banco, e elas guardam o historico em
     * campos diferentes. A primeira importacao do legado gravou `nome` NULO e o
     * historico em `descricao` ("Transf Pix enviada"); a segunda gravou o nome
     * curto da contraparte em `nome` e "DEBIT"/"CREDIT" em `descricao`.
     *
     * Juntando os dois num texto, nenhuma das duas casa: "CAMILA TEODORO
     * MARTINS DEBIT" nao esta contido no historico do arquivo. Testados um a um,
     * os dois casam — e foi a geracao de `nome` nulo que escapou e duplicou onze
     * linhas de novembro na importacao do Pedro.
     */
    lista.push({
      id: linha.id,
      textos: [linha.nome ?? "", linha.descricao ?? ""].filter(Boolean),
    });
    disponiveis.set(chave, lista);
  }

  const usadas = new Set<number>();

  function jaExisteNoBanco(
    c: (typeof candidatas)[number],
    valor: Centavos,
  ): boolean {
    const lista = disponiveis.get(`${c.data}|${Math.abs(valor)}`);
    if (!lista) return false;

    const nova = normalizarHistorico(c.nome);
    if (!nova) return false;

    const igual = lista.find((l) => {
      if (usadas.has(l.id)) return false;

      return l.textos.some((texto) => {
        const antiga = normalizarHistorico(texto);
        return Boolean(antiga) && (nova.includes(antiga) || antiga.includes(nova));
      });
    });

    if (!igual) return false;

    usadas.add(igual.id);
    return true;
  }

  const novas = candidatas.filter((c, i) => {
    if (jaGravadas.has(c.hash)) return false;
    return !jaExisteNoBanco(c, linhas[i].valor);
  });

  if (novas.length > 0) {
    const { error } = await supabase.from("extratobancario").insert(novas);
    if (error) throw error;
  }

  return {
    lidas: linhas.length,
    gravadas: novas.length,
    repetidas: linhas.length - novas.length,
  };
}

/**
 * Afirma que a linha e o lancamento sao o mesmo dinheiro.
 *
 * ⚠️ TRES escritas, sempre. O vinculo em `extratovinculos` e a afirmacao; os dois
 * `conciliado` sao as bandeiras que a tela de extrato e o fechamento leem.
 * Gravando so uma parte, um lado mostra conferido e o outro mostra pendente — e
 * nao ha como saber qual dos dois esta certo.
 *
 * ⚠️ A linha ACEITA outro vinculo depois de conciliada, e e para isso que a
 * tabela existe: o segundo boleto do mesmo deposito chega assim.
 *
 * ⚠️ Ja o LANCAMENTO nao: `UNIQUE(fkPagamento)` no banco recusa amarra-lo a uma
 * segunda linha. Sem isso, o mesmo recebimento apareceria em dois creditos do
 * extrato e o saldo fecharia contando o dinheiro duas vezes.
 */
export async function vincular(
  empresaId: number,
  linhaId: number,
  pagamentoId: number,
  usuarioId: string,
): Promise<void> {
  const supabase = await serverClient();

  const { error: erroVinculo } = await supabase.from("extratovinculos").insert({
    fkEmpresa: empresaId,
    fkExtrato: linhaId,
    fkPagamento: pagamentoId,
    fkUserCriacao: usuarioId,
  });

  /*
   * ⚠️ `23505` e a UNIQUE, e nao um defeito: e a tela mandando duas vezes o mesmo
   * par. O estado desejado ja existe, e as bandeiras abaixo fecham o que faltava.
   * O caso de roubar um lancamento de outra linha nao chega aqui — o servico
   * recusa antes, com nome e numero da linha que ja o tem.
   */
  if (erroVinculo && erroVinculo.code !== "23505") throw erroVinculo;

  const { error: erroLinha } = await supabase
    .from("extratobancario")
    .update({ conciliado: true })
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

/**
 * Desfaz o vinculo — um so, ou todos os da linha.
 *
 * ⚠️ `pagamentoId` sendo opcional e o que separa os dois gestos da tela. Numa
 * linha que casou com tres lancamentos, "desfazer este" tira um e deixa os outros
 * dois de pe; sem ele, corrigir um dos tres obrigava a refazer os tres.
 *
 * ⚠️ A linha so volta a PENDENTE quando nao sobra vinculo nenhum. Limpando a
 * bandeira junto com o primeiro vinculo removido, uma linha ainda casada com dois
 * lancamentos reapareceria como pendente, convidando a conciliar de novo o que ja
 * esta conciliado.
 */
export async function desvincular(
  empresaId: number,
  linhaId: number,
  pagamentoId?: number,
): Promise<void> {
  const supabase = await serverClient();

  /* Quais saem — precisa saber ANTES de apagar, para limpar `pagamentos`. */
  let consulta = supabase
    .from("extratovinculos")
    .select("fkPagamento")
    .eq("fkEmpresa", empresaId)
    .eq("fkExtrato", linhaId);

  if (pagamentoId != null) consulta = consulta.eq("fkPagamento", pagamentoId);

  const { data, error } = await consulta;
  if (error) throw error;

  const saindo = (data ?? []).map((v) => v.fkPagamento);

  if (saindo.length > 0) {
    const { error: erroApagar } = await supabase
      .from("extratovinculos")
      .delete()
      .eq("fkEmpresa", empresaId)
      .eq("fkExtrato", linhaId)
      .in("fkPagamento", saindo);

    if (erroApagar) throw erroApagar;

    const { error: erroPagamento } = await supabase
      .from("pagamentos")
      .update({ conciliado: false })
      .eq("fkEmpresa", empresaId)
      .in("id", saindo);

    if (erroPagamento) throw erroPagamento;
  }

  const { count, error: erroConta } = await supabase
    .from("extratovinculos")
    .select("id", { count: "exact", head: true })
    .eq("fkEmpresa", empresaId)
    .eq("fkExtrato", linhaId);

  if (erroConta) throw erroConta;
  if ((count ?? 0) > 0) return;

  const { error: erroLinha } = await supabase
    .from("extratobancario")
    .update({ conciliado: false })
    .eq("fkEmpresa", empresaId)
    .eq("id", linhaId);

  if (erroLinha) throw erroLinha;
}

/**
 * O valor da linha e a soma do que ja esta casado com ela.
 *
 * ⚠️ Le o valor dos lancamentos VINCULADOS, e nao os do periodo carregado na
 * tela. A linha pode ter casado com um lancamento de outro mes — a conciliacao
 * puxa a data da baixa para o dia do extrato, mas o vinculo pode ser antigo — e
 * somando so o que a tela mostra, uma linha ja fechada pareceria ter espaco.
 *
 * ⚠️ O sinal do extrato segue a mesma leitura de `linhasDoExtrato`: valor
 * negativo gravado manda, e sem sinal quem decide e o tipo. Duas regras
 * diferentes para o mesmo campo fariam a saida fechar como entrada.
 */
export async function saldoDaLinha(
  empresaId: number,
  linhaId: number,
): Promise<{ valor: Centavos; casado: Centavos } | null> {
  const supabase = await serverClient();

  const { data: linha, error } = await supabase
    .from("extratobancario")
    .select("valor, descricao")
    .eq("fkEmpresa", empresaId)
    .eq("id", linhaId)
    .maybeSingle();

  if (error) throw error;
  if (!linha) return null;

  const valor = (
    linha.valor != null && linha.valor < 0
      ? doBanco(linha.valor)
      : ehSaida(linha.descricao)
        ? -doBanco(linha.valor)
        : doBanco(linha.valor)
  ) as Centavos;

  const { data: vinculos, error: erroVinculos } = await supabase
    .from("extratovinculos")
    .select("fkPagamento")
    .eq("fkEmpresa", empresaId)
    .eq("fkExtrato", linhaId);

  if (erroVinculos) throw erroVinculos;

  const ids = (vinculos ?? []).map((v) => v.fkPagamento);
  if (ids.length === 0) return { valor, casado: 0 as Centavos };

  const { data: pagamentos, error: erroPagamentos } = await supabase
    .from("pagamentos")
    .select("valor, natureza")
    .eq("fkEmpresa", empresaId)
    .in("id", ids);

  if (erroPagamentos) throw erroPagamentos;

  const casado = (pagamentos ?? []).reduce((soma, p) => {
    const bruto = doBanco(Math.abs(p.valor ?? 0));
    return soma + (p.natureza === RECEITA ? bruto : -bruto);
  }, 0) as Centavos;

  return { valor, casado };
}

/**
 * De que linha do extrato cada um destes lancamentos ja e.
 *
 * ⚠️ Existe para o servico poder RECUSAR com nome: `UNIQUE(fkPagamento)` barraria
 * de qualquer jeito, mas com um erro de banco que nao diz onde o lancamento esta.
 * Quem concilia precisa saber qual linha o tomou para poder desfazer aquela.
 */
export async function linhasDosLancamentos(
  empresaId: number,
  pagamentoIds: number[],
): Promise<Map<number, number>> {
  const mapa = new Map<number, number>();
  if (pagamentoIds.length === 0) return mapa;

  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("extratovinculos")
    .select("fkExtrato, fkPagamento")
    .eq("fkEmpresa", empresaId)
    .in("fkPagamento", pagamentoIds);

  if (error) throw error;

  for (const v of data ?? []) mapa.set(v.fkPagamento, v.fkExtrato);
  return mapa;
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
 * ⚠️ E o lado de `pagamentos` do lote. Os vinculos e a bandeira das linhas ficam
 * com `apontarLinhas`, que grava todos de uma vez.
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

/**
 * Grava os vinculos do lote e marca as linhas, sem tocar em `pagamentos`.
 *
 * ⚠️ Um upsert so para todos os pares, e nao um por par. Era uma ida ao banco por
 * linha; cinquenta pares conferidos eram cinquenta viagens para gravar o que cabe
 * numa. O lado de `pagamentos` fecha em `marcarPagamentosConciliados`.
 *
 * ⚠️ `ignoreDuplicates` porque o par pode ja existir: reenviar o lote depois de
 * uma queda nao pode virar erro no meio, com metade gravada.
 */
export async function apontarLinhas(
  empresaId: number,
  pares: { linhaId: number; pagamentoId: number }[],
  usuarioId: string,
): Promise<void> {
  if (pares.length === 0) return;

  const supabase = await serverClient();

  const { error: erroVinculos } = await supabase.from("extratovinculos").upsert(
    pares.map((p) => ({
      fkEmpresa: empresaId,
      fkExtrato: p.linhaId,
      fkPagamento: p.pagamentoId,
      fkUserCriacao: usuarioId,
    })),
    { onConflict: "fkExtrato,fkPagamento", ignoreDuplicates: true },
  );

  if (erroVinculos) throw erroVinculos;

  const { error } = await supabase
    .from("extratobancario")
    .update({ conciliado: true })
    .eq("fkEmpresa", empresaId)
    .in(
      "id",
      pares.map((p) => p.linhaId),
    );

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
export async function contaPertence(
  empresaId: number,
  contaId: number,
): Promise<boolean> {
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

/**
 * As datas de um lancamento, e as datas das linhas do extrato que serao casadas.
 *
 * ⚠️ Uma consulta para os dois lados, e nao uma por par. Conciliar em lote pode
 * levar dezenas de pares, e o alinhamento de data precisa das duas pontas de
 * cada um antes de gravar qualquer coisa.
 */
export async function datasDosLancamentos(
  empresaId: number,
  pagamentoIds: number[],
): Promise<
  Map<number, { data: string; dataCredito: string | null; dataCaixa: string }>
> {
  const mapa = new Map<
    number,
    { data: string; dataCredito: string | null; dataCaixa: string }
  >();
  if (pagamentoIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("pagamentos")
    .select("id, data, data_credito, data_caixa")
    .eq("fkEmpresa", empresaId)
    .in("id", pagamentoIds);

  if (error) throw error;

  for (const p of data ?? []) {
    if (!p.data_caixa || !p.data) continue;
    mapa.set(p.id, {
      data: p.data.slice(0, 10),
      dataCredito: p.data_credito?.slice(0, 10) ?? null,
      dataCaixa: p.data_caixa.slice(0, 10),
    });
  }

  return mapa;
}

export async function datasDasLinhas(
  empresaId: number,
  linhaIds: number[],
): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (linhaIds.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("extratobancario")
    .select("id, data")
    .eq("fkEmpresa", empresaId)
    .in("id", linhaIds);

  if (error) throw error;

  for (const l of data ?? []) if (l.data) mapa.set(l.id, l.data.slice(0, 10));
  return mapa;
}

/**
 * Puxa a data do lancamento para o dia em que o banco diz que o dinheiro andou.
 *
 * ⚠️ Escreve na coluna que MANDA no caixa, que nem sempre e `data`. `data_caixa`
 * e `coalesce(data_credito, data)`: com credito preenchido — venda no cartao, em
 * que a adquirente segura o dinheiro —, e ele que representa o dia no banco, e a
 * `data` continua sendo o dia da venda. Escrevendo sempre em `data`, a correcao
 * nao chegaria ao caixa e ainda mentiria sobre quando a venda aconteceu.
 */
export async function alinharDataComExtrato(
  empresaId: number,
  pagamentoId: number,
  usuarioId: string,
  data: string,
  temCredito: boolean,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("pagamentos")
    .update({
      ...(temCredito ? { data_credito: data } : { data }),
      updated_at: new Date().toISOString(),
      fkUserModificacao: usuarioId,
    })
    .eq("fkEmpresa", empresaId)
    .eq("id", pagamentoId);

  if (error) throw error;
}

/**
 * O historico reduzido ao que da para comparar entre duas geracoes de linha.
 *
 * ⚠️ Sem acento, sem pontuacao e em caixa alta, porque os dois lados escrevem
 * diferente: o legado gravou "CAMILA TEODORO MARTINS" e o OFX manda "Transf Pix
 * enviada - CAMILA TEODORO MARTINS - 148.236.136-00". O que sobra depois da
 * limpeza e o que os dois tem em comum.
 */
function normalizarHistorico(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
