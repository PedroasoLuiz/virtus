"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * O elo entre a busca do topo e o filtro da tela aberta.
 *
 * ⚠️ UMA caixa de busca no sistema, e nao duas.
 *
 * Antes havia a global no topo ("modulos e funcoes") e mais um campo dentro de
 * cada listagem. Duas caixas na mesma tela obrigam a pessoa a escolher onde
 * digitar antes de saber o que procura — e a de cima, que e a que o olho acha
 * primeiro, era justamente a que nao servia para achar registro.
 *
 * Agora a de cima faz as duas coisas: digitar filtra a tela ATRAS dela ao vivo,
 * e embaixo ficam os modulos com aquele nome.
 *
 * ⚠️ Quem manda no filtro continua sendo A TELA. Ela e dona do seu `useState`,
 * como sempre foi, e so ANUNCIA aqui como se chama e como se busca nela. A
 * busca do topo nao sabe nada sobre listagem, coluna ou registro: ela chama a
 * funcao que a tela deixou. Sem isso, a caixa do topo viraria o lugar onde toda
 * regra de filtro de toda tela acabaria morando.
 *
 * ⚠️ Loja de modulo, e nao contexto de React.
 *
 * A caixa mora na `Topbar` e as telas entram por `children` do layout: um
 * contexto teria de nascer acima dos dois, e o layout e componente de servidor.
 * Como so existe UMA tela por vez, um registro unico de modulo diz a verdade e
 * dispensa provider. `useSyncExternalStore` cuida de avisar quem le.
 */
export type BuscaDaTela = {
  /** Como a tela se chama na frase "Pesquisar em ...". */
  rotulo: string;
  /** O que esta escrito agora — a tela e a fonte da verdade. */
  termo: string;
  buscar: (termo: string) => void;
  /** Quantas linhas sobraram, quando a tela sabe dizer. */
  resultados?: number;
};

let atual: BuscaDaTela | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => void ouvintes.delete(ouvinte);
}

const ler = () => atual;
/* No servidor nao ha tela montada: a caixa nasce sendo so navegacao. */
const lerNoServidor = () => null;

/**
 * A tela se anuncia. Uma linha, no lugar do antigo `<SearchInput />`.
 *
 * ⚠️ O registro nasce e morre no efeito, e nunca no corpo do componente:
 * escrever numa loja durante a renderizacao e efeito colateral, e o React pode
 * renderizar duas vezes antes de pintar.
 *
 * ⚠️ A limpeza so apaga se o registro ainda for o SEU. Na troca de tela, a nova
 * monta antes de a antiga desmontar; sem essa guarda, a antiga apagaria o
 * registro da nova ao sair e a caixa ficaria sem dono.
 */
export function useRegistrarBusca(
  rotulo: string,
  termo: string,
  buscar: (termo: string) => void,
  resultados?: number,
): void {
  useEffect(() => {
    const meu: BuscaDaTela = { rotulo, termo, buscar, resultados };
    atual = meu;
    avisar();

    return () => {
      if (atual !== meu) return;
      atual = null;
      avisar();
    };
  }, [rotulo, termo, buscar, resultados]);
}

/** O que a tela aberta anunciou, ou nulo quando ela nao busca nada. */
export function useBuscaDaTela(): BuscaDaTela | null {
  return useSyncExternalStore(assinar, ler, lerNoServidor);
}
