import { serverClient } from "@/infra/supabase/client";
import { doBanco, type Centavos } from "@/shared/utils/money";

/**
 * De que documento veio um pagamento.
 *
 * ⚠️ Modulo proprio porque DOIS lugares perguntam a mesma coisa: a conciliacao,
 * para dizer contra o que a linha do banco esta casando, e o extrato, para dizer
 * a que titulo cada movimento pertence. Escrita duas vezes, a sigla e o formato
 * do rotulo divergiriam, e a mesma baixa apareceria com dois nomes em duas telas
 * do mesmo sistema.
 */

/**
 * O documento de onde o dinheiro veio, em peca inteira.
 *
 * ⚠️ ESTRUTURADO, e nao so o rotulo. A tela do extrato abre o titulo com um
 * clique, e para isso precisa do TIPO e do ID — nao de "CR 180 P 2" para
 * desmontar com expressao regular. O rotulo vem junto porque quem so mostra
 * texto (a conciliacao) nao deve ter de remonta-lo e arriscar outro formato.
 */
export type DocumentoDoPagamento = {
  rotulo: string;
  /** `MOV` quando nao ha titulo por tras: tarifa, rendimento, baixa do legado. */
  tipo: "CR" | "CP" | "MOV";
  /** O id da conta a receber ou a pagar. Nulo no `MOV`. */
  contaId: number | null;
  /** A parcela, quando o pagamento quitou exatamente uma. */
  parcela: number | null;
  /**
   * TODAS as contas que este pagamento quitou, com numero e valor.
   *
   * ⚠️ Lista, e nao so a primeira. Um boleto de 2.300 pode quitar duas contas de
   * fornecedores diferentes, e o rotulo cabia num numero so: a linha dizia
   * "CP 168 +1" e o clique abria sempre a primeira, sem dizer qual era a outra
   * nem como chegar nela. Com a lista, a dica mostra numero e valor de cada uma,
   * e o clique pergunta qual abrir.
   *
   * Vazia no `MOV`: nao ha documento por tras.
   */
  origens: OrigemDoPagamento[];
};

/** Uma das contas que o pagamento quitou. */
export type OrigemDoPagamento = {
  tipo: "CR" | "CP";
  /** A chave do banco: e ela que abre o drawer. */
  contaId: number;
  /**
   * O numero que a pessoa ve.
   *
   * ⚠️ `idtenant`, e nao `id`. O sistema e multiempresa: `id` e a sequencia
   * global, e o numero da conta a receber que o cliente conhece — o que esta no
   * boleto e na tela — e o da empresa. O extrato mostrava 190 e 191 para as
   * contas que a tela de contas a receber chama de 168 e 169.
   */
  numero: number;
  /** A parcela, quando este pagamento tocou exatamente uma desta conta. */
  parcela: number | null;
  /** Quanto DESTE pagamento foi para esta conta. */
  valor: Centavos;
};

