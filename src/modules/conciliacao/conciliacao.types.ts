import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import type { Confianca } from "@/shared/domain/conciliacao";

/**
 * Conciliacao: casar a linha do banco com o lancamento do sistema.
 *
 * ⚠️ Sao DOIS mundos que so se encontram aqui. `extratobancario` e o que o banco
 * diz que aconteceu; `pagamentos` e o que a empresa registrou. Conciliar nao e
 * copiar um no outro — e afirmar que aquela linha e aquele lancamento sao o
 * mesmo dinheiro, e guardar essa afirmacao para o fechamento poder confiar nela.
 */

/** Uma linha do extrato do banco, ja gravada. */
export type LinhaDoExtrato = {
  id: number;
  data: DataISO;
  /** Centavos COM sinal: negativo saiu da conta. */
  valor: Centavos;
  /** O historico do banco. */
  nome: string;
  /** `DEBIT`, `CREDIT`... como o arquivo trouxe. */
  tipo: string;
  conciliado: boolean;
  /** O lancamento com que ela foi casada. */
  pagamentoId: number | null;
};

/** Um lancamento do sistema, do lado de ca da conciliacao. */
export type LancamentoConciliavel = {
  id: number;
  /**
   * ⚠️ E a `data_caixa`, e nao a `data`.
   *
   * O extrato do banco mostra o dia em que o dinheiro SE MOVEU na conta. Uma
   * venda no cartao no dia 20 aparece no banco em setembro; casando pela data do
   * pagamento, ela nunca acharia par.
   */
  data: DataISO;
  /** Centavos COM sinal, na mesma convencao da linha do banco. */
  valor: Centavos;
  nome: string;
  tipo: string | null;
  conciliado: boolean;
  /**
   * De que documento este dinheiro saiu ou entrou: "CR 214", "CP 88".
   *
   * ⚠️ E o numero da CONTA, e nao o do pagamento. Quem concilia tem o extrato de
   * um lado e o sistema do outro, e e pelo numero da conta a receber ou a pagar
   * que ele confere com o que combinou com o cliente ou com o fornecedor — o id
   * do pagamento e interno e nao aparece em lugar nenhum fora daqui.
   *
   * Nulo quando o lancamento nao veio de conta nenhuma: tarifa, rendimento e
   * transferencia entre contas existem sem documento.
   */
  documento: string | null;
};

/** O que a tela de conciliacao precisa saber de uma vez. */
export type PainelDeConciliacao = {
  linhas: LinhaDoExtrato[];
  lancamentos: LancamentoConciliavel[];
  /** Sugestoes de quem casa com quem, vindas de `shared/domain/conciliacao`. */
  sugestoes: { linhaId: number; lancamentoId: number; confianca: Confianca; motivo: string }[];
};

/** Uma linha lida do arquivo, antes de virar registro. */
export type LinhaImportada = {
  data: DataISO;
  valor: Centavos;
  nome: string;
  tipo: string;
};

export type ResultadoDaImportacao = {
  lidas: number;
  gravadas: number;
  /** Ja existiam: a chave bateu com uma linha gravada antes. */
  repetidas: number;
};
