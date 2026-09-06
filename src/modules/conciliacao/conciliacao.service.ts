import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import { ajusteDeData, casar } from "@/shared/domain/conciliacao";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
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
  usuarioId: string,
  contaId: number,
  linhaId: number,
  pagamentoId: number,
  confirmaMudancaDeMes: boolean,
): Promise<void> {
  if (!(await repo.lancamentoPertence(empresaId, contaId, pagamentoId))) {
    throw new NotFoundError("Lançamento não encontrado nesta conta");
  }

  await alinharDatas(empresaId, usuarioId, [{ linhaId, pagamentoId }], confirmaMudancaDeMes);
  await repo.vincular(empresaId, linhaId, pagamentoId);
}

/**
 * Puxa a data de cada lancamento para o dia do extrato.
 *
 * ⚠️ Decisao do Pedro em 05/09/2026: quem manda na data e o BANCO. A data
 * digitada na baixa e o dia do combinado; o extrato e o dia em que o dinheiro se
 * moveu, e depois de afirmar que os dois sao o mesmo dinheiro so um deles pode
 * estar certo sobre quando ele andou.
 *
 * ⚠️ Cruzando a virada do mes, RECUSA e pede confirmacao. Dentro do mes a
 * correcao nao mexe em fechamento nenhum; atravessando, ela reescreve o
 * resultado de dois meses que talvez ja tenham sido apresentados — e isso e
 * decisao de quem concilia, nao efeito de um clique.
 *
 * ⚠️ Confere TODOS os pares antes de gravar QUALQUER um. Conferindo par a par,
 * uma virada de mes no meio do lote deixaria a primeira metade gravada com data
 * nova e a segunda intacta, sem nada dizendo onde parou.
 */
async function alinharDatas(
  empresaId: number,
  usuarioId: string,
  pares: { linhaId: number; pagamentoId: number }[],
  confirmaMudancaDeMes: boolean,
): Promise<void> {
  const [doSistema, doBanco] = await Promise.all([
    repo.datasDosLancamentos(
      empresaId,
      pares.map((p) => p.pagamentoId),
    ),
    repo.datasDasLinhas(
      empresaId,
      pares.map((p) => p.linhaId),
    ),
  ]);

  const mexer: { pagamentoId: number; data: string; temCredito: boolean }[] = [];

  for (const par of pares) {
    const lancamento = doSistema.get(par.pagamentoId);
    const dataDoBanco = doBanco.get(par.linhaId);
    if (!lancamento || !dataDoBanco) continue;

    const ajuste = ajusteDeData(lancamento.dataCaixa as DataISO, dataDoBanco as DataISO);
    if (!ajuste.muda) continue;

    if (ajuste.mudaDeMes && !confirmaMudancaDeMes) {
      throw new BusinessRuleError(
        `A baixa está em ${paraFormatoBR(lancamento.dataCaixa as DataISO)} e o banco diz ` +
          `${paraFormatoBR(dataDoBanco as DataISO)}. Conciliar move o lançamento de mês e ` +
          `muda o fechamento dos dois.`,
        { mudaDeMes: true },
      );
    }

    mexer.push({
      pagamentoId: par.pagamentoId,
      data: dataDoBanco,
      temCredito: lancamento.dataCredito != null,
    });
  }

  for (const m of mexer) {
    await repo.alinharDataComExtrato(empresaId, m.pagamentoId, usuarioId, m.data, m.temCredito);
  }
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
  usuarioId: string,
  contaId: number,
  pares: { linhaId: number; pagamentoId: number }[],
  confirmaMudancaDeMes: boolean,
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

  await alinharDatas(empresaId, usuarioId, pares, confirmaMudancaDeMes);

  // O lado de `pagamentos` fecha numa UPDATE so; o do extrato precisa de um
  // valor por linha. Ver `marcarPagamentosConciliados`.
  await repo.marcarPagamentosConciliados(empresaId, ids);
  for (const par of pares) {
    await repo.apontarLinha(empresaId, par.linhaId, par.pagamentoId);
  }

  return pares.length;
}
