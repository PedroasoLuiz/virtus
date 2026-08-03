"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  EmptyRow,
  FilterButton,
  FilterItem,
  IconeKanban,
  IconeTabela,
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
  ViewButton,
  selectStyle,
  tdNum,
  type Tom,
} from "@/components/ui/kit";
import { Quadro } from "@/components/ui/quadro";
import { useAvisos } from "@/components/ui/avisos";
import { cookieDaVisao } from "@/components/layout/cookies";
import { ProjetoDrawer, type OpcaoCliente } from "./projeto-drawer";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { periodoEmMeses } from "@/shared/utils/datas";
import {
  progresso,
  ROTULO_SITUACAO,
  SITUACOES,
  TOM_SITUACAO,
  type ProjetoResumo,
  type SituacaoProjeto,
} from "@/modules/projetos/projetos.types";

/**
 * Listagem de projetos, em tabela ou quadro.
 *
 * O quadro e por SITUACAO do projeto — que e diferente do quadro de demandas,
 * que vive dentro de cada projeto. Sao duas perguntas: em que pe esta o
 * projeto, e em que pe esta cada tarefa dele.
 */
export function ProjetosTela({
  projetos,
  clientes,
  modoInicial,
}: {
  projetos: ProjetoResumo[];
  clientes: OpcaoCliente[];
  modoInicial: string;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [busca, setBusca] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [verInativos, setVerInativos] = useState(false);
  const [modo, setModo] = useState(modoInicial);
  const [criando, setCriando] = useState(false);
  const [movidos, setMovidos] = useState<Record<number, SituacaoProjeto>>({});

  function escolherModo(novo: string) {
    setModo(novo);
    document.cookie = `${cookieDaVisao("projetos")}=${novo};path=/;max-age=31536000;samesite=lax`;
  }

  const posicionados = useMemo(
    () => projetos.map((p) => ({ ...p, situacao: movidos[p.id] ?? p.situacao })),
    [projetos, movidos],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return posicionados.filter((p) => {
      if (!p.ativo && !verInativos) return false;
      if (modalidade && p.modalidade !== modalidade) return false;
      if (!termo) return true;
      return (
        String(p.numero).includes(termo) ||
        p.nome.toLowerCase().includes(termo) ||
        (p.clienteNome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [posicionados, busca, modalidade, verInativos]);

  /** Movimento otimista: o card muda de coluna antes do servidor confirmar. */
  async function mover(projetoId: number, indice: number) {
    const destino = SITUACOES[indice];
    setMovidos((m) => ({ ...m, [projetoId]: destino }));

    const r = await fetch(`/api/v1/projetos/${projetoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situacao: destino }),
    });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", "Não foi possível mover o projeto", corpo?.error?.message);
      setMovidos((m) => {
        const copia = { ...m };
        delete copia[projetoId];
        return copia;
      });
      return;
    }

    router.refresh();
  }

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Projetos">
          <ViewButton
            view={modo}
            setView={escolherModo}
            opcoes={[
              { valor: "tabela", rotulo: "Tabela", icone: <IconeTabela /> },
              { valor: "kanban", rotulo: "Kanban", icone: <IconeKanban /> },
            ]}
          />
          <FilterButton
            activeCount={(modalidade ? 1 : 0) + (verInativos ? 1 : 0)}
            onClear={() => {
              setModalidade("");
              setVerInativos(false);
            }}
          >
            <FilterItem label="Modalidade">
              <select
                value={modalidade}
                onChange={(e) => setModalidade(e.target.value)}
                style={selectStyle}
              >
                <option value="">Todas</option>
                <option value="FECHADO">Escopo fechado</option>
                <option value="POR_DEMANDA">Por demanda</option>
              </select>
            </FilterItem>

            <FilterItem label="Inativos">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: "var(--text-base)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={verInativos}
                  onChange={(e) => setVerInativos(e.target.checked)}
                  style={{ accentColor: "var(--primary)", cursor: "pointer" }}
                />
                Exibir inativos
              </label>
            </FilterItem>
          </FilterButton>

          <SearchInput value={busca} onSearch={setBusca} />
          <IncluirButton onClick={() => setCriando(true)} />
        </PageHeader>

        {modo === "kanban" ? (
          <Quadro
            // O índice vira o id da coluna: a situação é conjunto fixo, não
            // tabela — não há id de verdade para usar.
            colunas={SITUACOES.map((s, i) => ({
              id: i,
              descricao: ROTULO_SITUACAO[s],
              cor: TOM_SITUACAO[s],
            }))}
            cartoes={filtrados.map((p) => ({ ...p, colunaId: SITUACOES.indexOf(p.situacao) }))}
            aoMover={mover}
            aoAbrir={(p) => router.push(`/projetos/${p.id}`)}
            vazio="Nenhum projeto"
            corpo={(p) => <CardProjeto projeto={p} />}
            /* Sem valor no cartao: em POR_DEMANDA ele nao existe ate a tarefa
               ser concluida, entao metade dos cartoes mostraria "—" numa coluna
               reservada a dinheiro. O quadro de projeto responde "como vai a
               entrega"; quanto se cobra e pergunta da tela de tickets. */
            rodape={(p) => (
              <>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  {p.qtdConcluidas}/{p.qtdDemandas} tarefas
                </span>
                <span style={{ flex: 1 }} />
                {/* A fracao diz quantas faltam; a porcentagem diz o quanto anda.
                    Sao leituras diferentes, e no cartao cabem as duas. */}
                {p.qtdDemandas > 0 && (
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--fw-semi)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {Math.round(progresso(p) * 100)}%
                  </span>
                )}
              </>
            )}
          />
        ) : (
          <TableFrame>
            <TableArea minWidth={900}>
              <TableHead>
                <Th minWidth={60}>Nº</Th>
                <Th>Projeto</Th>
                <Th align="center" minWidth={120}>
                  Situação
                </Th>
                <Th minWidth={130}>Período</Th>
                <Th minWidth={150}>Progresso</Th>
                <Th align="right" minWidth={100}>
                  Valor
                </Th>
              </TableHead>
              <tbody>
                {filtrados.length === 0 && <EmptyRow colSpan={6} />}
                {filtrados.map((p, i) => (
                  <Tr
                    key={p.id}
                    delay={Math.min(i * 20, 150)}
                    dimmed={!p.ativo || p.cancelado}
                    onClick={() => router.push(`/projetos/${p.id}`)}
                  >
                    <Td style={{ color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                      {p.numero}
                    </Td>
                    <Td style={{ maxWidth: 300 }}>
                      <div
                        style={{
                          fontWeight: "var(--fw-medium)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.nome}
                      </div>
                      {p.clienteNome && (
                        <div
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.clienteNome}
                        </div>
                      )}
                    </Td>
                    <Td style={{ textAlign: "center" }}>
                      <Badge tom={TOM_SITUACAO[p.situacao] as Tom}>
                        {ROTULO_SITUACAO[p.situacao]}
                      </Badge>
                    </Td>
                    <Td style={{ whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {periodoEmMeses(p.inicio, p.fim) ?? "—"}
                    </Td>
                    <Td>
                      <Progresso projeto={p} />
                    </Td>
                    <Td style={tdNum}>
                      {p.modalidade === "FECHADO" ? formatarSemSimbolo(p.valor) : "—"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableArea>
          </TableFrame>
        )}
      </Panel>

      {criando && (
        <ProjetoDrawer
          projetoId={null}
          criando
          clientes={clientes}
          onClose={() => setCriando(false)}
        />
      )}
    </PageLayout>
  );
}

function CardProjeto({ projeto }: { projeto: ProjetoResumo }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
          fontSize: "var(--text-sm)",
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
          {projeto.numero}
        </span>
        {/*
         * Etiqueta, do mesmo tamanho do numero — e classificacao, nao frase.
         *
         * Cor propria para cada modalidade, e nenhuma delas verde: verde no app
         * significa dinheiro entrando, e a modalidade so diz por ONDE ele vem.
         * Azul para o escopo fechado (valor combinado de uma vez), ambar para o
         * por demanda (pinga conforme entrega).
         */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 17,
            padding: "0 6px",
            borderRadius: "var(--radius-xs)",
            background:
              projeto.modalidade === "FECHADO" ? "var(--info-bg)" : "var(--warning-bg)",
            color: projeto.modalidade === "FECHADO" ? "var(--info)" : "var(--warning-text)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-wide)",
            whiteSpace: "nowrap",
          }}
        >
          {projeto.modalidade === "FECHADO" ? "ESCOPO FECHADO" : "POR DEMANDA"}
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
          marginTop: 7,
        }}
      >
        {projeto.nome}
      </div>

      {projeto.clienteNome && (
        <div
          style={{
            marginTop: 4,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {projeto.clienteNome}
        </div>
      )}
    </>
  );
}

/** Barra fina com a contagem ao lado — o número sozinho não mostra o quanto. */
function Progresso({ projeto }: { projeto: ProjetoResumo }) {
  const fracao = progresso(projeto);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          minWidth: 60,
          borderRadius: "var(--radius-full)",
          background: "var(--surface-3)",
          overflow: "hidden",
        }}
      >
        <div
          className="redondo"
          style={{
            width: `${fracao * 100}%`,
            height: "100%",
            borderRadius: "var(--radius-full)",
            background: fracao >= 1 ? "var(--success)" : "var(--primary)",
            transition: "width var(--dur) var(--ease)",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {projeto.qtdConcluidas}/{projeto.qtdDemandas}
      </span>
    </div>
  );
}
