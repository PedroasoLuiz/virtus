"use client";

import { useSyncExternalStore } from "react";

/**
 * O pouco que a barra lateral e o painel precisam saber um do outro.
 *
 * ⚠️ Existe porque os dois moram em ramos DIFERENTES da arvore: o botao passou a
 * viver dentro da `Sidebar`, e o painel continua na raiz da casca. Subir o
 * estado ate o layout obrigaria a tornar o layout inteiro um componente de
 * cliente, e um contexto por cima de tudo redesenharia a casca a cada mensagem
 * nova que chega.
 *
 * ⚠️ Sao DUAS coisas e nada mais: se esta aberto, e quantas nao lidas. Todo o
 * resto (conversas, mensagens, filtros) continua dentro do painel, onde nasce e
 * morre.
 */

type Estado = { aberto: boolean; naoLidas: number };

let estado: Estado = { aberto: false, naoLidas: 0 };

const ouvintes = new Set<() => void>();

/*
 * ⚠️ Objeto NOVO so quando algo muda de valor.
 *
 * `useSyncExternalStore` compara por identidade: devolver uma copia a cada
 * chamada faria o React entender "mudou" em todo render e entrar em laco.
 */
export function definirEstadoDoPainel(mudanca: Partial<Estado>) {
  const proximo = { ...estado, ...mudanca };

  if (proximo.aberto === estado.aberto && proximo.naoLidas === estado.naoLidas) return;

  estado = proximo;
  ouvintes.forEach((avisar) => avisar());
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
}

function ler() {
  return estado;
}

export function useEstadoDoPainel(): Estado {
  // O terceiro argumento e o valor do SERVIDOR. E o mesmo objeto inicial, entao
  // a primeira pintura casa com o HTML e nao ha divergencia de hidratacao.
  return useSyncExternalStore(assinar, ler, ler);
}
