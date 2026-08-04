import { EmConstrucao } from "../em-construcao";

/**
 * Movimentação entre contas próprias.
 *
 * É diferente de recebimento e de pagamento: nada entra nem sai da empresa, o
 * dinheiro só troca de lugar. Por isso não pode virar um par
 * Receita/Despesa solto — os dois lados precisam nascer amarrados, senão o DRE
 * conta a mesma transferência como faturamento de um lado e custo do outro.
 */
export default function Page() {
  return (
    <EmConstrucao
      titulo="Movimentações"
      descricao="Transferências entre as contas da empresa."
      pendencias={[
        "Transferência entre duas contas próprias: sai de uma, entra na outra, na mesma data",
        "Os dois lançamentos precisam nascer ligados por um identificador comum, para que um estorno leve os dois e o par nunca fique pela metade",
        "Ficar FORA do DRE: transferência não é receita nem despesa, e contá-la infla faturamento e custo ao mesmo tempo",
        "Aparecer no extrato das duas contas, com o nome da conta do outro lado no histórico",
        "Aplicação e resgate são o mesmo gesto (conta corrente <-> investimento) e devem usar este mesmo caminho",
      ]}
    />
  );
}
