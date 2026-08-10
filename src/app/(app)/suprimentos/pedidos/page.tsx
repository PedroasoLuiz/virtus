import { EmConstrucao } from "../../em-construcao";

/**
 * O pedido de compra e a ponte para o financeiro: ele e uma das ORIGENS da conta
 * a pagar, ao lado do lancamento avulso e do contrato recorrente.
 * `contaspagarorigens` ja tem a coluna `fkOrdem` esperando por ele.
 */
export default function PedidosDeCompraPage() {
  return (
    <EmConstrucao
      titulo="Pedidos de compra"
      descricao="O que foi efetivamente comprado, de quem, por quanto e em quantas vezes."
      pendencias={[
        "Policies de RLS em pedidoscompra, pedidoscompraitens e pedidoscompraaprovacoes",
        "Cadastro do pedido com itens, centro de custo e condição de pagamento",
        "Recebimento: o que chegou, quanto e quando",
        "Gerar a conta a pagar a partir do pedido (contaspagarorigens.fkOrdem já espera por isso)",
      ]}
    />
  );
}
