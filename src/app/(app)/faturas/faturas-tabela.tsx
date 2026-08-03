"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  EmptyRow,
  FilterButton,
  IconeKanban,
  IconeTabela,
  FilterItem,
  IncluirButton,
  PageHeader,
  PageLayout,
  Pagination,
  Panel,
  SearchInput,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
  ViewButton,
  selectStyle,
  tdNum,
  type Tom,
} from "@/components/ui/kit";
import { NovaFaturaDrawer } from "./nova-fatura-drawer";
import { FaturaDrawer } from "./fatura-drawer";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import {
  STATUS_FATURA,
  type FaturaResumo,
  type SituacaoFatura,
} from "@/modules/faturas/faturas.types";

/**
 * Listagem de contas a receber.
 *
 * "Fatura" no banco, "conta a receber" na interface: ela deixou de ser o centro
 * do modelo e virou o documento de cobranca gerado a partir de tickets.
 * Ver docs/10.
 *
 * Filtro e busca acontecem em memoria sobre a pagina carregada. Quando o volume
 * exigir, sobem para a query — `listarQuerySchema` ja prevê os parametros.
 */

const PAGE_SIZE = 25;

export function FaturasTabela({
  faturas,
  clientes,
}: {
  faturas: FaturaResumo[];
  clientes: { id: number; nome: string }[];
}) {
  const [criando, setCriando] = useState(false);

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [modo, setModo] = useState("tabela");
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<number | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return faturas.filter((f) => {
      if (status && f.situacao !== status) return false;
      if (!termo) return true;
      return (
        String(f.numero).includes(termo) || (f.clienteNome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [faturas, busca, status]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Contas a receber">
          <ViewButton
            view={modo}
            setView={setModo}
            opcoes={[
              { valor: "tabela", rotulo: "Tabela", icone: <IconeTabela /> },
              { valor: "kanban", rotulo: "Kanban", icone: <IconeKanban /> },
            ]}
          />
          <FilterButton
            activeCount={status ? 1 : 0}
            onClear={() => {
              setStatus("");
              setPagina(1);
            }}
          >
            <FilterItem label="Situação">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPagina(1);
                }}
                style={selectStyle}
              >
                <option value="">Todas</option>
                {STATUS_FATURA.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </FilterItem>
          </FilterButton>
          <SearchInput
            value={busca}
            onSearch={(v) => {
              setBusca(v);
              setPagina(1);
            }}
          />
          <IncluirButton onClick={() => setCriando(true)} />
        </PageHeader>

        {modo === "tabela" ? (
          <TableFrame>
            <TableArea minWidth={900}>
              <TableHead>
                <Th minWidth={70}>Nº</Th>
                <Th>Cliente</Th>
                <Th minWidth={150}>Apuração</Th>
                <Th minWidth={100}>Vencimento</Th>
                <Th align="center" minWidth={70}>
                  Parcelas
                </Th>
                <Th align="center" minWidth={100}>
                  Situação
                </Th>
                <Th align="right" minWidth={110}>
                  Valor
                </Th>
              </TableHead>
              <tbody>
                {visiveis.length === 0 && <EmptyRow colSpan={7} />}
                {visiveis.map((f, i) => (
                  <Tr
                    key={f.id}
                    delay={Math.min(i * 20, 150)}
                    dimmed={f.cancelada}
                    onClick={() => setDetalhe(f.id)}
                  >
                    <Td
                      style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-tertiary)" }}
                    >
                      {f.numero}
                    </Td>
                    <Td style={{ maxWidth: 260 }}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: "var(--fw-medium)",
                        }}
                      >
                        {f.clienteNome ?? "—"}
                      </span>
                    </Td>
                    <Td style={{ whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {periodo(f.apuracaoInicio, f.apuracaoFim)}
                    </Td>
                    <Td style={{ whiteSpace: "nowrap" }}>
                      <Vencimento data={f.proximoVencimento} pago={f.situacao === "PAGA"} />
                    </Td>
                    <Td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                      {f.qtdParcelas}
                    </Td>
                    <Td style={{ textAlign: "center" }}>
                      <Badge tom={TOM[f.situacao]}>{f.situacao}</Badge>
                    </Td>
                    <Td style={{ ...tdNum, fontWeight: "var(--fw-medium)" }}>
                      {formatarSemSimbolo(f.total)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableArea>
            <Pagination
              page={paginaAtual}
              totalPages={totalPaginas}
              total={filtradas.length}
              pageSize={PAGE_SIZE}
              onPage={setPagina}
            />
          </TableFrame>
        ) : (
          <Kanban faturas={filtradas} aoAbrir={setDetalhe} />
        )}
      </Panel>

      <FaturaDrawer faturaId={detalhe} onClose={() => setDetalhe(null)} />
      {criando && (
        <NovaFaturaDrawer clientes={clientes} onClose={() => setCriando(false)} />
      )}
    </PageLayout>
  );
}

/** Vencimento atrasado ganha cor — e a informacao que dispara acao. */
function Vencimento({ data, pago }: { data: DataISO | null; pago: boolean }) {
  if (!data) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;

  const atrasado = !pago && data < hoje();
  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        color: atrasado ? "var(--danger-text)" : "var(--text-primary)",
        fontWeight: atrasado ? "var(--fw-medium)" : 400,
      }}
    >
      {paraFormatoBR(data)}
    </span>
  );
}

function periodo(de: DataISO | null, ate: DataISO | null): string {
  if (!de) return "—";
  return ate && ate !== de ? `${paraFormatoBR(de)} — ${paraFormatoBR(ate)}` : paraFormatoBR(de);
}

const TOM: Record<SituacaoFatura, Tom> = {
  "ORÇAMENTO": "neutral",
  ABERTA: "info",
  FATURADA: "info",
  "PARC. PAGA": "warning",
  PAGA: "success",
  CANCELADA: "danger",
};

/** Cor do ponto no cabecalho de cada coluna do kanban. */
const COR_COLUNA: Record<SituacaoFatura, string> = {
  "ORÇAMENTO": "var(--neutral)",
  ABERTA: "var(--info)",
  FATURADA: "var(--info)",
  "PARC. PAGA": "var(--warning)",
  PAGA: "var(--success)",
  CANCELADA: "var(--danger)",
};

/**
 * Kanban — mesma estrutura do SIC: cabecalho da coluna FORA da area de cards,
 * area em `--surface-3` com raio, cards brancos que sobem no hover.
 */
function Kanban({ faturas, aoAbrir }: { faturas: FaturaResumo[]; aoAbrir: (id: number) => void }) {
  const colunas: SituacaoFatura[] = ["ORÇAMENTO", "ABERTA", "FATURADA", "PARC. PAGA", "PAGA"];

  return (
    <div style={{ flex: 1, overflowX: "auto", padding: 16, minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          gap: 14,
          height: "100%",
          alignItems: "flex-start",
          minWidth: "max-content",
        }}
      >
        {colunas.map((col) => {
          const daColuna = faturas.filter((f) => f.situacao === col);

          return (
            <div
              key={col}
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 262,
                width: 270,
                flexShrink: 0,
                height: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 10,
                  paddingLeft: 2,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: COR_COLUNA[col],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--text-md)",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {col}
                </span>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  {daColuna.length}
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  // Coluna sem fundo proprio: o cinza da pagina ja e o "trilho",
                  // e um segundo cinza por cima quase identico nao leria.
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {daColuna.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "16px 0",
                      fontSize: "var(--text-base)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Nenhuma fatura
                  </div>
                ) : (
                  daColuna.map((f) => <CardKanban key={f.id} fatura={f} aoAbrir={aoAbrir} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardKanban({
  fatura,
  aoAbrir,
}: {
  fatura: FaturaResumo;
  aoAbrir: (id: number) => void;
}) {
  const atrasado =
    fatura.proximoVencimento != null &&
    fatura.situacao !== "PAGA" &&
    fatura.proximoVencimento < hoje();

  return (
    <div
      onClick={() => aoAbrir(fatura.id)}
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-sm)",
        padding: "11px 13px",
        cursor: "pointer",
        userSelect: "none",
        transition: "box-shadow 120ms var(--ease), transform 100ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}
    >
      <div
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          color: "var(--text-tertiary)",
          marginBottom: 5,
        }}
      >
        {fatura.numero}
      </div>
      <div
        style={{
          fontSize: "var(--text-base)",
          fontWeight: 500,
          marginBottom: 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {fatura.clienteNome ?? "—"}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 7,
          borderTop: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: atrasado ? 600 : 400,
            color: atrasado ? "var(--danger-text)" : "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fatura.proximoVencimento ? paraFormatoBR(fatura.proximoVencimento) : "—"}
        </span>
        <span
          style={{ fontSize: "var(--text-sm)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
        >
          {formatarSemSimbolo(fatura.total)}
        </span>
      </div>
    </div>
  );
}
