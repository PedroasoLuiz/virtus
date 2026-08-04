import { somar, ZERO, type Centavos } from "@/shared/utils/money";
import * as repo from "@/modules/portal/portal.repository";
import type { CarteiraDoCliente } from "@/modules/portal/portal.types";

/**
 * Regra do portal.
 *
 * Quase nao ha: o escopo e da RLS e o resto e soma. O que existe aqui e a
 * decisao do que TOTALIZAR — e ela e de negocio, nao de tela.
 */

export async function carteira(): Promise<CarteiraDoCliente> {
  const [clientes, parcelas] = await Promise.all([repo.meusClientes(), repo.minhasParcelas()]);

  /*
   * Os totais contam so o que esta em ABERTO.
   *
   * Somar o que ja foi pago daria um numero maior que a divida e o cliente
   * ligaria perguntando por que "deve" o que quitou mes passado. O historico
   * continua na lista, linha a linha.
   */
  const abertas = parcelas.filter((p) => !p.pago && p.emAberto > 0);

  // Deduz das parcelas em vez de consultar `empresas`: a lista precisa ser a de
  // quem REALMENTE cobrou este cliente, e nao a de todas as empresas que ele
  // enxerga — um filtro que oferece opcao sem resultado ensina a nao usar filtro.
  const emitentes = [...new Map(parcelas.map((p) => [p.emitente.id, p.emitente])).values()].sort(
    (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return {
    clientes,
    emitentes,
    parcelas,
    emAberto: abertas.reduce<Centavos>((s, p) => somar(s, p.emAberto), ZERO),
    vencido: abertas
      .filter((p) => p.atrasada)
      .reduce<Centavos>((s, p) => somar(s, p.emAberto), ZERO),
  };
}
