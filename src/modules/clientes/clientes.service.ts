import { BusinessRuleError, ConflictError, NotFoundError } from "@/shared/errors/app-error";
import { dominioAceitaEmail } from "@/shared/email/dominio-existe";
import { documentoValido } from "@/shared/domain/cadastro-pessoa";
import type { Paginacao, Pagina } from "@/shared/utils/paginacao";
import * as repo from "@/modules/clientes/clientes.repository";
import * as contatosRepo from "@/modules/clientes/contatos.repository";
import * as enderecosRepo from "@/modules/clientes/enderecos.repository";
import * as bancariosRepo from "@/modules/clientes/bancarios.repository";
import * as acessoRepo from "@/modules/clientes/acesso.repository";
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

/**
 * Confere que a pessoa e desta empresa, antes de mexer numa filha dela.
 *
 * ⚠️ A RLS das tabelas filhas ja barra o que e de outra empresa, mas devolvendo
 * lista vazia — indistinguivel de "esta pessoa nao tem endereco". O 404 diz a
 * verdade, e num POST evita gravar linha orfa apontando para um id que o usuario
 * nao pode ver.
 *
 * ⚠️ Nao usa `obterCliente`. Aquilo traz o cadastro inteiro pela view, com as
 * duas laterais do responsavel, so para responder "sim, e sua": um contato
 * marcado como principal pagava isso duas vezes por clique.
 */
async function conferirPosse(empresaId: number, clienteId: number): Promise<void> {
  if (!(await repo.pertenceAEmpresa(empresaId, clienteId))) {
    throw new NotFoundError("Cliente nao encontrado");
  }
}

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
  await conferirPosse(empresaId, clienteId);

  const [contatos, usuarios] = await Promise.all([
    contatosRepo.contatosDaPessoa(clienteId),
    acessoRepo.usuariosDaPessoa(clienteId),
  ]);

  /*
   * ⚠️ Casa e-mail de contato com usuario do PORTAL.
   *
   * Quem tem acesso ao portal entra pelo e-mail, e sem esta marca a aba mostrava
   * dois e-mails iguais sem dizer que um deles e a porta de entrada de alguem:
   * apagar o errado tirava o contato e deixava o acesso apontando para o vazio.
   */
  const porEmail = new Map(
    usuarios.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.nome ?? u.email!]),
  );

  return contatos.map((c) =>
    c.tipo === "email" ? { ...c, usuario: porEmail.get(c.valor.toLowerCase()) ?? null } : c,
  );
}

/**
 * ⚠️ So o e-mail passa por aqui, e so quando ele muda.
 *
 * A conferencia sai da maquina para perguntar ao DNS, e cobrar isso de todo
 * salvar poria meio segundo de rede no caminho de quem so corrigiu o setor.
 */
async function conferirDominio(tipo: "telefone" | "email", valor: string): Promise<void> {
  if (tipo !== "email") return;

  if (!(await dominioAceitaEmail(valor))) {
    throw new BusinessRuleError(
      `O domínio de ${valor} não recebe e-mail. Confira o que vem depois do @`,
    );
  }
}

export async function criarContato(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  entrada: {
    tipo: "telefone" | "email";
    valor: string;
    rotulo: string | null;
    responsavel: string | null;
  },
): Promise<ContatoDaPessoa> {
  await conferirPosse(empresaId, clienteId);
  await conferirDominio(entrada.tipo, entrada.valor);

  return contatosRepo.criarContato(clienteId, usuarioId, entrada);
}

export async function excluirContato(
  empresaId: number,
  clienteId: number,
  contatoId: number,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await contatosRepo.desativarContato(clienteId, contatoId);
}

export async function atualizarContato(
  empresaId: number,
  clienteId: number,
  contatoId: number,
  entrada: {
    tipo: "telefone" | "email";
    valor: string;
    rotulo: string | null;
    responsavel: string | null;
  },
): Promise<ContatoDaPessoa> {
  await conferirPosse(empresaId, clienteId);
  await conferirDominio(entrada.tipo, entrada.valor);

  return contatosRepo.atualizarContato(clienteId, contatoId, entrada);
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
  await conferirPosse(empresaId, clienteId);
  return enderecosRepo.enderecosDaPessoa(clienteId);
}

export async function criarEndereco(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  entrada: Omit<EnderecoDaPessoa, "id">,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await enderecosRepo.criarEndereco(clienteId, usuarioId, entrada);
}

export async function definirEnderecoPrincipal(
  empresaId: number,
  clienteId: number,
  enderecoId: number,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await enderecosRepo.definirEnderecoPrincipal(clienteId, enderecoId);
}

export async function atualizarEndereco(
  empresaId: number,
  clienteId: number,
  enderecoId: number,
  entrada: Omit<EnderecoDaPessoa, "id" | "principal">,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await enderecosRepo.atualizarEndereco(clienteId, enderecoId, entrada);
}

