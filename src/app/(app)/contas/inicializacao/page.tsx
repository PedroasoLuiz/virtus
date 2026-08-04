import { EmConstrucao } from "../../em-construcao";

/**
 * Inicialização de saldo.
 *
 * Hoje o saldo de partida existe como campo no cadastro da conta, e é somado
 * pela view `vwsaldo`. Funciona, mas não guarda A DATA em que aquele saldo valia
 * — e sem a data, um extrato que comece antes dela mostra um saldo de abertura
 * que nunca existiu.
 */
export default function Page() {
  return (
    <EmConstrucao
      titulo="Inicialização de saldo"
      descricao="O saldo de partida de cada conta, com a data em que ele valia."
      pendencias={[
        "Hoje o saldo inicial é um campo no cadastro da conta (Contas e saldo, editar) e já funciona",
        "Falta a DATA de corte: sem ela, um extrato que comece antes da entrada no sistema mostra um saldo de abertura que nunca existiu",
        "Falta o histórico de quem inicializou e quando, porque mexer nesse número move o saldo de todos os períodos de uma vez",
        "Conferência contra o extrato do banco na data de corte, antes de dar o saldo por bom",
      ]}
    />
  );
}
