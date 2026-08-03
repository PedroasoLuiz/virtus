"use client";

import { useFavoritos } from "@/components/layout/favoritos";

/**
 * Injeta no store os favoritos lidos do cookie no servidor.
 *
 * A escrita acontece durante o render, e nao num efeito, de proposito: o store
 * precisa estar preenchido antes da barra lateral renderizar, senao os
 * favoritos aparecem um quadro depois e a lista pisca. O `if` evita o laco de
 * atualizacao que um `setState` solto no render causaria.
 */
export function HidrataFavoritos({ rotas }: { rotas: string[] }) {
  const atuais = useFavoritos.getState().rotas;

  if (atuais.length === 0 && rotas.length > 0) {
    useFavoritos.setState({ rotas });
  }

  return null;
}
