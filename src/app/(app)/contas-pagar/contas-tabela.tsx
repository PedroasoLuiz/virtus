"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  EmptyRow,
  FilterButton,
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
  selectStyle,
  tdNum,
  type Tom,
} from "@/components/ui/kit";
import {
  situacaoDaConta,
  type ContaPagarResumo,
  type SituacaoConta,
} from "@/modules/contas-pagar/contas-pagar.types";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { ContaDrawer } from "./conta-drawer";

const PAGE_SIZE = 25;

const SITUACOES: SituacaoConta[] = ["ABERTA", "PARCIAL", "VENCIDA", "PAGA", "CANCELADA"];

const TOM: Record<SituacaoConta, Tom> = {
  ABERTA: "info",
  PARCIAL: "warning",
  VENCIDA: "danger",
  PAGA: "success",
  CANCELADA: "neutral",
};

export function ContasTabela({ contas }: { contas: ContaPagarResumo[] }) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<number | null>(null);

  // A situacao e derivada, entao e calculada uma vez e reaproveitada no filtro
  // e na coluna — recalcular por linha renderizada seria trabalho repetido.
  const comSituacao = useMemo(
    () => contas.map((c) => ({ conta: c, situacao: situacaoDaConta(c) })),
    [contas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return comSituacao.filter(({ conta, situacao: s }) => {
      if (situacao && s !== situacao) return false;
      if (!termo) return true;
      return (
        conta.descricao.toLowerCase().includes(termo) ||
        (conta.fornecedorNome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [comSituacao, busca, situacao]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Contas a pagar">
          <FilterButton
            activeCount={situacao ? 1 : 0}
            onClear={() => {
              setSituacao("");
              setPagina(1);
            }}
          >
            <FilterItem label="Situação">
              <select
                value={situacao}
                onChange={(e) => {
                  setSituacao(e.target.value);
                  setPagina(1);
                }}
                style={selectStyle}
              >
                <option value="">Todas</option>
                {SITUACOES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
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
          <IncluirButton />
        </PageHeader>

        <TableFrame>
          <TableArea minWidth={880}>
            <TableHead>
              <Th minWidth={60}>Nº</Th>
              <Th>Descrição</Th>
              <Th minWidth={180}>Fornecedor</Th>
              <Th minWidth={100}>Vencimento</Th>
              <Th align="center" minWidth={80}>
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
              {visiveis.map(({ conta, situacao: s }, i) => (
                <Tr
                  key={conta.id}
                  delay={Math.min(i * 20, 150)}
                  dimmed={conta.cancelada}
                  onClick={() => setDetalhe(conta.id)}
                >
                  <Td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-tertiary)" }}>
                    {conta.id}
                  </Td>
                  <Td style={{ maxWidth: 280 }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: "var(--fw-medium)",
                      }}
                    >
                      {conta.descricao || "—"}
                    </span>
                  </Td>
                  <Td style={{ maxWidth: 200, color: "var(--text-secondary)" }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conta.fornecedorNome ?? "—"}
                    </span>
                  </Td>
                  <Td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {conta.proximoVencimento
                      ? paraFormatoBR(conta.proximoVencimento as DataISO)
                      : "—"}
                  </Td>
                  <Td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                    {conta.qtdParcelas > 0 ? `${conta.parcelasPagas}/${conta.qtdParcelas}` : "—"}
                  </Td>
                  <Td style={{ textAlign: "center" }}>
                    <Badge tom={TOM[s]}>{s}</Badge>
                  </Td>
                  <Td style={{ ...tdNum, fontWeight: "var(--fw-medium)", color: "var(--debito)" }}>
                    {formatarSemSimbolo(conta.total)}
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
      </Panel>

      <ContaDrawer contaId={detalhe} onClose={() => setDetalhe(null)} />
    </PageLayout>
  );
}
