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
  SearchInput,
  Panel,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  selectStyle,
} from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";
import { ClienteDrawer } from "./cliente-drawer";

const PAGE_SIZE = 25;

export function ClientesTabela({
  clientes,
  centros,
}: {
  clientes: Cliente[];
  centros: { id: number; descricao: string }[];
}) {
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState("");
  const [pagina, setPagina] = useState(1);
  // null = fechado; { cliente: null } = novo cadastro.
  const [edicao, setEdicao] = useState<{ cliente: Cliente | null } | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (papel && !c.papeis.includes(papel as PapelPessoa)) return false;
      if (!termo) return true;
      return (
        c.razao.toLowerCase().includes(termo) ||
        (c.nomeFantasia ?? "").toLowerCase().includes(termo) ||
        (c.cnpj ?? "").includes(termo.replace(/\D/g, ""))
      );
    });
  }, [clientes, busca, papel]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Clientes">
        <FilterButton
          activeCount={papel ? 1 : 0}
          onClear={() => {
            setPapel("");
            setPagina(1);
          }}
        >
          <FilterItem label="Papel">
            <select
              value={papel}
              onChange={(e) => {
                setPapel(e.target.value);
                setPagina(1);
              }}
              style={selectStyle}
            >
              <option value="">Todos</option>
              <option value="cliente">Cliente</option>
              <option value="fornecedor">Fornecedor</option>
              <option value="colaborador">Colaborador</option>
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
          <IncluirButton onClick={() => setEdicao({ cliente: null })} />
        </PageHeader>

          <TableArea minWidth={860}>
            <TableHead>
              <Th>Razão social</Th>
              <Th minWidth={150}>CNPJ</Th>
              <Th minWidth={150}>Responsável</Th>
              <Th minWidth={130}>Contato</Th>
              <Th align="center" minWidth={160}>
                Papéis
              </Th>
            </TableHead>
            <tbody>
              {visiveis.length === 0 && <EmptyRow colSpan={5} />}
              {visiveis.map((c, i) => (
                <Tr
                  key={c.id}
                  delay={Math.min(i * 20, 150)}
                  dimmed={!c.ativo}
                  onClick={() => setEdicao({ cliente: c })}
                >
                  <Td style={{ maxWidth: 280 }}>
                    <div
                      style={{
                        fontWeight: "var(--fw-medium)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.nomeFantasia || c.razao}
                    </div>
                    {/* Razao social e centro de custo dividem UMA linha, com
                        separador. Empilhados, virariam uma terceira linha e a
                        altura da linha da tabela (--h-row) deixaria de fechar. */}
                    <Subtitulo
                      partes={[
                        c.nomeFantasia && c.nomeFantasia !== c.razao ? c.razao : null,
                        c.centroCustoNome,
                      ]}
                    />
                  </Td>
                  <Td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {c.cnpj ? formatarDoc(c.cnpj) : "—"}
                  </Td>
                  <Td style={{ color: "var(--text-secondary)" }}>{c.responsavel || "—"}</Td>
                  <Td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {c.contato || "—"}
                  </Td>
                  <Td style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {c.papeis.map((p) => (
                        <Badge key={p} tom={p === "cliente" ? "info" : "neutral"}>
                          {p}
                        </Badge>
                      ))}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>
          <Pagination
            page={paginaAtual}
            totalPages={totalPaginas}
            total={filtrados.length}
            pageSize={PAGE_SIZE}
            onPage={setPagina}
          />
      </Panel>

      {edicao && (
        <ClienteDrawer
          key={edicao.cliente?.id ?? "novo"}
          cliente={edicao.cliente}
          centros={centros}
          aberto
          onClose={() => setEdicao(null)}
        />
      )}
    </PageLayout>
  );
}

/** O cadastro mistura CNPJ (14) e CPF (11) na mesma coluna. */
function formatarDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

/** Linha secundaria da celula de nome. Some por inteiro se nao houver nada. */
function Subtitulo({ partes }: { partes: (string | null)[] }) {
  const texto = partes.filter(Boolean).join(" · ");
  if (!texto) return null;

  return (
    <div
      style={{
        fontSize: "var(--text-xs)",
        color: "var(--text-tertiary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {texto}
    </div>
  );
}
