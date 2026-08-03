import { EmConstrucao } from "../em-construcao";

export default function Page() {
  return (
    <EmConstrucao
      titulo="Contas e saldo"
      descricao="Contas bancárias e saldo consolidado."
      pendencias={[
        "Módulo `tesouraria` lendo `contasbancarias` e a view `vwsaldo`",
        "Cálculo de saldo previsto a partir de parcelas em aberto",
      ]}
    />
  );
}
