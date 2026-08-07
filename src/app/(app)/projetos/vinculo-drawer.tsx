"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  EmptyRow,
  Pagination,
  SearchInput,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";

/**
 * Escolher o que vincular ao projeto — tickets ou contratos.
 *
 * Um drawer sobre o outro, e nao uma lista embutida no formulario: vincular e um
 * desvio no meio de outra tarefa, e a lista embutida empurrava tudo o que vinha
 * depois para fora da tela justamente enquanto se procurava.
 *
 * Serve aos dois porque a pergunta e a mesma — "quais destes?" —, e duas telas
 * quase iguais divergiriam no primeiro ajuste.
 */

/** Quantas linhas por pagina. O drawer nao cresce, entao o numero e fixo. */
const POR_PAGINA = 8;

export type ItemVinculavel = {
  id: number;
  /** O identificador que a pessoa procura: numero do ticket, numero do contrato. */
  marca: string;
  descricao: string | null;
  apoio: string | null;
  valor: number;
};

export function VinculoDrawer({
  titulo,
  rotuloMarca,
  vazio,
  urlLista,
  mapear,
  urlVinculo,
  aoVincular,
  onClose,
}: {
  titulo: string;
  /** O cabecalho da primeira coluna: "Ticket", "Contrato". */
  rotuloMarca: string;
  /** O que dizer quando nao ha nada para escolher, com o motivo. */
  vazio: string;
  urlLista: string;
  /** Traduz a linha da API para o que a lista mostra — ticket e contrato diferem. */
  mapear: (bruto: never) => ItemVinculavel;
  /** Recebe o id escolhido e devolve a URL do POST. */
  urlVinculo: (id: number) => string;
  aoVincular: (projeto: unknown) => void;
  onClose: () => void;
}) {
  const { avisar } = useAvisos();
  const [itens, setItens] = useState<ItemVinculavel[] | null>(null);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const controle = new AbortController();

    fetch(urlLista, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar");
        setItens((corpo.data as never[]).map(mapear));
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") {
          avisar("erro", e.message);
          setItens([]);
        }
      });

    return () => controle.abort();
    // `mapear` fica de fora de proposito: e uma funcao literal, recriada a cada
    // render, e na dependencia refaria a busca sem parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLista, avisar]);

  /*
   * Busca e paginacao no cliente.
   *
   * A lista ja vem inteira e limitada a 200 pelo repositorio: uma ida ao
   * servidor a cada letra digitada custaria mais que filtrar o que ja esta na
   * memoria, e o drawer nao existe para percorrer milhares.
   */
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo || !itens) return itens ?? [];

    return itens.filter(
      (i) =>
        i.marca.toLowerCase().includes(termo) ||
        (i.descricao ?? "").toLowerCase().includes(termo) ||
        (i.apoio ?? "").toLowerCase().includes(termo),
    );
  }, [itens, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  /*
   * Um POST por item, em sequencia.
   *
   * O endpoint vincula um de cada vez, e a primeira recusa interrompe: os
   * anteriores ja entraram e ficam. Vincular e reversivel pela coluna de acoes,
   * entao parar no meio e mostrar o motivo custa menos que uma rota so para o
   * lote.
   */
  async function vincular() {
    setSalvando(true);
    let ultimo: unknown = null;

    for (const id of marcados) {
      const r = await fetch(urlVinculo(id), { method: "POST" });
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setSalvando(false);
        if (ultimo) aoVincular(ultimo);
        avisar("atencao", dados?.error?.message ?? "Não foi possível vincular");
        return;
      }
      ultimo = dados.data;
    }

    setSalvando(false);
    if (ultimo) aoVincular(ultimo);
    avisar("sucesso", marcados.length === 1 ? "Vinculado" : `${marcados.length} vinculados`);
    onClose();
  }

  const total = (itens ?? [])
    .filter((i) => marcados.includes(i.id))
    .reduce((soma, i) => soma + i.valor, 0) as Centavos;

  return (
    <Drawer
      open
      onClose={onClose}
      title={titulo}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {marcados.length > 0 && (
            <div style={{ minWidth: 0 }}>
              <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
                {marcados.length} selecionado{marcados.length > 1 ? "s" : ""}
              </div>
              <div
                style={{
                  fontSize: "var(--text-md)",
                  fontWeight: "var(--fw-semi)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatarSemSimbolo(total)}
              </div>
            </div>
          )}

        </div>
      }
      acoes={
        <Button
          size="xs"
          variant="primary"
          disabled={marcados.length === 0 || salvando}
          onClick={vincular}
        >
          {salvando ? "Vinculando…" : "Vincular"}
        </Button>
      }
    >
      <div style={{ marginBottom: 10 }}>
        <SearchInput value={busca} onSearch={setBusca} placeholder="Buscar" width="100%" />
      </div>

      {/* A moldura da tabela e feita aqui, e nao com `TableFrame`: aquele ocupa a
          altura toda da pagina, e aqui a tabela divide o drawer com a busca e o
          rodape. */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        <TableArea minWidth={0}>
          <TableHead>
            <Th minWidth={80}>{rotuloMarca}</Th>
            <Th>Descrição</Th>
            <Th align="right" minWidth={90}>
              Valor
            </Th>
          </TableHead>
          <tbody>
            {itens == null && <EmptyRow colSpan={3} message="Carregando…" />}
            {itens != null && visiveis.length === 0 && (
              <EmptyRow colSpan={3} message={busca ? "Nada encontrado" : vazio} />
            )}

            {visiveis.map((i, n) => {
              const marcado = marcados.includes(i.id);

              return (
                <Tr
                  key={i.id}
                  delay={n * 12}
                  onClick={() =>
                    setMarcados((m) =>
                      m.includes(i.id) ? m.filter((x) => x !== i.id) : [...m, i.id],
                    )
                  }
                >
                  <Td style={{ background: marcado ? "var(--primary-subtle)" : undefined }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Caixa marcada={marcado} />
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{i.marca}</span>
                    </span>
                  </Td>
                  <Td style={{ background: marcado ? "var(--primary-subtle)" : undefined }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {i.descricao ?? "—"}
                    </span>
                    {i.apoio && (
                      <span style={{ color: "var(--text-tertiary)" }}>{i.apoio}</span>
                    )}
                  </Td>
                  <Td
                    style={{
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      background: marcado ? "var(--primary-subtle)" : undefined,
                    }}
                  >
                    {formatarSemSimbolo(i.valor as Centavos)}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableArea>

        {filtrados.length > POR_PAGINA && (
          <Pagination
            page={atual}
            totalPages={totalPaginas}
            total={filtrados.length}
            pageSize={POR_PAGINA}
            onPage={setPagina}
          />
        )}
      </div>
    </Drawer>
  );
}

/** Mesma caixa desenhada do checklist da tarefa — a nativa varia por navegador. */
function Caixa({ marcada }: { marcada: boolean }) {
  return (
    <span
      role="checkbox"
      aria-checked={marcada}
      style={{
        flexShrink: 0,
        width: 15,
        height: 15,
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--radius-full)",
        border: marcada ? "none" : "1.5px solid var(--border-strong)",
        background: marcada ? "var(--success)" : "transparent",
        color: "#fff",
      }}
    >
      {marcada && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}
