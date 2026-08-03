"use server";

import { revalidatePath } from "next/cache";
import { contextoAtual, empresaObrigatoria } from "@/shared/auth/contexto";
import * as repo from "@/modules/favoritos/favoritos.repository";

/**
 * Alterna um favorito.
 *
 * Server Action e nao route handler: e um clique que muda estado do servidor e
 * precisa refletir no menu — `revalidatePath` no layout resolve sem o cliente
 * gerenciar cache.
 */
export async function alternarFavorito(rota: string, favoritado: boolean): Promise<void> {
  const ctx = await contextoAtual({ exigirSessao: true });
  const empresaId = empresaObrigatoria(ctx);

  if (favoritado) {
    await repo.desfavoritar(empresaId, rota);
  } else {
    await repo.favoritar(ctx.usuarioId, empresaId, rota);
  }

  revalidatePath("/", "layout");
}
