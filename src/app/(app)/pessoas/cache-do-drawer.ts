"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * O que as abas já buscaram, enquanto este drawer estiver aberto.
 *
 * ⚠️ Cada aba monta e desmonta ao trocar de guia. Sem isto, ir a Endereço,
 * voltar a Informações e retornar a Endereço são três idas ao servidor para ler
 * a mesma lista — e quem confere um cadastro faz esse vaivém o tempo todo.
 *
 * ⚠️ Morre com o drawer, de propósito. O `ref` vive no componente, e o drawer é
 * remontado por `key` a cada pessoa: fechar e reabrir traz dado fresco. Um cache
 * que sobrevivesse mostraria o endereço de ontem para quem acabou de mudá-lo em
 * outra aba do navegador.
 *
 * ⚠️ Métodos, e não o `ref` cru. As abas recebem isto como propriedade, e mexer
 * direto no `.current` de algo que veio de fora é escrever na memória de outro
 * componente — o próprio lint recusa, e com razão.
 */
export type CacheDoDrawer = {
  ler: <T>(chave: string) => T | undefined;
  gravar: <T>(chave: string, valor: T) => void;
  esquecer: (chave: string) => void;
};

export function useCacheDoDrawer(): CacheDoDrawer {
  const guardado = useRef<Record<string, unknown>>({});

  return useMemo(
    () => ({
      ler: <T,>(chave: string) => guardado.current[chave] as T | undefined,
      gravar: <T,>(chave: string, valor: T) => {
        guardado.current[chave] = valor;
      },
      esquecer: (chave: string) => {
        delete guardado.current[chave];
      },
    }),
    [],
  );
}

/**
 * O conteúdo de uma aba, lido uma vez por abertura do drawer.
 *
 * Devolve `null` enquanto não chegou, e o `data` da resposta cru — quem chama
 * sabe o formato dele melhor do que este arquivo. `recarregar` ignora o
 * guardado: é o que as abas chamam depois de gravar, porque aí o que está na
 * memória ficou velho no mesmo instante.
 */
export function useRecursoDaPessoa<T>(
  cache: CacheDoDrawer,
  chave: string,
  url: string,
): { dados: T | null; recarregar: () => Promise<void> } {
  /*
   * ⚠️ O valor guardado entra no estado INICIAL, e não por efeito.
   *
   * Por efeito, a aba pintaria "Carregando…" por um quadro antes de mostrar o
   * que já estava na memória — um piscar a cada troca de guia, que é exatamente
   * o incômodo que o cache existe para tirar.
   */
  const [dados, setDados] = useState<T | null>(() => cache.ler<T>(chave) ?? null);

  const recarregar = useCallback(async () => {
    const r = await fetch(url);
    if (!r.ok) return;

    const corpo = await r.json();
    const valor = (corpo.data ?? null) as T;

    cache.gravar(chave, valor);
    setDados(valor);
  }, [cache, chave, url]);

  /*
   * A busca sai de um `setTimeout(0)`, e não do corpo do efeito: é o mesmo
   * desvio do resto do sistema para não disparar uma cascata de render na
   * montagem. E ela só acontece se ainda não houver nada guardado.
   */
  useEffect(() => {
    const t = setTimeout(() => {
      if (cache.ler(chave) === undefined) void recarregar();
    }, 0);

    return () => clearTimeout(t);
  }, [cache, chave, recarregar]);

  return { dados, recarregar };
}
