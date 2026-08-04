import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import * as repo from "@/modules/contas/contas.repository";
import type { ContaBancaria, ContaNova, Extrato } from "@/modules/contas/contas.types";
import type { DataISO } from "@/shared/utils/datas";

/**
 * Regra de negocio das contas bancarias.
 */

export async function listarContas(empresaId: number): Promise<ContaBancaria[]> {
  return repo.listar(empresaId);
}

export async function obterConta(empresaId: number, id: number): Promise<ContaBancaria> {
  const conta = await repo.buscarPorId(empresaId, id);
  if (!conta) throw new NotFoundError("Conta nao encontrada");
  return conta;
}

export async function criarConta(
  empresaId: number,
  usuarioId: string,
  entrada: ContaNova,
): Promise<ContaBancaria> {
  garantirIdentificavel(entrada);
  const id = await repo.criar(empresaId, usuarioId, entrada);
  return obterConta(empresaId, id);
}

export async function atualizarConta(
  empresaId: number,
  usuarioId: string,
  id: number,
  entrada: ContaNova,
): Promise<ContaBancaria> {
  await obterConta(empresaId, id);
  garantirIdentificavel(entrada);
  await repo.atualizar(empresaId, usuarioId, id, entrada);
  return obterConta(empresaId, id);
}

/**
 * ⚠️ Recusa depois de qualquer movimento.
 *
 * Apagar a conta apagaria o "onde" de todo lancamento que passou por ela: o
 * dinheiro continuaria no extrato sem lugar de origem, e o saldo do periodo
 * nunca mais fecharia. Conta que nao se usa mais se DESATIVA, e e por isso que
 * `ativo` existe.
 */
export async function excluirConta(empresaId: number, id: number): Promise<void> {
  await obterConta(empresaId, id);
  const movimentos = await repo.movimentosDaConta(empresaId, id);

  if (movimentos > 0) {
    throw new BusinessRuleError(
      `Esta conta já tem ${movimentos} lançamento(s). Desative em vez de excluir.`,
    );
  }

  await repo.excluir(empresaId, id);
}

/**
 * Sem apelido, banco ou numero, a conta vira "Conta 7" na lista de escolher onde
 * o dinheiro caiu — e quem esta baixando nao tem como saber qual e.
 */
function garantirIdentificavel(entrada: ContaNova): void {
  if (!entrada.apelido?.trim() && !entrada.banco?.trim() && !entrada.conta?.trim()) {
    throw new BusinessRuleError("Informe ao menos o apelido, o banco ou o número da conta");
  }
}

/**
 * Teto do periodo consultavel, em dias.
 *
 * O extrato nao pagina: ele calcula saldo acumulado linha a linha, e isso so faz
 * sentido com a sequencia inteira em maos. Sem teto, uma conta movimentada puxa
 * anos de lancamento de uma vez e a tela trava — e um extrato que nao abre nao
 * confere nada.
 */
const MAXIMO_DE_DIAS = 186;

export async function extratoDaConta(
  empresaId: number,
  contaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<Extrato> {
  if (ate < de) throw new BusinessRuleError("Data final anterior à inicial");

  const dias = (Date.parse(ate) - Date.parse(de)) / (24 * 60 * 60 * 1000);
  if (dias > MAXIMO_DE_DIAS) {
    throw new BusinessRuleError("O extrato vai até seis meses por consulta. Reduza o período.");
  }

  const extrato = await repo.extrato(empresaId, contaId, de, ate);
  if (!extrato) throw new NotFoundError("Conta nao encontrada");
  return extrato;
}

/**
 * Conferido no extrato do banco, ou nao.
 *
 * Gesto humano e reversivel: e uma afirmacao sobre o que a pessoa viu, e ver
 * errado acontece. Por isso desmarcar tambem e permitido — o que o sistema NAO
 * permite e apagar um lancamento ja conciliado, porque ai a afirmacao some junto
 * com o fato que ela descrevia.
 */
export async function conciliar(
  empresaId: number,
  usuarioId: string,
  contaId: number,
  pagamentoId: number,
  conciliado: boolean,
): Promise<void> {
  await obterConta(empresaId, contaId);
  await repo.definirConciliacao(empresaId, pagamentoId, conciliado, usuarioId);
}
