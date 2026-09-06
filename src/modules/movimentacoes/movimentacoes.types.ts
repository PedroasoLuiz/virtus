import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * Transferencia entre contas da mesma empresa.
 *
 * ⚠️ UM fato com DUAS pontas, e nao dois lancamentos que por acaso combinam. As
 * duas linhas de `pagamentos` dividem o mesmo `transferencia`, e e ele que faz o
 * estorno levar as duas juntas — sem isso, desfazer pela ponta errada deixa a
 * outra viva e o saldo de uma das contas passa a mentir sem nada acusar.
 *
 * ⚠️ Ela NAO e receita nem despesa. O dinheiro trocou de bolso, e por isso as
 * duas pontas nascem com `tipo` "Transferência entre contas", que e o texto pelo
 * qual a DRE as ignora.
 */
export type Movimentacao = {
  /** O id que as duas pontas dividem. */
  id: string;
  data: DataISO;
  valor: Centavos;
  origemId: number;
  origemNome: string;
  destinoId: number;
  destinoNome: string;
  observacoes: string | null;
  /** As DUAS pontas ja bateram com o extrato das suas contas. */
  conciliada: boolean;
  /** Quantas das duas pontas ja foram conferidas: 0, 1 ou 2. */
  conferidas: number;
};

export type MovimentacaoNova = {
  data: DataISO;
  valor: Centavos;
  origemId: number;
  destinoId: number;
  observacoes: string | null;
};

/**
 * ⚠️ O texto e o mesmo que o legado ja gravava, e nao um novo.
 *
 * A DRE reconhece transferencia por `lower(tipo) like '%transferência entre
 * contas%'`, e as linhas de janeiro entraram assim. Um texto novo faria as
 * transferencias antigas e as novas serem coisas diferentes para o relatorio.
 */
export const TIPO_TRANSFERENCIA = "Transferência entre contas";
