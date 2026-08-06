import * as repo from "@/modules/ia/ia.repository";
import * as cloud from "@/modules/ia/ia.cloud";
import type { ConfigIA, CredencialIA } from "@/modules/ia/ia.types";
import { testeInconclusivo, type ResultadoDoTeste } from "@/shared/domain/teste-conexao";

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
 * Testa a credencial antes de gravar.
 *
 * ⚠️ A chave nunca volta para a tela, nem aqui: o resultado e um veredito, e a
 * chamada de saida acontece dentro do servidor. Vazia com `id`, ela sai do
 * vault; o caso e editar uma credencial ja gravada, em que a tela nao tem a
 * chave para reenviar.
 */
export async function testarProvedor(
  empresaId: number,
  entrada: { id: number | null; provedor: string; modelo: string; chave: string | null },
): Promise<ResultadoDoTeste> {
  let chave = entrada.chave;

  if (!chave && entrada.id != null) {
    // A funcao ja confere o tenant; `empresaId` fica so no log de quem pediu.
    const guardada = await repo.chaveParaTeste(entrada.id);
    chave = guardada?.chave ?? null;
  }

  if (!chave) {
    return testeInconclusivo("Cole a chave para testar: não há nenhuma gravada para esta credencial.");
  }

  return cloud.testarCredencial({
    provedor: entrada.provedor as CredencialIA["provedor"],
    modelo: entrada.modelo,
    chave,
  });
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
