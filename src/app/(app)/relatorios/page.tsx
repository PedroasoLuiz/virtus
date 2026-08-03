import { EmConstrucao } from "../em-construcao";

export default function Page() {
  return (
    <EmConstrucao
      titulo="Relatórios"
      descricao="Relatórios operacionais e financeiros em PDF."
      pendencias={[
        "Decidir a estratégia de PDF — as três opções estão em docs/04 §8",
        "Portar os 11 relatórios do legado, começando pelo de fatura",
      ]}
    />
  );
}
