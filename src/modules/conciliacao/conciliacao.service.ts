import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import { ajusteDeData, casar } from "@/shared/domain/conciliacao";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
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
 * ⚠️ Uma linha pode receber VARIOS lancamentos, e e o caso que justifica tudo
 * isto: o banco compensa dois boletos de clientes diferentes num deposito so.
 * Como um pagamento e de um pagador so, no sistema sao dois recebimentos — e sem
 * o vinculo multiplo um deles ficava pendente para sempre.
 *
 * ⚠️ O contrario NAO vale: o lancamento pertence a uma linha so. Amarrando o
 * mesmo recebimento a dois creditos do extrato, o dinheiro passaria a ser contado
 * duas vezes e o saldo fecharia mentindo. O banco ja recusa pela UNIQUE; a
 * checagem aqui existe para dizer QUAL linha o tem, que e o que permite desfazer.
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

  await recusarLancamentoJaUsado(empresaId, linhaId, [pagamentoId]);
  await recusarLinhaFechada(empresaId, linhaId);
  await alinharDatas(empresaId, usuarioId, [{ linhaId, pagamentoId }], confirmaMudancaDeMes);
  await repo.vincular(empresaId, linhaId, pagamentoId, usuarioId);
}

/**
 * Recusa somar mais um lancamento a uma linha que ja fechou.
 *
 * ⚠️ Fechou = o que ja esta casado soma EXATAMENTE o valor da linha. Dali em
 * diante todo lancamento a mais e dinheiro inventado: o banco moveu 2.220 e o
 * sistema passaria a afirmar que aquele mesmo movimento pagou 2.440. O saldo
 * continuaria fechando pelo extrato e mentindo por dentro, que e o erro mais
 * dificil de achar depois.
 *
 * ⚠️ So o EXATO fecha. Faltando ou sobrando um centavo a linha continua aberta,
 * porque e justamente a diferenca que aponta o que ainda falta achar — e um
 * "quase" travado seria uma linha que ninguem mais consegue completar.
 *
 * ⚠️ Vale so para a linha que JA TEM vinculo. A primeira conciliacao de uma
 * linha nunca e barrada: um lancamento de valor diferente pode ser o certo, com
 * juros, tarifa ou desconto explicando a diferenca.
 */
async function recusarLinhaFechada(empresaId: number, linhaId: number): Promise<void> {
  const saldo = await repo.saldoDaLinha(empresaId, linhaId);
  if (!saldo || saldo.casado === 0) return;
  if (saldo.casado !== saldo.valor) return;

  throw new BusinessRuleError(
    `Esta linha já está fechada: os lançamentos casados somam ` +
      `${formatarSemSimbolo(Math.abs(saldo.valor) as Centavos)}, que é o valor do movimento. ` +
      `Para trocar um deles, desfaça o vínculo primeiro.`,
  );
}

/**
 * Recusa o lancamento que ja e de OUTRA linha do extrato.
 *
 * ⚠️ Antes de qualquer escrita, e para o lote inteiro de uma vez. Deixando o
 * banco barrar pela UNIQUE, o erro chega como falha de servidor no meio da
 * gravacao — parte do lote dentro, parte fora, e a mensagem sem dizer onde o
 * lancamento ja esta. Quem concilia precisa do numero da linha para poder ir la
 * desfazer aquela.
 */
async function recusarLancamentoJaUsado(
  empresaId: number,
  linhaId: number | null,
  pagamentoIds: number[],
): Promise<void> {
  const ocupados = await repo.linhasDosLancamentos(empresaId, pagamentoIds);

  for (const pagamentoId of pagamentoIds) {
    const dono = ocupados.get(pagamentoId);
    if (dono == null || dono === linhaId) continue;

    throw new BusinessRuleError(
      "Este lançamento já está conciliado com outra linha do extrato. " +
        "Desfaça o vínculo lá antes de casá-lo aqui.",
    );
  }
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

/**
 * Desfaz o vinculo — um so, ou a linha inteira.
 *
 * ⚠️ `pagamentoId` sendo opcional e o que separa os dois gestos. Numa linha que
 * casou com tres lancamentos, "desfazer este" tira um e deixa os outros dois de
 * pe; sem o campo, corrigir um dos tres obrigava a refazer os tres.
 */
export async function desfazer(
  empresaId: number,
  linhaId: number,
  pagamentoId?: number,
): Promise<void> {
  await repo.desvincular(empresaId, linhaId, pagamentoId);
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

  /*
   * ⚠️ O lote nao pode trazer o MESMO lancamento em dois pares.
   *
   * A tela sugere por valor e data, e duas linhas iguais no extrato recebem a
   * mesma sugestao. Marcando as duas, o lote pediria para amarrar um recebimento
   * a dois creditos — o banco recusaria a segunda pela UNIQUE, e o resultado
   * seria metade gravada com uma falha de servidor no lugar da explicacao.
   */
  const repetido = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repetido != null) {
    throw new BusinessRuleError(
      "O mesmo lançamento foi marcado em duas linhas do extrato. " +
        "Um lançamento pertence a uma linha só.",
    );
  }

  for (const par of pares) {
    await recusarLancamentoJaUsado(empresaId, par.linhaId, [par.pagamentoId]);
    await recusarLinhaFechada(empresaId, par.linhaId);
  }

  await alinharDatas(empresaId, usuarioId, pares, confirmaMudancaDeMes);

  // Duas escritas em lote, e nao duas por par. Ver `apontarLinhas`.
  await repo.marcarPagamentosConciliados(empresaId, ids);
  await repo.apontarLinhas(empresaId, pares, usuarioId);

  return pares.length;
}
