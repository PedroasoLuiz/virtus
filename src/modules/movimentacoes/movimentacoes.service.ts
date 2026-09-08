import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import { formatar } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import * as repo from "@/modules/movimentacoes/movimentacoes.repository";
import type {
  Movimentacao,
  MovimentacaoNova,
} from "@/modules/movimentacoes/movimentacoes.types";

/**
 * Transferencia entre contas da propria empresa.
 *
 * A regra toda: as duas pontas nascem juntas, morrem juntas, e nenhuma delas e
 * receita ou despesa. O dinheiro nao entrou nem saiu da empresa — trocou de
 * lugar.
 */

export async function listar(
  empresaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<Movimentacao[]> {
  return repo.listar(empresaId, de, ate);
}

/**
 * Cria a transferencia.
 *
 * ⚠️ As DUAS contas sao conferidas contra o banco, e nao contra o que a tela
 * mandou. O corpo vem do navegador: sem esta checagem, um id trocado a mao
 * criaria a ponta numa conta de outra empresa. A RLS barraria a escrita, mas o
 * erro chegaria como falha de servidor em vez de "conta nao encontrada".
 *
 * ⚠️ Origem e destino diferentes ja e recusado no schema, na borda. Repetir aqui
 * criaria dois lugares para manter a mesma regra.
 */
export async function criar(
  empresaId: number,
  usuarioId: string,
  nova: MovimentacaoNova,
  empresaNome: string,
): Promise<string> {
  const [temOrigem, temDestino] = await Promise.all([
    repo.contaPertence(empresaId, nova.origemId),
    repo.contaPertence(empresaId, nova.destinoId),
  ]);

  if (!temOrigem) throw new NotFoundError("Conta de origem não encontrada");
  if (!temDestino) throw new NotFoundError("Conta de destino não encontrada");

  /*
   * ⚠️ A ORIGEM precisa aguentar a saida: saldo MAIS limite.
   *
   * O limite entra porque ele e dinheiro que a conta pode usar — quem tem cheque
   * especial de 5.000 e saldo de 1.000 pode transferir 5.500 e ficar negativo,
   * que e o que o banco permite. Barrar so pelo saldo recusaria uma operacao
   * legitima; ignorar o limite deixaria criar um negativo que o banco vai
   * devolver.
   *
   * ⚠️ Conferido AQUI e nao na tela, porque o corpo vem do navegador. A tela
   * tambem avisa, mas ela avisa; quem recusa e o servidor.
   *
   * ⚠️ Nao ha trava equivalente no DESTINO: dinheiro entrando nao estoura nada.
   */
  const disponivel = await repo.disponivelDaConta(nova.origemId);

  if (nova.valor > disponivel) {
    throw new BusinessRuleError(
      `A conta de origem tem ${formatar(disponivel)} disponível, somando saldo e limite. ` +
        `A transferência é de ${formatar(nova.valor)}.`,
    );
  }

  return repo.criar(empresaId, usuarioId, nova, empresaNome);
}

/**
 * Desfaz a transferencia inteira.
 *
 * ⚠️ Recusa quando QUALQUER uma das pontas ja foi conciliada.
 *
 * Conciliada significa que alguem afirmou que aquela linha e o mesmo dinheiro
 * de uma linha do extrato do banco. Apagar por baixo dessa afirmacao deixaria a
 * linha do banco conferida contra um lancamento que nao existe mais — e o
 * proximo a olhar o extrato veria "conferido" sem ter com o que conferir.
 *
 * Para corrigir uma transferencia conciliada, desfaz-se a conciliacao primeiro:
 * ali a pessoa ve o que esta desfazendo.
 */
export async function excluir(empresaId: number, id: string): Promise<void> {
  const pontas = await repo.pontas(empresaId, id);

  if (pontas.length === 0) throw new NotFoundError("Movimentação não encontrada");

  if (pontas.some((p) => p.conciliado)) {
    throw new BusinessRuleError(
      "Esta movimentação já foi conciliada com o extrato. Desfaça a conciliação antes de excluí-la.",
    );
  }

  await repo.apagar(empresaId, id);
}
