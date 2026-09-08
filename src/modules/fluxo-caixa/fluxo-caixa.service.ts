import { BusinessRuleError } from "@/shared/errors/app-error";
import { hoje, type DataISO } from "@/shared/utils/datas";
import * as repo from "@/modules/fluxo-caixa/fluxo-caixa.repository";
import type { ProjecaoDeCaixa } from "@/modules/fluxo-caixa/fluxo-caixa.types";

/**
 * A projecao de caixa ate a data pedida.
 *
 * ⚠️ O TETO de dois anos e regra de negocio, e por isso mora aqui e nao so no
 * schema: e uma afirmacao sobre o que este relatorio significa. Alem de dois
 * anos a projecao deixa de ser previsao — ninguem tem parcela cadastrada tao
 * longe, e a curva vira uma reta que so repete o saldo de hoje.
 */
export async function projecao(
  empresaId: number,
  ate: DataISO,
  contas?: number[],
  incluirVencidos = true,
): Promise<ProjecaoDeCaixa> {
  const limite = daquiADoisAnos();

  if (ate > limite) {
    throw new BusinessRuleError(
      `A projeção vai no máximo até ${limite.split("-").reverse().join("/")}: ` +
        `dois anos à frente.`,
    );
  }

  /*
   * ⚠️ Data no passado NAO e erro, e sim uma tabela que termina onde comeca.
   *
   * A serie ja arranca no menor vencimento em aberto, que costuma ser anterior a
   * hoje. Recusar seria barrar quem so quer ver o vencido; empurrar para hoje
   * devolve ao menos o mes corrente, que e o minimo util.
   */
  /*
   * ⚠️ Lista VAZIA vira nulo, que o banco le como "todas".
   *
   * Desmarcar todas as contas na tela nao pode devolver um relatorio de saldo
   * zero: isso seria um documento que afirma que a empresa nao tem dinheiro. Sem
   * escolha, a resposta certa e a projecao inteira.
   */
  const escolhidas = contas && contas.length > 0 ? contas : null;

  return repo.projecao(
    empresaId,
    ate < hoje() ? hoje() : ate,
    escolhidas,
    incluirVencidos,
  );
}

function daquiADoisAnos(): DataISO {
  const [ano, mes, dia] = hoje().split("-");
  return `${Number(ano) + 2}-${mes}-${dia}` as DataISO;
}
