import { dreDoAno } from "@/modules/dre/dre.repository";
import type { Dre } from "@/modules/dre/dre.types";

/**
 * A DRE do ano.
 *
 * Fina de proposito: a conta e do banco (ver o repositorio), e nao ha regra de
 * dominio a aplicar entre uma coisa e outra. O servico existe para a tela e a
 * rota chamarem o mesmo caminho — a pagina renderiza no servidor e a troca de
 * ano vem pela API.
 */
export async function dre(empresaId: number, ano: number): Promise<Dre> {
  return dreDoAno(empresaId, ano);
}
