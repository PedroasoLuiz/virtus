import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import { casar } from "@/shared/domain/conciliacao";
import type { DataISO } from "@/shared/utils/datas";
import * as repo from "@/modules/conciliacao/conciliacao.repository";
import type {
  LinhaImportada,
  PainelDeConciliacao,
  ResultadoDaImportacao,
} from "@/modules/conciliacao/conciliacao.types";

/**
 * Regra de negocio da conciliacao.
 *
 * A pergunta: o que o banco registrou e o que a empresa lancou sao o mesmo
 * dinheiro? Tudo aqui existe para que a resposta continue verdadeira depois — que
 * uma linha nao seja usada duas vezes, que ninguem case um lancamento de outra
 * conta, e que desfazer devolva as duas pontas ao estado anterior.
 */

export async function painel(
  empresaId: number,
  contaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<PainelDeConciliacao> {
  const [linhas, lancamentos] = await Promise.all([
    repo.linhasDoExtrato(empresaId, contaId, de, ate),
    repo.lancamentosDaConta(empresaId, contaId, de, ate),
  ]);

  /*
   * ⚠️ So o que ainda NAO foi conciliado entra no casamento.
   *
   * Incluindo o que ja tem par, uma linha conferida em janeiro poderia ser
   * sugerida de novo para um lancamento de fevereiro do mesmo valor — e aceitar
   * a sugestao desfaria em silencio uma conferencia que alguem ja assinou.
   */
  const { pares } = casar(
    linhas.filter((l) => !l.conciliado),
    lancamentos.filter((l) => !l.conciliado),
  );

  return { linhas, lancamentos, sugestoes: pares };
}

export async function importar(
  empresaId: number,
  contaId: number,
  linhas: LinhaImportada[],
): Promise<ResultadoDaImportacao> {
  if (linhas.length === 0) {
    throw new BusinessRuleError("O arquivo não trouxe nenhum lançamento");
  }

  // Ver `contaPertence`: e a unica escrita que monta a linha com um id vindo da
  // URL, e a RLS sozinha nao recusa conta de outra empresa.
  if (!(await repo.contaPertence(empresaId, contaId))) {
    throw new NotFoundError("Conta bancária não encontrada");
  }

  return repo.gravarLinhas(empresaId, contaId, linhas);
}

/**
 * Afirma que a linha e o lancamento sao o mesmo dinheiro.
 *
 * ⚠️ O lancamento e conferido contra o BANCO, e nao contra o que a tela mandou.
 * O corpo vem do navegador: sem esta consulta, um `pagamentoId` trocado a mao
 * conciliaria a linha contra o lancamento de outra conta — e o saldo das duas
 * passaria a mentir sem nada acusar.
 */
export async function conciliar(
  empresaId: number,
  contaId: number,
  linhaId: number,
  pagamentoId: number,
): Promise<void> {
  if (!(await repo.lancamentoPertence(empresaId, contaId, pagamentoId))) {
    throw new NotFoundError("Lançamento não encontrado nesta conta");
  }

  await repo.vincular(empresaId, linhaId, pagamentoId);
}

export async function desfazer(empresaId: number, linhaId: number): Promise<void> {
  await repo.desvincular(empresaId, linhaId);
}

/**
 * Aceita de uma vez os pares que a pessoa CONFERIU.
 *
 * ⚠️ Recebe os pares, e nao recalcula as sugestoes para aplicar todas.
 *
 * Havia aqui um "aceitar todas as exatas" que refazia o casamento e gravava o
 * resultado inteiro. Mesmo restrito ao mesmo dia, ele decidia sozinho: bastava
 * uma linha em que a sugestao estivesse errada para o erro entrar junto com as
 * certas, e sem nada na tela que dissesse qual delas foi. Agora a tela marca, a
 * pessoa desmarca o que nao serve, e chega aqui so o que ela afirmou.
 *
 * ⚠️ Cada par e conferido contra o banco, um a um, pela mesma regra do vinculo
 * avulso: a lista vem do navegador, e um `pagamentoId` trocado a mao conciliaria
 * contra o lancamento de outra conta.
 */
export async function conciliarVarios(
  empresaId: number,
  contaId: number,
  pares: { linhaId: number; pagamentoId: number }[],
): Promise<number> {
  const ids = pares.map((p) => p.pagamentoId);

  /*
   * ⚠️ A conferencia e UMA consulta, e acontece ANTES de qualquer escrita.
   *
   * Era uma consulta por par, seguida de duas escritas por par: cinquenta pares
   * viravam cento e cinquenta idas ao banco. Pior que o custo era a ordem —
   * conferindo e gravando de par em par, um id invalido no meio da lista
   * deixava a primeira metade gravada e a segunda nao, sem nada dizer onde
   * parou.
   */
  const validos = await repo.quaisPertencem(empresaId, contaId, ids);
  if (ids.some((id) => !validos.has(id))) {
    throw new NotFoundError("Lançamento não encontrado nesta conta");
  }

  // O lado de `pagamentos` fecha numa UPDATE so; o do extrato precisa de um
  // valor por linha. Ver `marcarPagamentosConciliados`.
  await repo.marcarPagamentosConciliados(empresaId, ids);
  for (const par of pares) {
    await repo.apontarLinha(empresaId, par.linhaId, par.pagamentoId);
  }

  return pares.length;
}
