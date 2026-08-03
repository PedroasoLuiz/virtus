import { Badge, PageHeader, PageLayout, Panel, type Tom } from "@/components/ui/kit";
import { formatar, somar, type Centavos, ZERO } from "@/shared/utils/money";
import { STATUS_FATURA, type StatusFatura } from "@/modules/faturas/faturas.types";

type Linha = { status: StatusFatura; cancelada: boolean; total: Centavos };

/** Visao geral do faturamento por situacao. */
export function Painel({ linhas }: { linhas: Linha[] }) {
  // Cancelada nao entra em nenhum indicador: e valor que nao existe mais.
  const vivas = linhas.filter((l) => !l.cancelada);

  const aReceber = soma(vivas.filter((l) => l.status === "ABERTA" || l.status === "FATURADA"));
  const parcial = soma(vivas.filter((l) => l.status === "PARC. PAGA"));
  // Recebido junta PAGA e BAIXADA: as duas ja entraram. A diferenca entre elas
  // e se a conciliacao foi feita, e isso nao muda quanto entrou.
  const recebido = soma(vivas.filter((l) => l.status === "PAGA" || l.status === "BAIXADA"));
  const baixado = soma(vivas.filter((l) => l.status === "BAIXADA"));

  return (
    <PageLayout>
      <Panel>
        <PageHeader
        title="Visão geral"
        description={`${vivas.length} faturas ativas · ${linhas.length - vivas.length} canceladas`}
        />

        <div style={{ padding: 16, overflowY: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Stat label="A receber" valor={aReceber} detalhe="Aberta + Faturada" tom="credito" />
          <Stat label="Parcialmente paga" valor={parcial} detalhe="Com baixa parcial" />
          <Stat label="Recebido" valor={recebido} detalhe="Pagas e baixadas" />
          <Stat label="Conciliado" valor={baixado} detalhe="Conferidas no extrato" tom="credito" />
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
          }}
        >
          <div className="rotulo" style={{ marginBottom: 12 }}>
            Por situação
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STATUS_FATURA.map((s) => {
              const doStatus = vivas.filter((l) => l.status === s);
              return (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tom={TOM[s]}>{s}</Badge>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                      {doStatus.length} fatura{doStatus.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-md)",
                      fontWeight: "var(--fw-medium)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatar(soma(doStatus))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </Panel>
    </PageLayout>
  );
}

function Stat({
  label,
  valor,
  detalhe,
  tom = "neutro",
}: {
  label: string;
  valor: Centavos;
  detalhe: string;
  tom?: "neutro" | "credito";
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <div className="rotulo">{label}</div>
      <div
        style={{
          fontSize: "var(--text-3xl)",
          fontWeight: "var(--fw-semi)",
          letterSpacing: "var(--tracking-tight)",
          fontVariantNumeric: "tabular-nums",
          color: tom === "credito" ? "var(--credito)" : "var(--text-primary)",
          marginTop: 6,
        }}
      >
        {formatar(valor)}
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 2 }}>
        {detalhe}
      </div>
    </div>
  );
}

function soma(linhas: Linha[]): Centavos {
  return linhas.reduce<Centavos>((acc, l) => somar(acc, l.total), ZERO);
}

const TOM: Record<StatusFatura, Tom> = {
  ABERTA: "info",
  FATURADA: "info",
  "PARC. PAGA": "warning",
  PAGA: "success",
  BAIXADA: "success",
};
