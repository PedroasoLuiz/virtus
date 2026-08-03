"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  EmptyRow,
  IncluirButton,
  PageHeader,
  PageLayout,
  Panel,
  SearchInput,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
  tdNum,
} from "@/components/ui/kit";
import { ContratoDrawer, type OpcaoCliente } from "./contrato-drawer";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { podeGerarCompetencia, type ContratoResumo } from "@/modules/contratos/contratos.types";

const ROTULO_PERIODO: Record<string, string> = {
  MENSAL: "Mensal",
  BIMESTRAL: "Bimestral",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

/**
 * Listagem de contratos.
 *
 * A coluna que decide a rotina do dia e a PRÓXIMA COMPETÊNCIA: é ela que diz o
 * que está esperando ser cobrado. Por isso o botão de gerar mora na linha, e
 * não escondido dentro do detalhe.
 */
export function ContratosTela({
  contratos,
  clientes,
}: {
  contratos: ContratoResumo[];
  clientes: OpcaoCliente[];
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [gerando, setGerando] = useState<number | null>(null);

  const hojeISO = hoje();

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contratos;
    return contratos.filter(
      (c) =>
        (c.numero ?? "").toLowerCase().includes(termo) ||
        (c.descricao ?? "").toLowerCase().includes(termo) ||
        (c.clienteNome ?? "").toLowerCase().includes(termo),
    );
  }, [contratos, busca]);

  async function gerar(contrato: ContratoResumo) {
    setGerando(contrato.id);

    const r = await fetch(`/api/v1/contratos/${contrato.id}/competencias`, { method: "POST" });
    const dados = await r.json().catch(() => null);
    setGerando(null);

    if (!r.ok) {
      avisar("atencao", "Não foi possível gerar", dados?.error?.message);
      return;
    }

    avisar(
      "sucesso",
      `Ticket ${dados.data.ticketId} gerado`,
      "Lance os serviços nele antes de faturar.",
    );
    router.refresh();
  }

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Contratos">
          <SearchInput value={busca} onSearch={setBusca} />
          <IncluirButton onClick={() => setCriando(true)} />
        </PageHeader>

        <TableFrame>
          <TableArea minWidth={900}>
            <TableHead>
              <Th>Contrato</Th>
              <Th minWidth={110}>Periodicidade</Th>
              <Th minWidth={130}>Vigência</Th>
              <Th minWidth={150}>Próxima competência</Th>
              <Th align="right" minWidth={100}>
                Valor
              </Th>
              <Th align="center" minWidth={130} />
            </TableHead>
            <tbody>
              {filtrados.length === 0 && <EmptyRow colSpan={6} />}
              {filtrados.map((c, i) => {
                const { pode, motivo } = podeGerarCompetencia(c, hojeISO);

                return (
                  <Tr key={c.id} delay={Math.min(i * 20, 150)} dimmed={!c.ativo}>
                    <Td style={{ maxWidth: 280 }} >
                      <div
                        onClick={() => setDetalhe(c.id)}
                        style={{
                          fontWeight: "var(--fw-medium)",
                          cursor: "pointer",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.numero ? `${c.numero} · ` : ""}
                        {c.descricao || "Sem descrição"}
                      </div>
                      {c.clienteNome && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                          {c.clienteNome}
                        </div>
                      )}
                    </Td>

                    <Td style={{ color: "var(--text-secondary)" }}>
                      {ROTULO_PERIODO[c.periodicidade] ?? c.periodicidade}
                    </Td>

                    <Td style={{ whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {c.inicio ? paraFormatoBR(c.inicio) : "—"}
                      {c.fim ? ` a ${paraFormatoBR(c.fim)}` : ""}
                    </Td>

                    <Td>
                      {c.proximaCompetencia ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {competenciaBR(c.proximaCompetencia)}
                          </span>
                          {pode && <Badge tom="warning">A GERAR</Badge>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>

                    <Td style={tdNum}>{formatarSemSimbolo(c.valor)}</Td>

                    <Td style={{ textAlign: "center" }}>
                      {/* Desabilitado com o motivo no `title`: some o botão e a
                          pessoa procura onde ele foi parar. */}
                      <Button
                        size="sm"
                        variant={pode ? "primary" : "secondary"}
                        disabled={!pode || gerando === c.id}
                        title={motivo}
                        onClick={() => void gerar(c)}
                      >
                        {gerando === c.id ? "Gerando…" : "Gerar competência"}
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableArea>
        </TableFrame>
      </Panel>

      <ContratoDrawer contratoId={detalhe} clientes={clientes} onClose={() => setDetalhe(null)} />
      {criando && (
        <ContratoDrawer
          contratoId={null}
          criando
          clientes={clientes}
          onClose={() => setCriando(false)}
        />
      )}
    </PageLayout>
  );
}

/** Competência é mês, não dia: "08/2026" e não "01/08/2026". */
export function competenciaBR(data: DataISO): string {
  const [ano, mes] = data.split("-");
  return `${mes}/${ano}`;
}
