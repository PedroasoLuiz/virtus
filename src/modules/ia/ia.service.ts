import * as repo from "@/modules/ia/ia.repository";
import type { ConfigIA } from "@/modules/ia/ia.types";

/** Regra de negocio da configuracao de IA. */

export async function listarProvedores(empresaId: number): Promise<ConfigIA[]> {
  return repo.listarProvedores(empresaId);
}

export async function salvarProvedor(
  empresaId: number,
  entrada: {
    id: number | null;
    nome: string;
    provedor: string;
    modelo: string;
    ativo: boolean;
    chave: string | null;
  },
): Promise<ConfigIA[]> {
  await repo.salvarProvedor(empresaId, entrada);
  return repo.listarProvedores(empresaId);
}

/**
 * O numero de teste e da EMPRESA, nao do provedor.
 *
 * E trava de seguranca para ligar em producao, e ficaria absurda valendo para
 * uma chave e nao para outra: bastaria escrever para um numero de outro setor
 * para receber a resposta que a trava deveria impedir.
 */
export async function salvarNumeroTeste(
  empresaId: number,
  numeroTeste: string | null,
): Promise<ConfigIA[]> {
  await repo.salvarNumeroTeste(empresaId, numeroTeste);
  return repo.listarProvedores(empresaId);
}

export async function removerProvedor(
  empresaId: number,
  id: number,
): Promise<ConfigIA[]> {
  await repo.removerProvedor(empresaId, id);
  return repo.listarProvedores(empresaId);
}
