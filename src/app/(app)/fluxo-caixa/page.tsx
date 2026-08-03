import { EmConstrucao } from "../em-construcao";

export default function Page() {
  return (
    <EmConstrucao
      titulo="Fluxo de caixa"
      descricao="Projeção de entradas e saídas por período."
      pendencias={[
        "Consolidar parcelas a receber (`faturasparcelas`) e a pagar (`contaspagarparcelas`)",
        "Partir do saldo atual das contas — a view `vwsaldo` já entrega isso",
        "Portar a regra do relatório `generate_projecao_caixa_p_d_f` do legado",
      ]}
    />
  );
}
