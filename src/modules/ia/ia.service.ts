import * as repo from "@/modules/ia/ia.repository";
import type { ConfigIA } from "@/modules/ia/ia.types";

/** Regra de negocio da configuracao de IA. */

export async function obterConfig(empresaId: number): Promise<ConfigIA> {
  return repo.buscarConfig(empresaId);
}

export async function salvarConfig(
  empresaId: number,
  entrada: {
    modelo: string;
    ativo: boolean;
    chave: string | null;
    numeroTeste: string | null;
  },
): Promise<ConfigIA> {
  await repo.salvarConfig(empresaId, entrada);
  return repo.buscarConfig(empresaId);
}
