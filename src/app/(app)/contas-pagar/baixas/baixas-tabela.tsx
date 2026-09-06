"use client";

import { useRouter } from "next/navigation";

import { useMemo, useState } from "react";
import {
  EmptyRow,
  FilterButton,
  FilterItem,
  IncluirButton,
  MarcaDeConciliacao,
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
} from "@/components/ui/kit";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { IndicadoresDeBaixa } from "@/components/financeiro/indicadores-de-baixa";
import { BaixaDrawer } from "./baixa-drawer";
import { NovaBaixaDrawer } from "./nova-baixa-drawer";
import type {
  BaixaPagarResumo,
  IndicadoresDeBaixaPagar,
} from "@/modules/contas-pagar/contas-pagar.types";

/**
 * Listagem do dinheiro que saiu para quitar conta a pagar.
 *
 * Espelho de /recebimentos: la esta o que entrou, aqui o que saiu. Uma linha por
 * LANCAMENTO — o mesmo que o extrato do banco mostra — e nao uma por parcela
 * quitada. Um PIX que fecha tres parcelas e uma linha so, e e assim que ele
 * aparece no banco.
 *
 * Filtro e busca acontecem em memoria sobre a pagina carregada. Quando o volume
 * exigir, sobem para a query.
 */

const PAGE_SIZE = 25;

const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

/** "3 parcelas · 2 contas". Com uma conta so, dizer isso e ruido. */
function destino(b: BaixaPagarResumo): string {
  const parcelas =
    b.qtdParcelas === 1 ? "1 parcela" : `${b.qtdParcelas} parcelas`;
  return b.qtdContas > 1 ? `${parcelas} · ${b.qtdContas} contas` : parcelas;
}

export function BaixasTabela({
  baixas,
  indicadores,
}: {
  baixas: BaixaPagarResumo[];
  indicadores: IndicadoresDeBaixaPagar;
}) {
  const router = useRouter();
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return baixas.filter((b) => {
      if (de && (b.data ?? "") < de) return false;
      if (ate && (b.data ?? "") > ate) return false;
      if (!termo) return true;
      return (
        String(b.id).includes(termo) ||
        (b.fornecedorNome ?? "").toLowerCase().includes(termo) ||
        (b.tipo ?? "").toLowerCase().includes(termo)
      );
    });
  }, [baixas, busca, de, ate]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE,
  );

  return (
    <PageLayout>
      <Panel>
        {/*
          "Baixas" e nao "Pagamentos", pelo mesmo motivo do outro lado: e o nome
          que o financeiro usa para o gesto de dar por pago. E o titulo nao
          repete o nome do grupo do menu.
        */}
        <PageHeader title="Baixas">
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

        {/*
          ⚠️ Os cartoes ficam FORA do `TableFrame`. O recuo lateral de 16 mora no
          frame porque ha um cartao em volta da tabela; os indicadores tem cartao
          proprio, e dentro do frame ganhariam o recuo duas vezes.
        */}
        <div style={{ padding: "0 16px 14px" }}>
          <IndicadoresDeBaixa dados={indicadores} sentido="saida" />
        </div>

        <TableFrame>
          <TableArea minWidth={900}>
            <TableHead>
              {/*
                ⚠️ Conciliado abre a linha, antes da data: e o estado do
                registro, e a pergunta de quem varre a lista e "o que ainda falta
                conferir?". E TUDO a esquerda, inclusive o dinheiro.
              */}
              <Th minWidth={64}>#</Th>
              <Th minWidth={80}>Conciliado</Th>
              <Th minWidth={90}>Data</Th>
              <Th>Fornecedor</Th>
              <Th minWidth={110}>Forma</Th>
              <Th minWidth={190}>Conta</Th>
              <Th minWidth={130}>Destino</Th>
              <Th minWidth={110}>Valor</Th>
            </TableHead>
            <tbody>
              {visiveis.length === 0 && <EmptyRow colSpan={8} />}
              {visiveis.map((b, i) => (
                <Tr
                  key={b.id}
                  delay={Math.min(i * 20, 150)}
                  onClick={() => setDetalhe(b.id)}
                >
                  <Td style={NUM}>{b.id}</Td>
                  <Td>
                    <MarcaDeConciliacao conciliado={b.conciliado} />
                  </Td>
                  <Td style={NUM}>
                    {b.data ? paraFormatoBR(b.data as DataISO) : "—"}
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
                      {b.fornecedorNome ?? "—"}
                    </span>
                  </Td>
                  {/*
                    ⚠️ Todas as celulas no mesmo peso e na mesma cor. Numa lista
                    de dinheiro que saiu, TODO valor e debito: pintar todos de
                    vermelho nao distingue nada, so tira a cor de circulacao para
                    quando ela tiver algo a dizer.
                  */}
                  <Td>{b.tipo ?? "—"}</Td>
                  <Td style={{ whiteSpace: "nowrap" }}>{b.contaNome ?? "—"}</Td>
                  <Td style={{ whiteSpace: "nowrap" }}>{destino(b)}</Td>
                  <Td style={NUM}>{formatarSemSimbolo(b.valor)}</Td>
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

      <BaixaDrawer
        baixaId={detalhe}
        onClose={() => setDetalhe(null)}
        /* A baixa estornada deixou de existir: a lista atrás precisa reler. */
        aoEstornar={() => router.refresh()}
      />
      {criando && <NovaBaixaDrawer onClose={() => setCriando(false)} />}
    </PageLayout>
  );
}
