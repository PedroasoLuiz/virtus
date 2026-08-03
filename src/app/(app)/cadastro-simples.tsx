"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  EmptyRow,
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
} from "@/components/ui/kit";

/**
 * Listagem + CRUD de cadastro simples.
 *
 * Serve as telas que sao "descricao + duas ou tres colunas" (servicos, centro
 * de custo). A tela concreta descreve as colunas e entrega o drawer de
 * formulario; tabela, busca e paginacao vem daqui, sem repeticao.
 */

export type Coluna<T> = {
  rotulo: string;
  largura?: number;
  alinhamento?: "left" | "center" | "right";
  /** Como a celula e desenhada a partir do registro. */
  celula: (item: T) => React.ReactNode;
  /** Texto considerado na busca. Ausente = coluna nao e pesquisavel. */
  busca?: (item: T) => string;
};

const PAGE_SIZE = 25;

export function CadastroSimples<T extends { id: number; ativo: boolean }>({
  titulo,
  itens,
  colunas,
  drawer,
}: {
  titulo: string;
  itens: T[];
  colunas: Coluna<T>[];
  /** `null` no argumento significa novo registro. */
  drawer: (item: T | null, fechar: () => void) => React.ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [edicao, setEdicao] = useState<{ item: T | null } | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;

    return itens.filter((i) =>
      colunas.some((c) => c.busca?.(i).toLowerCase().includes(termo)),
    );
  }, [itens, colunas, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title={titulo} description={`${filtrados.length} de ${itens.length}`}>
          <SearchInput
            value={busca}
            onSearch={(v) => {
              setBusca(v);
              setPagina(1);
            }}
          />
          <IncluirButton onClick={() => setEdicao({ item: null })} />
        </PageHeader>

        <TableFrame>
          <TableArea minWidth={620}>
            <TableHead>
              {colunas.map((c) => (
                <Th key={c.rotulo} align={c.alinhamento} minWidth={c.largura}>
                  {c.rotulo}
                </Th>
              ))}
              <Th align="center" minWidth={90}>
                Situação
              </Th>
            </TableHead>
            <tbody>
              {visiveis.length === 0 && <EmptyRow colSpan={colunas.length + 1} />}
              {visiveis.map((item, i) => (
                <Tr
                  key={item.id}
                  delay={Math.min(i * 20, 150)}
                  dimmed={!item.ativo}
                  onClick={() => setEdicao({ item })}
                >
                  {colunas.map((c) => (
                    <Td
                      key={c.rotulo}
                      style={{
                        textAlign: c.alinhamento,
                        fontVariantNumeric:
                          c.alinhamento === "right" ? "tabular-nums" : undefined,
                      }}
                    >
                      {c.celula(item)}
                    </Td>
                  ))}
                  <Td style={{ textAlign: "center" }}>
                    <Badge tom={item.ativo ? "success" : "neutral"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
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

      {edicao && drawer(edicao.item, () => setEdicao(null))}
    </PageLayout>
  );
}
