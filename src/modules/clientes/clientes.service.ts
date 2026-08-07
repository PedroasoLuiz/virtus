import { ConflictError, NotFoundError } from "@/shared/errors/app-error";
import type { Paginacao, Pagina } from "@/shared/utils/paginacao";
import * as repo from "@/modules/clientes/clientes.repository";
import type {
  Cliente,
  ClienteNovo,
  ContagemPorPapel,
  ContatoDaPessoa,
  FiltroClientes,
} from "@/modules/clientes/clientes.types";

/** Regra de negocio de clientes. */

export async function contagemPorPapel(
  empresaId: number,
  incluirInativos: boolean,
): Promise<ContagemPorPapel> {
  return repo.contagemPorPapel(empresaId, incluirInativos);
}

export async function listarClientes(
  empresaId: number,
  filtro: FiltroClientes,
  paginacao: Paginacao,
): Promise<Pagina<Cliente>> {
  return repo.listar(empresaId, filtro, paginacao);
}

/**
 * Os contatos de uma pessoa.
 *
 * ⚠️ Confere a PESSOA antes, e nao confia so na RLS da tabela filha. A policy de
 * `clientescontatos` ja barraria a leitura de outra empresa, mas devolvendo
 * lista vazia — indistinguivel de "esta pessoa nao tem contato". O 404 diz a
 * verdade.
 */
export async function contatosDaPessoa(
  empresaId: number,
  clienteId: number,
): Promise<ContatoDaPessoa[]> {
  await obterCliente(empresaId, clienteId);
  return repo.contatosDaPessoa(clienteId);
}

export async function criarContato(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  entrada: { tipo: "telefone" | "email"; valor: string; rotulo: string | null },
): Promise<ContatoDaPessoa> {
  await obterCliente(empresaId, clienteId);
  return repo.criarContato(clienteId, usuarioId, entrada);
}

export async function excluirContato(
  empresaId: number,
  clienteId: number,
  contatoId: number,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.desativarContato(clienteId, contatoId);
}

export async function obterCliente(empresaId: number, id: number): Promise<Cliente> {
  const cliente = await repo.buscarPorId(empresaId, id);
  if (!cliente) throw new NotFoundError("Cliente nao encontrado");
  return cliente;
}

export async function criarCliente(
  empresaId: number,
  usuarioId: string,
  entrada: ClienteNovo,
): Promise<Cliente> {
  if (entrada.cnpj) {
    // Duplicidade e escopada por empresa: o mesmo CNPJ pode ser cliente de
    // duas empresas diferentes da plataforma.
    const existente = await repo.buscarPorCnpj(empresaId, entrada.cnpj);
    if (existente) {
      throw new ConflictError(`Ja existe um cadastro com este CNPJ: ${existente.razao}`);
    }
  }

  const id = await repo.criar(empresaId, usuarioId, entrada);
  return obterCliente(empresaId, id);
}

export async function atualizarCliente(
  empresaId: number,
  usuarioId: string,
  id: number,
  entrada: Partial<ClienteNovo> & { ativo?: boolean },
): Promise<Cliente> {
  // Garante que o registro e desta empresa antes de escrever.
  await obterCliente(empresaId, id);

  if (entrada.cnpj) {
    const existente = await repo.buscarPorCnpj(empresaId, entrada.cnpj);
    if (existente && existente.id !== id) {
      throw new ConflictError(`Ja existe outro cadastro com este CNPJ: ${existente.razao}`);
    }
  }

  await repo.atualizar(empresaId, id, usuarioId, entrada);
  return obterCliente(empresaId, id);
}
