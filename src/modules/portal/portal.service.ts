import { somar, ZERO, type Centavos } from "@/shared/utils/money";
import * as repo from "@/modules/portal/portal.repository";
import type { CarteiraDoCliente, Emitente } from "@/modules/portal/portal.types";

/**
 * Regra do portal.
 *
 * Quase nao ha: o escopo e da RLS e o resto e soma. O que existe aqui e a
 * decisao do que TOTALIZAR e de qual emitente mostrar — as duas de negocio, nao
 * de tela.
 */

/**
 * O que o cliente ve, de UMA empresa emissora por vez.
 *
 * Uma e nao todas porque cobranca da Virtus e cobranca da PMX sao acordos
 * separados, com documento e conta bancaria proprios. Somadas num quadro so, o
 * total nao corresponde a nada que ele possa pagar de uma vez.
 */
export async function carteira(emitenteEscolhido?: number): Promise<CarteiraDoCliente> {
  const clientes = await repo.meusClientes();

  const [parcelas, orcamentos] = await Promise.all([
    repo.minhasParcelas(clientes),
    repo.meusOrcamentos(clientes),
  ]);

  // Deduzidos do que REALMENTE cobrou este cliente, e nao da lista de empresas
  // que ele enxerga: uma opcao sem resultado ensina a nao usar o seletor.
  const emitentes = [
    ...new Map(
      [...parcelas, ...orcamentos].map((p) => [p.emitente.id, p.emitente]),
    ).values(),
  ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const emitenteAtual: Emitente | null =
    emitentes.find((e) => e.id === emitenteEscolhido) ?? emitentes[0] ?? null;

  const doEmitente = <T extends { emitente: Emitente }>(itens: T[]) =>
    emitenteAtual ? itens.filter((i) => i.emitente.id === emitenteAtual.id) : [];

  const minhas = doEmitente(parcelas);

  /*
   * Os totais contam so o que esta em ABERTO.
   *
   * Somar o que ja foi pago daria um numero maior que a divida, e o cliente
   * ligaria perguntando por que "deve" o que quitou mes passado. O historico
   * continua no quadro, na coluna das pagas.
   */
  const abertas = minhas.filter((p) => !p.pago && p.emAberto > 0);

  return {
    clientes,
    emitentes,
    emitenteAtual,
    orcamentos: doEmitente(orcamentos),
    parcelas: minhas,
    emAberto: abertas.reduce<Centavos>((s, p) => somar(s, p.emAberto), ZERO),
    vencido: abertas
      .filter((p) => p.atrasada)
      .reduce<Centavos>((s, p) => somar(s, p.emAberto), ZERO),
  };
}
