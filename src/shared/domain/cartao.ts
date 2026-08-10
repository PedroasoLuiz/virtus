import { type DataISO } from "@/shared/utils/datas";

/**
 * O ciclo do cartão de crédito.
 *
 * Funções puras: não tocam banco, não conhecem HTTP, não dependem de relógio.
 * São lidas pela TELA e pelo SERVIDOR — a tela mostra em que fatura a compra vai
 * cair enquanto se digita, e o servidor grava nessa mesma. Duas implementações
 * divergiriam no primeiro dia de virada, que é justamente o caso que importa.
 *
 * ⚠️ A competência é sempre o PRIMEIRO DIA DO MÊS, e é assim que as quatro
 * faturas que já existem estão gravadas. Ela não é uma data em que algo
 * acontece: é o rótulo do ciclo, e guardá-la como o dia 1 deixa comparação e
 * agrupamento triviais.
 */

/** "2026-03-01" a partir de ano e mês. O mês entra 1-based. */
function primeiroDia(ano: number, mes: number): DataISO {
  return `${ano}-${String(mes).padStart(2, "0")}-01` as DataISO;
}

/** Quantos dias tem o mês. Fevereiro de ano bissexto incluído. */
function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Um dia dentro de um mês, sem estourar o fim dele.
 *
 * ⚠️ Cartão que fecha dia 31 fecha dia 28 em fevereiro, e não dia 3 de março.
 * `new Date(2026, 1, 31)` rola para março silenciosamente — o `Math.min` é o que
 * impede a fatura de fevereiro ganhar data de fechamento em outro mês.
 */
function diaDoMes(ano: number, mes: number, dia: number): DataISO {
  const seguro = Math.min(Math.max(dia, 1), diasNoMes(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(seguro).padStart(2, "0")}` as DataISO;
}

function partes(data: DataISO): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);
  return { ano, mes, dia };
}

/** O mês seguinte, virando o ano quando precisa. */
function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

/**
 * Em qual fatura uma compra cai.
 *
 * ⚠️ O CICLO manda, e não o mês da compra. Comprando no dia seguinte ao
 * fechamento, a despesa é do ciclo seguinte — é isso que a fatura do cartão faz,
 * e o sistema tem de dizer o mesmo, senão o total do VPay nunca bate com o papel
 * que chega do banco.
 *
 * ⚠️ Compra NO dia do fechamento entra na fatura que fecha naquele dia. É a
 * convenção do mercado: o fechamento é o fim do período, não o começo do
 * próximo. Um dia de diferença aqui joga a despesa para o mês errado.
 *
 * ⚠️ Data retroativa é PERMITIDA e cai na fatura do próprio ciclo dela. Lançar
 * hoje uma compra do mês passado é o caso comum — a nota chega depois —, e
 * empurrar tudo para a competência corrente faria o histórico mentir.
 */
export function competenciaDaCompra(diaFechamento: number, dataCompra: DataISO): DataISO {
  const { ano, mes, dia } = partes(dataCompra);

  if (dia <= diaFechamento) return primeiroDia(ano, mes);

  const seguinte = proximoMes(ano, mes);
  return primeiroDia(seguinte.ano, seguinte.mes);
}

/** O dia em que a fatura daquela competência fecha. */
export function fechamentoDaCompetencia(diaFechamento: number, competencia: DataISO): DataISO {
  const { ano, mes } = partes(competencia);
  return diaDoMes(ano, mes, diaFechamento);
}

/**
 * O dia em que a fatura daquela competência vence.
 *
 * ⚠️ Quando o vencimento é ANTES do fechamento no calendário, ele é do mês
 * SEGUINTE. Cartão que fecha dia 25 e vence dia 5 vence em 5 do mês que vem —
 * ler os dois números no mesmo mês daria uma fatura que vence vinte dias antes
 * de fechar, e o sistema cobraria antes de saber quanto.
 *
 * Nos quatro cartões cadastrados hoje o vencimento é depois do fechamento, então
 * este ramo não roda com o dado atual. Ele existe porque a virada é comum e o
 * erro seria silencioso.
 */
export function vencimentoDaCompetencia(
  diaFechamento: number,
  diaVencimento: number,
  competencia: DataISO,
): DataISO {
  const { ano, mes } = partes(competencia);

  if (diaVencimento >= diaFechamento) return diaDoMes(ano, mes, diaVencimento);

  const seguinte = proximoMes(ano, mes);
  return diaDoMes(seguinte.ano, seguinte.mes, diaVencimento);
}

/**
 * A fatura ainda aceita lançamento?
 *
 * ⚠️ Quem decide é o STATUS, e não a data. Fechar é gesto humano — o Pedro fecha
 * e clica para gerar a conta a pagar —, e uma fatura cuja data de fechamento já
 * passou mas que ninguém fechou continua recebendo o que faltou lançar. Fosse
 * pela data, a virada do dia trancaria a fatura no meio do trabalho de quem
 * estava digitando as notas do mês.
 */
export function faturaAceitaLancamento(status: string | null): boolean {
  return (status ?? "ABERTA").toUpperCase() !== "FECHADA";
}

/** "2026-03-01" vira "03/2026". Competência é mês, e não dia. */
export function competenciaBR(competencia: DataISO): string {
  const { ano, mes } = partes(competencia);
  return `${String(mes).padStart(2, "0")}/${ano}`;
}
