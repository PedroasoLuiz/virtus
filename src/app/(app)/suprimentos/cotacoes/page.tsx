import { EmConstrucao } from "../../em-construcao";

/**
 * As tabelas `cotacoes`, `cotacoesitens` e `cotacoesfornecedores` ja existem,
 * vazias e sem policy. A de fornecedores e a que diz que o modelo previa
 * comparar preco entre eles, e nao guardar uma cotacao por vez.
 */
export default function CotacoesPage() {
  return (
    <EmConstrucao
      titulo="Cotações"
      descricao="O mesmo item perguntado a vários fornecedores, para comparar antes de comprar."
      pendencias={[
        "Policies de RLS em cotacoes, cotacoesitens e cotacoesfornecedores",
        "Convidar fornecedores e registrar o preço de cada um por item",
        "Comparativo lado a lado, que é o motivo da tela existir",
        "Escolher o vencedor e virar pedido de compra",
      ]}
    />
  );
}
