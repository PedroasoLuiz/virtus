import { serverClient } from "@/infra/supabase/client";

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
};

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
export async function documentosDePagamentos(
  pagamentoIds: number[],
): Promise<Map<number, DocumentoDoPagamento>> {
  const mapa = new Map<number, DocumentoDoPagamento>();
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
      mapa.set(id, {
        rotulo: `MOV ${id}`,
        tipo: "MOV",
        contaId: null,
        parcela: null,
      });
      continue;
    }

    const contas = [...origem.contas].sort((a, b) => a - b);
    const sobra = contas.length - 1;
    const parcelas = [...origem.parcelas];

    const base = `${origem.sigla} ${contas[0]}`;
    const comParcela =
      sobra === 0 && parcelas.length === 1 ? `${base} P ${parcelas[0]}` : base;

    mapa.set(id, {
      rotulo: sobra > 0 ? `${comParcela} +${sobra}` : comParcela,
      tipo: origem.sigla === "CR" ? "CR" : "CP",
      /* Com mais de uma conta no mesmo pagamento, o id e o da PRIMEIRA: abrir
         uma das varias e melhor que nao abrir nenhuma, e o rotulo ja avisa que
         ha outras com o "+n". */
      contaId: contas[0],
      parcela: sobra === 0 && parcelas.length === 1 ? parcelas[0] : null,
    });
  }

  return mapa;
}
