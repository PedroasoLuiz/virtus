import { EmConstrucao } from "../em-construcao";

export default function Page() {
  return (
    <EmConstrucao
      titulo="Extrato bancário"
      descricao="Importação de CSV e conciliação com pagamentos."
      pendencias={[
        "Importador de CSV — regra em docs/04 §5, com a correção do hash de deduplicação",
        "Índice único em (fkContaBancaria, hash) antes de qualquer importação",
        "Tela de conciliação ligando extrato a `pagamentos`",
      ]}
    />
  );
}