export async function excluirEndereco(
  empresaId: number,
  clienteId: number,
  enderecoId: number,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await enderecosRepo.excluirEndereco(clienteId, enderecoId);
}

export async function bancariosDaPessoa(
  empresaId: number,
  clienteId: number,
): Promise<DadoBancarioDaPessoa[]> {
  await conferirPosse(empresaId, clienteId);
  return bancariosRepo.bancariosDaPessoa(clienteId);
}

export async function criarBancario(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  entrada: Omit<DadoBancarioDaPessoa, "id">,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await bancariosRepo.criarBancario(clienteId, usuarioId, entrada);
}

export async function atualizarBancario(
  empresaId: number,
  clienteId: number,
  bancarioId: number,
  entrada: Omit<DadoBancarioDaPessoa, "id" | "principal">,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await bancariosRepo.atualizarBancario(clienteId, bancarioId, entrada);
}

export async function excluirBancario(
  empresaId: number,
  clienteId: number,
  bancarioId: number,
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await bancariosRepo.desativarBancario(clienteId, bancarioId);
}

/**
 * Quem ve esta pessoa pelo portal.
 *
 * ⚠️ NAO devolve mais a lista de "disponiveis". Ela varria todos os usuarios
 * visiveis a cada abertura da aba para alimentar um seletor que nao existe mais:
 * dar acesso e entregar dado financeiro de terceiro, e esse gesto mudou de lugar.
 */
export async function acessoDaPessoa(
  empresaId: number,
  clienteId: number,
): Promise<UsuarioDaPessoa[]> {
  await conferirPosse(empresaId, clienteId);
  return acessoRepo.usuariosDaPessoa(clienteId);
}

export async function definirUsuariosDaPessoa(
  empresaId: number,
  usuarioId: string,
  clienteId: number,
  usuarios: string[],
): Promise<void> {
  await conferirPosse(empresaId, clienteId);
  await acessoRepo.definirUsuariosDaPessoa(clienteId, usuarioId, usuarios);
}

/**
 * Quem ja tem este documento nesta empresa.
 *
 * ⚠️ Devolve `null` para documento incompleto em vez de procurar. Com tres digitos
 * a resposta seria sempre "nao existe", e a tela mostraria "documento livre"
 * antes de a pessoa terminar de digitar.
 */
export async function porDocumento(
  empresaId: number,
  documento: string,
): Promise<{ id: number; nome: string } | null> {
  if (!documentoValido(documento)) return null;

  const achado = await repo.buscarPorCnpj(empresaId, documento);
  if (!achado) return null;

  return { id: achado.id, nome: achado.nomeFantasia?.trim() || achado.razao };
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

  /*
   * ⚠️ O telefone e o e-mail do cadastro tambem viram CONTATO.
   *
   * As colunas de `clientes` guardam o principal, e a aba de contatos le a tabela
   * filha: gravando so a coluna, a pessoa cadastrava um telefone e abria a aba de
   * contatos vazia, sem entender para onde ele tinha ido.
   *
   * ⚠️ Falha aqui NAO derruba o cadastro. A pessoa ja existe, e devolver erro
   * depois de gravar faria a tela mandar tudo de novo e criar a segunda. O que se
   * perde no pior caso e a copia na tabela filha, que a aba de contatos permite
   * refazer.
   */
  await Promise.allSettled([
    entrada.contato
      ? contatosRepo.criarContato(id, usuarioId, {
          tipo: "telefone",
          valor: entrada.contato,
          rotulo: null,
          responsavel: null,
        })
      : null,
    entrada.email
      ? contatosRepo.criarContato(id, usuarioId, {
          tipo: "email",
          valor: entrada.email,
          rotulo: null,
          responsavel: null,
        })
      : null,
    // Primeiro da pessoa: o repositorio ja o marca como principal sozinho.
    entrada.endereco
      ? enderecosRepo.criarEndereco(id, usuarioId, { ...entrada.endereco, principal: true })
      : null,
  ]);

  return obterCliente(empresaId, id);
}

export async function atualizarCliente(
  empresaId: number,
  usuarioId: string,
  id: number,
  entrada: Partial<ClienteNovo> & { ativo?: boolean },
): Promise<Cliente> {
  // Garante que o registro e desta empresa antes de escrever. O cadastro
  // inteiro so e lido depois, uma vez, para voltar ja atualizado.
  await conferirPosse(empresaId, id);

  if (entrada.cnpj) {
    const existente = await repo.buscarPorCnpj(empresaId, entrada.cnpj);
    if (existente && existente.id !== id) {
      throw new ConflictError(`Ja existe outro cadastro com este CNPJ: ${existente.razao}`);
    }
  }

  await repo.atualizar(empresaId, id, usuarioId, entrada);

  /*
   * ⚠️ Nao ha nada a sincronizar aqui.
   *
   * O responsavel vem da view, do contato principal: trocar o principal ja muda
   * o que a listagem le, sem copia nenhuma para manter em dia.
   */
  return obterCliente(empresaId, id);
}
