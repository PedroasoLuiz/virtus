"use client";

import { create } from "zustand";

/**
 * Estado de interface: busca, filtro e pagina de cada listagem.
 *
 * Vive num store de cliente e nao no servidor — e preferencia de sessao, nao
 * dado de negocio. Some ao recarregar a pagina, de proposito.
 */

// ── Filtros por tela ────────────────────────────────────────────────────────

/**
 * Voltar a uma listagem devolve a tela como ela estava, em vez de zerar a
 * busca. Custa alguns bytes por tela; manter a tela inteira montada custaria
 * muito mais.
 */
type EstadoFiltros = {
  porTela: Record<string, Record<string, unknown>>;
  definir: (tela: string, valores: Record<string, unknown>) => void;
  limpar: (tela: string) => void;
};

export const useFiltros = create<EstadoFiltros>((set) => ({
  porTela: {},

  definir: (tela, valores) =>
    set((s) => ({
      porTela: { ...s.porTela, [tela]: { ...s.porTela[tela], ...valores } },
    })),

  limpar: (tela) =>
    set((s) => {
      const copia = { ...s.porTela };
      delete copia[tela];
      return { porTela: copia };
    }),
}));

/**
 * Lê e escreve o filtro de uma tela.
 *
 * Assinatura igual a de `useState` para a troca no componente ser mecanica.
 */
export function useFiltroDaTela<T extends Record<string, unknown>>(
  tela: string,
  inicial: T,
): [T, (parcial: Partial<T>) => void] {
  const salvo = useFiltros((s) => s.porTela[tela]);
  const definir = useFiltros((s) => s.definir);

  const valor = { ...inicial, ...(salvo ?? {}) } as T;
  return [valor, (parcial) => definir(tela, parcial)];
}
