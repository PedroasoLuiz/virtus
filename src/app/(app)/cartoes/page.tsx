import { EmConstrucao } from "../em-construcao";

export default function Page() {
  return (
    <EmConstrucao
      titulo="Cartões"
      descricao="Faturas de cartão de crédito e parcelamento de compras."
      pendencias={[
        "Módulo `cartoes` (repository sobre `cartao`, `cartaofaturas`, `cartaofaturasparcelas`)",
        "Regra de fechamento por competência — já especificada em docs/04 §4",
        "Vínculo da fatura fechada com a conta a pagar gerada",
      ]}
    />
  );
}
