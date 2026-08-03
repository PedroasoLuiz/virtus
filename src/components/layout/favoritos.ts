"use client";

import { create } from "zustand";
import { alternarFavorito } from "@/modules/favoritos/favoritos.actions";

/**
 * Telas fixadas no topo do menu.
 *
 * O estado local existe so para a estrela responder na hora — a verdade vive na
 * tabela `menufavoritos`. A Server Action grava e revalida o layout; se a
 * gravacao falhar, o estado local volta atras para nao mentir sobre o que esta
 * salvo.
 */

type EstadoFavoritos = {
  rotas: string[];
  alternar: (rota: string) => void;
};

export const useFavoritos = create<EstadoFavoritos>((set, get) => ({
  rotas: [],

  alternar: (rota) => {
    const antes = get().rotas;
    const favoritado = antes.includes(rota);

    set({ rotas: favoritado ? antes.filter((r) => r !== rota) : [...antes, rota] });

    alternarFavorito(rota, favoritado).catch(() => set({ rotas: antes }));
  },
}));