/**
 * De que documento veio cada pagamento: conta a receber, a pagar, ou nenhuma.
 *
 * ⚠️ DUAS consultas em paralelo, e nao um join. Os dois lados do dinheiro moram
 * em tabelas diferentes — `pagamentosxparcelas` para o que entra e
 * `pagamentosxparcelaspagar` para o que sai — e nao ha caminho unico do
 * pagamento ate o documento. Uma consulta por pagamento seria N idas ao banco
 * numa lista que costuma ter dezenas.
 *
 * ⚠️ O lado que PAGA vem do RATEIO, e nao de `contaspagarparcelas.fkPagamento`.
 *
 * Aquela coluna guarda so o ULTIMO pagamento da parcela, porque o gatilho a
 * sobrescreve a cada baixa. Numa parcela paga em duas vezes, a PRIMEIRA baixa
 * nao era encontrada por caminho nenhum e o extrato a rotulava "MOV" — dizendo
 * que nao havia titulo por tras de um dinheiro que quitou a CP 266. O rateio tem
 * uma linha por baixa e nao perde nenhuma.
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
export async function documentosDePagamentos(
  pagamentoIds: number[],
): Promise<Map<number, DocumentoDoPagamento>> {
  const mapa = new Map<number, DocumentoDoPagamento>();
  if (pagamentoIds.length === 0) return mapa;

  const supabase = await serverClient();

  const [receber, pagar] = await Promise.all([
    supabase
      .from("pagamentosxparcelas")
      .select("fkPagamento, valor, faturasparcelas!inner(fkFatura, numeroparcela)")
      .in("fkPagamento", pagamentoIds),
    supabase
      .from("pagamentosxparcelaspagar")
      .select("fkPagamento, valor, contaspagarparcelas!inner(fkContaPagar, numeroparcela)")
      .in("fkPagamento", pagamentoIds),
  ]);

  if (receber.error) throw receber.error;
  if (pagar.error) throw pagar.error;

  type Conta = { contaId: number; parcelas: Set<number>; valor: number };
  type Origem = { sigla: "CR" | "CP"; contas: Map<number, Conta> };
  const origens = new Map<number, Origem>();

  const juntar = (
    pagamentoId: number | null,
    sigla: "CR" | "CP",
    contaId: number | null,
    parcela: number | null,
    valor: number,
  ) => {
    if (pagamentoId == null || contaId == null) return;

    const atual = origens.get(pagamentoId) ?? { sigla, contas: new Map<number, Conta>() };
    const conta = atual.contas.get(contaId) ?? {
      contaId,
      parcelas: new Set<number>(),
      valor: 0,
    };

    if (parcela != null) conta.parcelas.add(parcela);
    conta.valor += valor;

    atual.contas.set(contaId, conta);
    origens.set(pagamentoId, atual);
  };

  for (const l of receber.data ?? []) {
    const p = l.faturasparcelas as unknown as {
      fkFatura: number | null;
      numeroparcela: number | null;
    } | null;
    juntar(l.fkPagamento, "CR", p?.fkFatura ?? null, p?.numeroparcela ?? null, doBanco(l.valor));
  }
  for (const l of pagar.data ?? []) {
    const p = l.contaspagarparcelas as unknown as {
      fkContaPagar: number | null;
      numeroparcela: number | null;
    } | null;

    /*
     * ⚠️ O valor e o do RATEIO — o que ESTA baixa aplicou —, e nao o total da
     * parcela. Uma parcela paga em dois pedacos apareceria com o valor cheio nas
     * duas linhas do extrato, e a soma das origens passaria do valor do
     * movimento.
     */
    juntar(l.fkPagamento, "CP", p?.fkContaPagar ?? null, p?.numeroparcela ?? null, doBanco(l.valor));
  }

  const numeros = await numerosDasContas(origens);

  for (const id of pagamentoIds) {
    const origem = origens.get(id);

    if (!origem) {
      mapa.set(id, {
        rotulo: `MOV ${id}`,
        tipo: "MOV",
        contaId: null,
        parcela: null,
        origens: [],
      });
      continue;
    }

    const lista: OrigemDoPagamento[] = [...origem.contas.values()]
      .map((c) => {
        const parcelas = [...c.parcelas];
        return {
          tipo: origem.sigla,
          contaId: c.contaId,
          numero: numeros.get(`${origem.sigla}:${c.contaId}`) ?? c.contaId,
          parcela: parcelas.length === 1 ? parcelas[0] : null,
          valor: c.valor as Centavos,
        };
      })
      /* Pelo NUMERO, que e o que a dica mostra: ordenar pelo id do banco poria a
         lista fora da ordem que a pessoa le. */
      .sort((a, b) => a.numero - b.numero);

    const sobra = lista.length - 1;
    const primeira = lista[0];

    const base = `${origem.sigla} ${primeira.numero}`;
    const comParcela =
      sobra === 0 && primeira.parcela != null ? `${base} P ${primeira.parcela}` : base;

    mapa.set(id, {
      rotulo: sobra > 0 ? `${comParcela} +${sobra}` : comParcela,
      tipo: origem.sigla,
      /* Com mais de uma conta, o id e o da PRIMEIRA — mas quem tem a lista
         inteira (o extrato) pergunta qual abrir em vez de usar este. Ele fica
         para quem so sabe abrir uma. */
      contaId: primeira.contaId,
      parcela: sobra === 0 ? primeira.parcela : null,
      origens: lista,
    });
  }

  return mapa;
}

/**
 * O numero por empresa (`idtenant`) de cada conta citada.
 *
 * ⚠️ Duas consultas, uma por lado, e nao uma por conta. As contas a receber e a
 * pagar sao tabelas diferentes e cada uma tem a sua sequencia por empresa — CR 1
 * e CP 1 existem ao mesmo tempo, e sao documentos sem relacao.
 *
 * ⚠️ Sem `idtenant` o numero cai para o `id`. Registro do legado pode nao ter
 * recebido a numeracao, e mostrar vazio seria pior que mostrar a chave.
 */
async function numerosDasContas(
  origens: Map<number, { sigla: "CR" | "CP"; contas: Map<number, unknown> }>,
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();

  const receber = new Set<number>();
  const pagar = new Set<number>();

  for (const origem of origens.values()) {
    for (const contaId of origem.contas.keys()) {
      (origem.sigla === "CR" ? receber : pagar).add(contaId);
    }
  }

  if (receber.size === 0 && pagar.size === 0) return mapa;

  const supabase = await serverClient();

  const [cr, cp] = await Promise.all([
    receber.size > 0
      ? supabase.from("faturas").select("id, idtenant").in("id", [...receber])
      : null,
    pagar.size > 0
      ? supabase.from("contaspagar").select("id, numero").in("id", [...pagar])
      : null,
  ]);

  if (cr?.error) throw cr.error;
  if (cp?.error) throw cp.error;

  /*
   * ⚠️ Colunas DIFERENTES nos dois lados, e nao um descuido.
   *
   * A conta a receber conta por `idtenant`; a conta a pagar tem coluna `numero`
   * propria, e e ela que a tela de contas a pagar mostra. Usando a mesma nos
   * dois, um dos lados passaria a exibir no extrato um numero que nao aparece em
   * lugar nenhum do resto do sistema — que era o defeito daqui.
   */
  for (const l of cr?.data ?? []) mapa.set(`CR:${l.id}`, l.idtenant ?? l.id);
  for (const l of cp?.data ?? []) mapa.set(`CP:${l.id}`, l.numero ?? l.id);

  return mapa;
}
