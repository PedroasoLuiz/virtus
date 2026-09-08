import { BusinessRuleError } from "@/shared/errors/app-error";
import type { DataISO } from "@/shared/utils/datas";
import {
  porMesDeVencimento,
  somar,
  vencido,
} from "@/shared/domain/relatorio-parcelas";
import * as repo from "@/modules/relatorios/relatorios.repository";
import type {
  CartaoNoRelatorio,
  LadoDoRelatorio,
  Relatorio,
} from "@/modules/relatorios/relatorios.types";
import type { Centavos } from "@/shared/utils/money";

/**
 * O relatorio de um periodo, ja agrupado por mes.
 *
 * O agrupamento e a soma vem de `shared/domain/relatorio-parcelas`, que a tela e
 * o PDF tambem usam: um relatorio cujo total nao bate com a soma das linhas e
 * pior que relatorio nenhum.
 */
export async function relatorio(
  empresaId: number,
  lado: LadoDoRelatorio,
  de: DataISO,
  ate: DataISO,
  comCartao = false,
): Promise<Relatorio> {
  /*
   * ⚠️ O periodo INVERTIDO e recusado, e nao corrigido em silencio.
   *
   * `BETWEEN` com o comeco depois do fim devolve vazio, e vazio aqui significa
   * "nao ha nada a cobrar" — uma afirmacao forte sobre o dinheiro da empresa,
   * dita por engano de digitacao. Trocar os dois de lugar sozinho seria decidir
   * pela pessoa qual dos dois campos ela errou.
   */
  if (de > ate) {
    throw new BusinessRuleError(
      "A data inicial é posterior à final: o período não existe.",
    );
  }

  const parcelas = await repo.parcelasEmAberto(empresaId, lado, de, ate);

  /*
   * ⚠️ O cartao so existe do lado que PAGA, e so quando pedido.
   *
   * Cartao de credito e divida da empresa; nao ha equivalente do lado que
   * recebe. E `null` significa "nao perguntou", diferente de lista vazia, que
   * significa "perguntou e nao ha ciclo aberto no periodo" — as duas coisas se
   * leem diferente no papel.
   */
  const cartao: CartaoNoRelatorio | null =
    lado === "pagar" && comCartao
      ? await resumoDoCartao(empresaId, de, ate)
      : null;

  const totalDasParcelas = somar(parcelas);

  return {
    lado,
    de,
    ate,
    meses: porMesDeVencimento(parcelas),
    cartao,
    /* O total FECHA com o que esta impresso: soma o cartao quando ele entrou. */
    total: (totalDasParcelas + (cartao?.total ?? 0)) as Centavos,
    vencido: vencido(parcelas),
    quantidade: parcelas.length,
  };
}

async function resumoDoCartao(
  empresaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<CartaoNoRelatorio> {
  const ciclos = await repo.ciclosDeCartao(empresaId, de, ate);

  return {
    ciclos,
    total: ciclos.reduce((t, c) => t + c.total, 0) as Centavos,
  };
}
