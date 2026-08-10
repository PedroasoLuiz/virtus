import { EmConstrucao } from "../../em-construcao";

/**
 * ⚠️ Placeholder honesto, e nao um link morto.
 *
 * As tabelas (`requisicoes`, `requisicoesitens`, `requisicoesaprovacoes`) ja
 * existem no banco, vazias e sem policy de RLS — ou seja, fechadas, que e o
 * comportamento seguro. Cada uma ganha policy quando o modulo entrar.
 */
export default function RequisicoesPage() {
  return (
    <EmConstrucao
      titulo="Requisições"
      descricao="O pedido interno: quem precisa, do quê, para quando."
      pendencias={[
        "Policies de RLS em requisicoes, requisicoesitens e requisicoesaprovacoes",
        "Cadastro da requisição com itens e centro de custo",
        "Aprovação por alçada, que é o que a tabela de aprovações espera",
        "Virar cotação sem redigitar os itens",
      ]}
    />
  );
}
