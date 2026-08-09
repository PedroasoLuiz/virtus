"use server";

import { contextoAtual } from "@/shared/auth/contexto";
import * as repo from "@/modules/preferencias/preferencias.repository";
import { ehVisao, type Visao } from "@/modules/preferencias/preferencias.types";

/**
 * Guarda como o usuario prefere ver as telas com quadro.
 *
 * Server Action e nao route handler, pelo mesmo motivo dos favoritos: e um
 * clique que muda estado do servidor, e passar por HTTP so para gravar uma
 * palavra seria cerimonia.
 *
 * ⚠️ SEM `revalidatePath`. A tela ja trocou de visao na hora, com estado local —
 * revalidar aqui derrubaria e remontaria a listagem inteira logo depois do
 * clique, e o usuario veria a tela piscar por causa de uma gravacao que nao
 * muda nenhum dado que ele esta olhando. A preferencia so precisa estar la na
 * PROXIMA carga.
 *
 * ⚠️ Nao depende de empresa. A preferencia e da pessoa: quem trabalha em kanban
 * continua em kanban ao trocar de empresa.
 */
export async function salvarVisao(visao: Visao): Promise<void> {
  // O valor vem do navegador: sem esta conferencia, um cliente adulterado
  // gravaria qualquer palavra e a proxima carga cairia no padrao sem explicar
  // por que. O CHECK do banco recusaria de qualquer forma; aqui a recusa e
  // silenciosa e barata.
  if (!ehVisao(visao)) return;

  const ctx = await contextoAtual({ exigirSessao: true });
  await repo.gravarVisao(ctx.usuarioId, visao);
}
