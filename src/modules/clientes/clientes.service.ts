import { ConflictError, NotFoundError } from "@/shared/errors/app-error";
import type { Paginacao, Pagina } from "@/shared/utils/paginacao";
import * as repo from "@/modules/clientes/clientes.repository";
import type {
  Cliente,
  ClienteNovo,
  ContagemPorPapel,
  ContatoDaPessoa,
  DadoBancarioDaPessoa,
  EnderecoDaPessoa,
  UsuarioDaPessoa,
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

export async function atualizarContato(
  empresaId: number,
  clienteId: number,
  contatoId: number,
  entrada: { valor: string; rotulo: string | null },
): Promise<ContatoDaPessoa> {
  await obterCliente(empresaId, clienteId);
  return repo.atualizarContato(clienteId, contatoId, entrada);
}

/*
 * ⚠️ Toda funcao de aba confere a PESSOA antes de tocar na filha.
 *
 * A RLS das tabelas filhas ja barra o que e de outra empresa, mas devolvendo
 * lista vazia — indistinguivel de "esta pessoa nao tem endereco". O 404 diz a
 * verdade, e num POST evita gravar linha orfa apontando para um id que o usuario
 * nao pode ver.
 */

export async function enderecosDaPessoa(
  empresaId: number,
  clienteId: number,
): Promise<EnderecoDaPessoa[]> {
  await obterCliente(empresaId, clienteId);
  return repo.enderecosDaPessoa(clienteId);
}

export async function criarEndereco(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  entrada: Omit<EnderecoDaPessoa, "id">,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.criarEndereco(clienteId, usuarioId, entrada);
}

export async function definirEnderecoPrincipal(
  empresaId: number,
  clienteId: number,
  enderecoId: number,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.definirEnderecoPrincipal(clienteId, enderecoId);
}

export async function atualizarEndereco(
  empresaId: number,
  clienteId: number,
  enderecoId: number,
  entrada: Omit<EnderecoDaPessoa, "id" | "principal">,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.atualizarEndereco(clienteId, enderecoId, entrada);
}

export async function excluirEndereco(
  empresaId: number,
  clienteId: number,
  enderecoId: number,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.excluirEndereco(clienteId, enderecoId);
}

export async function bancariosDaPessoa(
  empresaId: number,
  clienteId: number,
): Promise<DadoBancarioDaPessoa[]> {
  await obterCliente(empresaId, clienteId);
  return repo.bancariosDaPessoa(clienteId);
}

export async function criarBancario(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  entrada: Omit<DadoBancarioDaPessoa, "id">,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.criarBancario(clienteId, usuarioId, entrada);
}

export async function atualizarBancario(
  empresaId: number,
  clienteId: number,
  bancarioId: number,
  entrada: Omit<DadoBancarioDaPessoa, "id" | "principal">,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.atualizarBancario(clienteId, bancarioId, entrada);
}

export async function excluirBancario(
  empresaId: number,
  clienteId: number,
  bancarioId: number,
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.desativarBancario(clienteId, bancarioId);
}

export async function acessoDaPessoa(
  empresaId: number,
  clienteId: number,
): Promise<{ comAcesso: UsuarioDaPessoa[]; disponiveis: UsuarioDaPessoa[] }> {
  await obterCliente(empresaId, clienteId);

  const [comAcesso, disponiveis] = await Promise.all([
    repo.usuariosDaPessoa(clienteId),
    repo.usuariosDisponiveis(),
  ]);

  return { comAcesso, disponiveis };
}

export async function definirUsuariosDaPessoa(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  usuarios: string[],
): Promise<void> {
  await obterCliente(empresaId, clienteId);
  await repo.definirUsuariosDaPessoa(clienteId, usuarioId, usuarios);
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
