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
  /**
   * O numero que a pessoa ve, contado por empresa.
   *
   * ⚠️ As DUAS pontas dividem o mesmo numero, do mesmo jeito que dividem o
   * `id`: elas sao um fato so. Numeros diferentes fariam parecer duas
   * movimentacoes que por acaso combinam.
   *
   * ⚠️ Nao e o id do lancamento. `pagamentos.id` e a sequencia global e nao
   * aparece em nenhuma outra tela do sistema.
   */
  numero: number | null;
  data: DataISO;
  valor: Centavos;
  origemId: number;
  origemNome: string;
  destinoId: number;
  destinoNome: string;
  observacoes: string | null;
  /** As DUAS pontas ja bateram com o extrato das suas contas. */
  conciliada: boolean;
  /**
   * Quantas das duas pontas ja foram conferidas contra o extrato: 0, 1 ou 2.
   *
   * ⚠️ Sao DUAS porque a transferencia aparece no extrato das duas contas, e
   * cada lado se concilia por conta propria — a saida quando o extrato da origem
   * e importado, a entrada quando e o do destino. Com uma so, metade do dinheiro
   * ainda nao foi conferida contra o banco.
   */
  conferidas: number;
  /** Quem lancou. Nulo em transferencia herdada do legado, que nao guardava. */
  criadoPor: string | null;
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

/**
 * O historico das duas pontas.
 *
 * ⚠️ Fixo, e nao montado com os nomes das contas.
 *
 * Eu tinha escrito "Transferência de 27370-8 | Cresol para 4923909-0 | Cora", o
 * que parecia mais informativo e nao era: `descricao` so aparece no extrato
 * quando `nome` esta vazio, a coluna e estreita, e a frase saia cortada em
 * "Transferência de 27370-8 | Cresol pa". As 55 transferencias que ja existem
 * usam este texto, e duas formas de dizer a mesma coisa fazem a mesma operacao
 * parecer duas no extrato.
 *
 * De onde para onde se le na tela de Movimentacoes, que tem coluna para cada um.
 */
export const DESCRICAO_TRANSFERENCIA = "Transferência entre contas de mesma titularidade";
