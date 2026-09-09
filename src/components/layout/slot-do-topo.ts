"use client";

import { useSyncExternalStore } from "react";

/**
 * O lugar, dentro do cabecalho da tela, onde a busca e a identidade se
 * encaixam.
 *
 * ⚠️ Existe para MATAR uma faixa.
 *
 * Havia duas: a do topo (busca, sino, avatar) e a do cabecalho da pagina
 * (caminho, titulo, filtros), uma debaixo da outra. Somando alturas e respiros,
 * eram mais de cem pixels de casca antes da primeira linha da tabela — e as
 * duas metades da mesma faixa estavam vazias, uma a direita e a outra a
 * esquerda. Agora e uma linha so: `Financeiro › Caixas e bancos / Movimentacoes`
 * de um lado, busca e identidade do outro.
 *
 * ⚠️ Por PORTAL, e nao movendo o componente.
 *
 * A identidade precisa de dado de SESSAO, que so o layout (servidor) tem; o
 * cabecalho e da tela e nasce muito mais fundo na arvore. Passar a sessao de mao
 * em mao ate la obrigaria toda tela do sistema a repassar uma prop que nao lhe
 * diz respeito. O cabecalho so anuncia "o encaixe fica aqui", e quem desenha
 * continua sendo o topo.
 *
 * ⚠️ Loja de modulo, e nao contexto de React — mesma razao do `busca-da-tela`
 * ao lado: o provider teria de nascer acima do layout, que e de servidor. Como
 * so ha UMA tela por vez, um registro unico diz a verdade.
 */

let alvo: HTMLElement | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => void ouvintes.delete(ouvinte);
}

const ler = () => alvo;
/* No servidor nao ha DOM: o topo se desenha no lugar de reserva dele. */
const lerNoServidor = () => null;

/**
 * O cabecalho anuncia o encaixe.
 *
 * ⚠️ E um `ref` de callback, e nao um efeito. O React o chama na montagem com o
 * elemento e na desmontagem com `null`, que e exatamente o ciclo que interessa —
 * e sempre depois de pintar, nunca durante a renderizacao.
 *
 * ⚠️ A saida so apaga se o registro ainda for o DELE. Na troca de tela a nova
 * monta antes de a antiga desmontar; sem a guarda, a que sai levaria embora o
 * encaixe da que entrou e o topo voltaria para o canto.
 */
export function registrarSlotDoTopo(elemento: HTMLElement | null): void {
  if (elemento) {
    alvo = elemento;
    avisar();
    return;
  }

  /* Chamado com `null` na desmontagem: nada a fazer se outro ja assumiu. */
  alvo = null;
  avisar();
}

/** Onde o topo deve se desenhar, ou nulo quando a tela nao tem cabecalho. */
export function useSlotDoTopo(): HTMLElement | null {
  return useSyncExternalStore(assinar, ler, lerNoServidor);
}
