"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  inputStyle,
  tdNum,
} from "@/components/ui/kit";
import { NovoRecebimentoDrawer } from "./novo-recebimento-drawer";
import { RecebimentoDrawer } from "./recebimento-drawer";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { RecebimentoResumo } from "@/modules/recebimentos/recebimentos.types";

/**
 * Listagem do dinheiro que entrou.
 *
 * E o outro lado de "Contas a receber": la esta o que o cliente deve, aqui o que
 * ele pagou. Uma linha por LANCAMENTO — o mesmo que o extrato do banco mostra —
 * e nao uma por parcela quitada. Um PIX que fecha tres parcelas e uma linha so,
 * e e assim que ele aparece no banco.
 *
 * Filtro e busca acontecem em memoria sobre a pagina carregada. Quando o volume
 * exigir, sobem para a query — `listarQuerySchema` ja preve os parametros.
 */

const PAGE_SIZE = 25;

export function RecebimentosTabela({
  recebimentos,
  clientes,
}: {
  recebimentos: RecebimentoResumo[];
  clientes: { id: number; nome: string }[];
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return recebimentos.filter((r) => {
      if (de && (r.data ?? "") < de) return false;
      if (ate && (r.data ?? "") > ate) return false;
      if (!termo) return true;
      return (
        String(r.id).includes(termo) ||
        (r.clienteNome ?? "").toLowerCase().includes(termo) ||
        (r.tipo ?? "").toLowerCase().includes(termo)
      );
    });
  }, [recebimentos, busca, de, ate]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  return (
    <PageLayout>
      <Panel>
        <PageHeader
          title="Baixas"
          description="Cada dinheiro que entrou e as parcelas que ele quitou. Um PIX que fecha três contas é uma baixa só: é assim que o extrato do banco vê."
        >
          <FilterButton
            activeCount={(de ? 1 : 0) + (ate ? 1 : 0)}
            onClear={() => {
              setDe("");
              setAte("");
              setPagina(1);
            }}
          >
            <FilterItem label="De">
              <input
                type="date"
                value={de}
                onChange={(e) => {
                  setDe(e.target.value);
                  setPagina(1);
                }}
                style={inputStyle}
              />
            </FilterItem>
            <FilterItem label="Até">
              <input
                type="date"
                value={ate}
                onChange={(e) => {
                  setAte(e.target.value);
                  setPagina(1);
                }}
                style={inputStyle}
              />
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

        <TableFrame>
          <TableArea minWidth={900}>
            <TableHead>
              <Th minWidth={90}>Data</Th>
              <Th>Cliente</Th>
              <Th minWidth={110}>Forma</Th>
              <Th minWidth={140}>Conta</Th>
              <Th minWidth={130}>Destino</Th>
              <Th align="center" minWidth={100}>
                Conciliado
              </Th>
              <Th align="right" minWidth={100}>
                Acréscimo
              </Th>
              <Th align="right" minWidth={110}>
                Valor
              </Th>
            </TableHead>
            <tbody>
              {visiveis.length === 0 && <EmptyRow colSpan={8} />}
              {visiveis.map((r, i) => (
                <Tr key={r.id} delay={Math.min(i * 20, 150)} onClick={() => setDetalhe(r.id)}>
                  <Td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {r.data ? paraFormatoBR(r.data as DataISO) : "—"}
                  </Td>
                  <Td style={{ maxWidth: 240 }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.clienteNome ?? "—"}
                    </span>
                  </Td>
                  <Td style={{ color: "var(--text-secondary)" }}>{r.tipo ?? "—"}</Td>
                  <Td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {r.contaNome ?? "—"}
                  </Td>
                  <Td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {destino(r)}
                  </Td>
                  <Td style={{ textAlign: "center" }}>
                    {/* Conciliado e gesto humano: significa "conferi no extrato".
                        Por isso nasce pendente e nada no sistema o marca sozinho. */}
                    <Badge tom={r.conciliado ? "success" : "warning"}>
                      {r.conciliado ? "Sim" : "Pendente"}
                    </Badge>
                  </Td>
                  <Td style={tdNum}>
                    <Acrescimo juros={r.juros} multa={r.multa} />
                  </Td>
                  <Td style={{ ...tdNum, fontWeight: "var(--fw-medium)", color: "var(--credito)" }}>
                    {formatarSemSimbolo(r.valor)}
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
        </TableFrame>
      </Panel>

      <RecebimentoDrawer
        recebimentoId={detalhe}
        aoEstornar={() => router.refresh()}
        onClose={() => setDetalhe(null)}
      />

      {criando && (
        <NovoRecebimentoDrawer
          clientes={clientes}
          onClose={() => setCriando(false)}
          aoCriar={() => {
            setCriando(false);
            router.refresh();
          }}
        />
      )}
    </PageLayout>
  );
}

/** "3 parcelas · 2 contas". Com uma conta so, dizer isso e ruido. */
function destino(r: RecebimentoResumo): string {
  const parcelas = r.qtdParcelas === 1 ? "1 parcela" : `${r.qtdParcelas} parcelas`;
  return r.qtdContas > 1 ? `${parcelas} · ${r.qtdContas} contas` : parcelas;
}

/**
 * Juros e multa somados, com o detalhe no hover.
 *
 * Somados porque a coluna responde "teve acrescimo?", que e a pergunta de
 * relance; a divisao entre os dois so importa quando a resposta e sim, e ai o
 * drawer mostra separado.
 */
function Acrescimo({ juros, multa }: { juros: number; multa: number }) {
  const total = juros + multa;
  if (total <= 0) return <span style={{ color: "var(--text-disabled)" }}>—</span>;

  return (
    <span
      title={`Juros ${formatarSemSimbolo(juros as Centavos)} · multa ${formatarSemSimbolo(multa as Centavos)}`}
      style={{ color: "var(--text-secondary)" }}
    >
      {formatarSemSimbolo(total as Centavos)}
    </span>
  );
}
