import { EmConstrucao } from "../em-construcao";

export default function Page() {
  return (
    <EmConstrucao
      titulo="DRE"
      descricao="Demonstrativo de resultado por competência."
      pendencias={[
        "Consumir a RPC `dre_por_ano`, que já existe no banco",
        "Gráfico de receita × despesa (recharts, paleta em docs/07)",
      ]}
    />
  );
}
