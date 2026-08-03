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
import { Quadro } from "@/components/ui/quadro";
import { useAvisos } from "@/components/ui/avisos";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { avisar } = useAvisos();
  const [criando, setCriando] = useState(false);

  /*
   * Arrastar troca a SITUACAO da conta.
   *
   * As transicoes validas sao do servidor (`podeTransicionar`): tentar uma que
   * nao existe volta com o motivo, e a tela nao repete a regra. Duplicada aqui,
   * ela divergiria da do servico no primeiro ajuste.
   */
  async function moverConta(id: number, situacao: SituacaoFatura) {
    const r = await fetch(`/api/v1/faturas/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: situacao }),
    });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível mover a conta");
      return;
    }
    router.refresh();
  }

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
          <QuadroDeContas
            faturas={filtradas}
            aoAbrir={setDetalhe}
            aoMover={moverConta}
          />
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
 * Quadro de contas a receber.
 *
 * Usa o `Quadro` compartilhado, o mesmo de tickets e de projetos. Esta tela
 * tinha um kanban proprio, escrito antes do componente existir: mesma ideia,
 * medidas diferentes, e cada ajuste de espacamento precisava ser feito duas
 * vezes.
 *
 * As colunas sao as SITUACOES, um conjunto fixo, entao dividem a largura. A
 * cancelada fica de fora de proposito: ela nao e uma etapa do caminho, e uma
 * coluna morta no fim rouba largura das cinco que importam.
 */
function QuadroDeContas({
  faturas,
  aoAbrir,
  aoMover,
}: {
  faturas: FaturaResumo[];
  aoAbrir: (id: number) => void;
  aoMover: (id: number, situacao: SituacaoFatura) => void;
}) {
  const colunas: SituacaoFatura[] = ["ORÇAMENTO", "ABERTA", "FATURADA", "PARC. PAGA", "PAGA"];

  return (
    <Quadro
      colunas={colunas.map((c, i) => ({ id: i, descricao: c, cor: COR_COLUNA[c] }))}
      cartoes={faturas
        .filter((f) => !f.cancelada)
        .map((f) => ({
          ...f,
          colunaId: colunas.indexOf(f.situacao),
          /*
           * Conta paga nao volta arrastando.
           *
           * O que a tirou de "aberta" foi uma BAIXA, com valor e data. Desfazer
           * isso e estornar um recebimento, nao mover um cartao.
           */
          arrastavel: f.situacao !== "PAGA" && f.situacao !== "PARC. PAGA",
        }))}
      aoMover={(id, coluna) => aoMover(id, colunas[coluna])}
      aoAbrir={(f) => aoAbrir(f.id)}
      vazio="Nenhuma conta"
      corpo={(f) => (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-sm)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 17,
                padding: "0 6px",
                borderRadius: "var(--radius-xs)",
                background: "var(--primary-subtle)",
                color: "var(--primary)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--fw-semi)",
              }}
            >
              {f.numero}
            </span>
            <span style={{ color: "var(--text-tertiary)", fontVariantNumeric: "normal" }}>
              {periodo(f.apuracaoInicio, f.apuracaoFim)}
            </span>
          </div>

          <div
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-medium)",
              lineHeight: 1.32,
              letterSpacing: "var(--tracking-normal)",
              marginTop: 7,
            }}
          >
            {f.clienteNome ?? "—"}
          </div>
        </>
      )}
      rodape={(f) => (
        <>
          <Vencimento data={f.proximoVencimento} pago={f.situacao === "PAGA"} />
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatarSemSimbolo(f.total)}
          </span>
        </>
      )}
    />
  );
}
