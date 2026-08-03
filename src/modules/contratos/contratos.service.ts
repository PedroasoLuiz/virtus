import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import { hoje } from "@/shared/utils/datas";
import * as repo from "@/modules/contratos/contratos.repository";
import {
  podeGerarCompetencia,
  type Contrato,
  type ContratoNovo,
  type ContratoResumo,
} from "@/modules/contratos/contratos.types";

/** Regra de negocio de contratos. */

export function listarContratos(empresaId: number, incluirInativos = false): Promise<ContratoResumo[]> {
  return repo.listar(empresaId, incluirInativos);
}

export async function obterContrato(empresaId: number, id: number): Promise<Contrato> {
  const contrato = await repo.buscarPorId(empresaId, id);
  if (!contrato) throw new NotFoundError("Contrato nao encontrado");
  return contrato;
}

export async function criarContrato(
  empresaId: number,
  usuarioId: string | null,
  entrada: ContratoNovo,
): Promise<Contrato> {
  const id = await repo.criar(empresaId, usuarioId, entrada);
  return obterContrato(empresaId, id);
}

export async function atualizarContrato(
  empresaId: number,
  usuarioId: string | null,
  id: number,
  entrada: Partial<ContratoNovo> & { ativo?: boolean },
): Promise<Contrato> {
  const atual = await obterContrato(empresaId, id);

  /*
   * Periodicidade congela depois da primeira competencia.
   *
   * `proxima_competencia` avanca pelo passo da periodicidade. Trocar de MENSAL
   * para TRIMESTRAL no meio faria o proximo salto pular meses que ja deveriam
   * ter sido cobrados — e o buraco so apareceria na conciliacao.
   */
  if (
    entrada.periodicidade !== undefined &&
    entrada.periodicidade !== atual.periodicidade &&
    atual.qtdCompetencias > 0
  ) {
    throw new BusinessRuleError(
      "Este contrato ja gerou competencia. A periodicidade nao pode mais ser trocada.",
    );
  }

  await repo.atualizar(empresaId, id, usuarioId, entrada);
  return obterContrato(empresaId, id);
}

/**
 * Gera a competencia pendente e devolve o contrato atualizado.
 *
 * A checagem daqui existe para dar mensagem legivel; quem garante e a RPC, que
 * roda as mesmas regras dentro da transacao. Confiar so nesta seria deixar a
 * porta aberta para quem chama a API direto.
 */
export async function gerarCompetencia(
  empresaId: number,
  usuarioId: string | null,
  id: number,
): Promise<{ contrato: Contrato; ticketId: number }> {
  const contrato = await obterContrato(empresaId, id);
  const { pode, motivo } = podeGerarCompetencia(contrato, hoje());

  if (!pode) throw new BusinessRuleError(motivo ?? "Nao ha competencia a gerar");

  const ticketId = await repo.gerarCompetencia(id, usuarioId);
  return { contrato: await obterContrato(empresaId, id), ticketId };
}
