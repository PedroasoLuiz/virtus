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
  inputStyle,
  selectStyle,
  tdNum,
  type Tom,
} from "@/components/ui/kit";
import { TicketDrawer, type OpcaoCliente, type OpcaoServico } from "./ticket-drawer";
import { useAvisos } from "@/components/ui/avisos";
import { cookieDaVisao } from "@/components/layout/cookies";
import { IconeFatura, IconeServico } from "./icones";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses } from "@/shared/utils/datas";
import {
  ehDoFaturamento,
  type StatusTicket,
  type TicketResumo,
} from "@/modules/tickets/tickets.types";

/**
 * Listagem de tickets.
 *
 * O quadro e organizado pelas COLUNAS CADASTRADAS, nao pela situacao derivada do
 * saldo: a etapa em que o ticket esta e decisao de quem opera. O sistema so
 * manda nas duas ultimas — "Faturado" (chave PARCIAL) e "Encerrada" —, onde
 * quem coloca o card e o gatilho de faturamento.
 *
 * Ticket cancelado nao vira coluna: cancelar e ortogonal a etapa, e virar coluna
 * apagaria a informacao de onde ele parou. Fica cinza escuro na propria coluna,
 * e o filtro decide se aparece.
 *
 * Nao ha coluna de titulo. Nos tickets migrados ele e so o numero da fatura de
 * origem, o que sugeriria um vinculo 1:1 com a conta a receber — e um ticket
 * pode alimentar varias.
 */

const PAGE_SIZE = 25;

export function TicketsTabela({
  tickets,
  colunas,
  clientes,
  servicos,
  emitidoPor,
  modoInicial,
}: {
  tickets: TicketResumo[];
  colunas: StatusTicket[];
  clientes: OpcaoCliente[];
  servicos: OpcaoServico[];
  /** Nome de quem esta logado — vai no rodape do PDF. */
  emitidoPor: string;
  /** Lido do cookie no servidor, para a tela nao abrir em tabela e trocar. */
  modoInicial: string;
}) {
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();

  const [busca, setBusca] = useState("");
  const [statusId, setStatusId] = useState("");
  const [origem, setOrigem] = useState("");
  const [verCancelados, setVerCancelados] = useState(false);
  const [modo, setModo] = useState(modoInicial);
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);

  // Movimento otimista: o card muda de coluna na hora e o servidor confirma
  // depois. Sem isso, arrastar teria a latencia de um round-trip.
  const [movidos, setMovidos] = useState<Record<number, number>>({});

  const ativas = useMemo(() => colunas.filter((c) => c.ativo), [colunas]);
  const primeira = ativas[0];

  const posicionados = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        // Ticket sem coluna cai na primeira: nao ter etapa e estar no comeco.
        statusId: movidos[t.id] ?? t.statusId ?? primeira?.id ?? null,
      })),
    [tickets, movidos, primeira],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return posicionados.filter((t) => {
      if (t.cancelada && !verCancelados) return false;
      if (statusId && String(t.statusId) !== statusId) return false;
      if (origem && t.origem !== origem) return false;
      if (!termo) return true;
      return (
        String(t.numero).includes(termo) ||
        // Titulo nao e coluna, mas continua pesquisavel: e onde fica a
        // descricao curta do que foi executado.
        t.titulo.toLowerCase().includes(termo) ||
        (t.clienteNome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [posicionados, busca, statusId, origem, verCancelados]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const filtrosAtivos = [statusId, origem].filter(Boolean).length + (verCancelados ? 1 : 0);

  /**
   * A escolha entre tabela e kanban vira cookie.
   *
   * Sem isso, quem trabalha no quadro reabria a tela em tabela a cada
   * navegacao. Um ano de validade porque e preferencia, nao sessao.
   */
  function escolherModo(novo: string) {
    setModo(novo);
    document.cookie = `${cookieDaVisao("tickets")}=${novo};path=/;max-age=31536000;samesite=lax`;
  }

  async function mover(ticketId: number, destinoId: number) {
    const anterior = posicionados.find((t) => t.id === ticketId)?.statusId ?? null;
    if (anterior === destinoId) return;

    setMovidos((m) => ({ ...m, [ticketId]: destinoId }));

    const r = await fetch(`/api/v1/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId: destinoId }),
    });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      // O aviso nasce no canto e nao acima das colunas: o card recusado podia
      // estar tres colunas a direita da faixa de erro, e ninguem ligava uma
      // coisa a outra.
      avisar("atencao", "Não foi possível mover o ticket", corpo?.error?.message);
      // Devolve o card para onde estava — a tela nao pode afirmar um movimento
      // que o servidor recusou.
      setMovidos((m) => {
        const copia = { ...m };
        delete copia[ticketId];
        return copia;
      });
      return;
    }

    router.refresh();
  }

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Tickets">
          <ViewButton
            view={modo}
            setView={escolherModo}
            opcoes={[
              { valor: "tabela", rotulo: "Tabela", icone: <IconeTabela /> },
              { valor: "kanban", rotulo: "Kanban", icone: <IconeKanban /> },
            ]}
          />
          <FilterButton
            activeCount={filtrosAtivos}
            onClear={() => {
              setStatusId("");
              setOrigem("");
              setVerCancelados(false);
              setPagina(1);
            }}
          >
            <FilterItem label="Coluna">
              <select
                value={statusId}
                onChange={(e) => {
                  setStatusId(e.target.value);
                  setPagina(1);
                }}
                style={selectStyle}
              >
                <option value="">Todas</option>
                {ativas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao}
                  </option>
                ))}
              </select>
            </FilterItem>

            <FilterItem label="Origem">
              <select
                value={origem}
                onChange={(e) => {
                  setOrigem(e.target.value);
                  setPagina(1);
                }}
                style={selectStyle}
              >
                <option value="">Todas</option>
                <option value="EXECUCAO">Execução</option>
                <option value="MIGRACAO">Migração</option>
                <option value="CONTRATO">Contrato</option>
              </select>
            </FilterItem>

            <FilterItem label="Cancelados">
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
                  checked={verCancelados}
                  onChange={(e) => {
                    setVerCancelados(e.target.checked);
                    setPagina(1);
                  }}
                  style={{ accentColor: "var(--primary)", cursor: "pointer" }}
                />
                Exibir cancelados
              </label>
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

        {modo === "kanban" ? (
          <QuadroTickets
            colunas={ativas}
            tickets={filtrados}
            aoAbrir={setDetalhe}
            aoMover={mover}
            aoMudarColunas={() => router.refresh()}
            aoFalhar={(msg) => avisar("atencao", msg)}
            confirmar={confirmar}
          />
        ) : (
          <TableFrame>
            <TableArea minWidth={880}>
              <TableHead>
                <Th minWidth={70}>Nº</Th>
                <Th>Cliente</Th>
                <Th minWidth={100}>Encerrado</Th>
                <Th align="center" minWidth={130}>
                  Situação
                </Th>
                <Th align="right" minWidth={100}>
                  Total
                </Th>
                <Th align="right" minWidth={100}>
                  Faturado
                </Th>
                <Th align="right" minWidth={100}>
                  Saldo
                </Th>
              </TableHead>
              <tbody>
                {visiveis.length === 0 && <EmptyRow colSpan={7} />}
                {visiveis.map((t, i) => {
                  const coluna = ativas.find((c) => c.id === t.statusId);
                  return (
                    <Tr
                      key={t.id}
                      delay={Math.min(i * 20, 150)}
                      dimmed={t.cancelada}
                      onClick={() => setDetalhe(t.id)}
                    >
                      <Td style={{ fontVariantNumeric: "tabular-nums" }}>
                        <div style={{ color: "var(--text-tertiary)" }}>{t.numero}</div>
                        {t.origem !== "EXECUCAO" && (
                          <div
                            style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}
                          >
                            {t.origem === "MIGRACAO" ? "migrado" : "contrato"}
                          </div>
                        )}
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
                          {t.clienteNome ?? "—"}
                        </span>
                      </Td>
                      <Td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {t.fim ? paraFormatoBR(t.fim) : "—"}
                      </Td>
                      <Td style={{ textAlign: "center" }}>
                        {/* Cancelado vence a etapa: e a informacao que muda a
                            leitura de todas as outras colunas da linha. */}
                        {t.cancelada ? (
                          <Badge tom="neutral">CANCELADO</Badge>
                        ) : (
                          <Badge tom={(coluna?.cor as Tom) ?? "neutral"}>
                            {coluna?.descricao ?? t.status}
                          </Badge>
                        )}
                      </Td>
                      <Td style={tdNum}>{formatarSemSimbolo(t.total)}</Td>
                      <Td style={{ ...tdNum, color: "var(--text-tertiary)" }}>
                        {formatarSemSimbolo(t.faturado)}
                      </Td>
                      <Td
                        style={{
                          ...tdNum,
                          fontWeight: "var(--fw-medium)",
                          // Saldo positivo é dinheiro esperando virar cobrança.
                          color: t.saldo > 0 ? "var(--credito)" : "var(--text-tertiary)",
                        }}
                      >
                        {formatarSemSimbolo(t.saldo)}
                      </Td>
                    </Tr>
                  );
                })}
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
        )}
      </Panel>

      <TicketDrawer
        ticketId={detalhe}
        resumo={posicionados.find((t) => t.id === detalhe) ?? null}
        clientes={clientes}
        servicos={servicos}
        emitidoPor={emitidoPor}
        onClose={() => setDetalhe(null)}
      />
      {criando && (
        <TicketDrawer
          ticketId={null}
          criando
          clientes={clientes}
          servicos={servicos}
          onClose={() => setCriando(false)}
        />
      )}
    </PageLayout>
  );
}

// ════════════════════════════════════════════════════════════════
// QUADRO
// ════════════════════════════════════════════════════════════════

type TicketNoQuadro = TicketResumo & { statusId: number | null };

/**
 * O quadro encosta na base da tela.
 *
 * Sem padding embaixo, e cada coluna arredondada so em cima: assim ela le como
 * trilho que continua abaixo da dobra, e nao como caixa boiando num vazio
 * cinza. O respiro do ultimo card vem por dentro da area rolavel.
 */
function QuadroTickets({
  colunas,
  tickets,
  aoAbrir,
  aoMover,
  aoMudarColunas,
  aoFalhar,
  confirmar,
}: {
  colunas: StatusTicket[];
  tickets: TicketNoQuadro[];
  aoAbrir: (id: number) => void;
  aoMover: (ticketId: number, statusId: number) => void;
  aoMudarColunas: () => void;
  aoFalhar: (msg: string) => void;
  confirmar: (titulo: string, rotulo: string, aoConfirmar: () => void, detalhe?: string) => void;
}) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  return (
    /*
     * As colunas dividem a largura disponivel em vez de rolarem para o lado.
     *
     * Rolagem horizontal escondia colunas atras da borda: quem arrastava um
     * card para "Concluido" precisava rolar segurando o card, e o quadro
     * deixava de responder "onde esta cada coisa" numa olhada — que e a unica
     * razao de existir um kanban.
     *
     * A conta so fecha porque o numero de colunas e pequeno e limitado: as
     * cinco do sistema mais as que o usuario ja tinha criado.
     */
    <div style={{ flex: 1, overflow: "hidden", padding: "0 16px", minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          gap: "var(--kanban-gap)",
          height: "100%",
          alignItems: "stretch",
        }}
      >
        {colunas.map((coluna) => {
          const daColuna = tickets
            .filter((t) => t.statusId === coluna.id)
            .sort((a, b) => b.saldo - a.saldo);

          // Coluna de faturamento nao aceita card arrastado: quem coloca
          // ticket la e a conta a receber, nao o mouse.
          const aceita = arrastando != null && !ehDoFaturamento(coluna.chave);
          const realcada = aceita && sobre === coluna.id;

          return (
            <div
              key={coluna.id}
              onDragOver={(e) => {
                if (!aceita) return;
                e.preventDefault();
                setSobre(coluna.id);
              }}
              onDragLeave={() => setSobre((s) => (s === coluna.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                if (aceita && arrastando != null) aoMover(arrastando, coluna.id);
                setArrastando(null);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                // `minWidth: 0` e o que permite encolher abaixo do conteudo;
                // sem ele o flex respeita a largura minima do texto e a
                // rolagem volta.
                flex: 1,
                minWidth: 0,
                height: "100%",
                minHeight: 0,
                background: "var(--kanban-coluna-bg)",
                borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
                boxShadow: realcada ? "inset 0 0 0 2px var(--primary)" : "none",
                transition: "box-shadow var(--dur-fast) var(--ease)",
              }}
            >
              <CabecalhoColuna
                coluna={coluna}
                quantidade={daColuna.length}
                aoMudar={aoMudarColunas}
                aoFalhar={aoFalhar}
                confirmar={confirmar}
              />

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  padding: "0 9px 14px",
                }}
              >
                {daColuna.length === 0 ? (
                  <ColunaVazia />
                ) : (
                  daColuna.map((t) => (
                    <CardTicket
                      key={t.id}
                      ticket={t}
                      aoAbrir={aoAbrir}
                      aoArrastar={setArrastando}
                      aoSoltar={() => {
                        setArrastando(null);
                        setSobre(null);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Caixa do card. Compartilhada com a silhueta vazia para as duas nao saírem do
 * lugar quando o padding mudar em uma so.
 */
const MOLDURA_CARD: React.CSSProperties = {
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px 9px",
  flexShrink: 0,
};

/**
 * Coluna sem nenhum card.
 *
 * Tres silhuetas no lugar onde os cards ficariam. So o texto "Nenhum ticket"
 * nao dizia o que a coluna e — as silhuetas mostram que ali cabe card e que o
 * espaco esta aberto, que e o convite para arrastar um para dentro.
 *
 * Sao brancas a 35%, a mesma diluicao do fundo da coluna: presentes o bastante
 * para desenhar o lugar, fracas o bastante para nao parecerem conteudo
 * carregando. Desbotam de cima para baixo pelo mesmo motivo.
 *
 * A altura NAO e um numero chutado: a silhueta repete as tres linhas do card
 * real com conteudo vazio, entao ela mede exatamente o que mediria um card de
 * nome em uma linha. Fixar `height` faria as duas divergirem no primeiro ajuste
 * de tipografia.
 */
function ColunaVazia() {
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {[1, 0.6, 0.32].map((opacidade, i) => (
        <div
          key={i}
          style={{
            background: "var(--kanban-card-moldura)",
            borderRadius: "var(--radius-md)",
            padding: 2,
            opacity: opacidade,
            flexShrink: 0,
          }}
        >
          <div style={{ ...MOLDURA_CARD, background: "rgba(255, 255, 255, 0.35)" }}>
            <div style={{ fontSize: "var(--text-sm)" }}>&nbsp;</div>
            <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.32, marginTop: 7 }}>&nbsp;</div>
            <div style={{ fontSize: "var(--text-sm)", marginTop: 4 }}>&nbsp;</div>
          </div>
          <div style={{ height: 22 }} />
        </div>
      ))}

      <div
        style={{
          textAlign: "center",
          marginTop: 4,
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
        }}
      >
        Nenhum ticket
      </div>
    </div>
  );
}

/**
 * Cabecalho da coluna: nome a esquerda, contagem encostada na direita.
 *
 * Renomear e excluir so aparecem no hover — sao acoes raras num quadro que se
 * usa o dia inteiro para arrastar card.
 */
function CabecalhoColuna({
  coluna,
  quantidade,
  aoMudar,
  aoFalhar,
  confirmar,
}: {
  coluna: StatusTicket;
  quantidade: number;
  aoMudar: () => void;
  aoFalhar: (msg: string) => void;
  confirmar: (titulo: string, rotulo: string, aoConfirmar: () => void, detalhe?: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(coluna.descricao);


  async function renomear() {
    setEditando(false);
    const limpo = nome.trim();
    if (!limpo || limpo === coluna.descricao) {
      setNome(coluna.descricao);
      return;
    }
    await chamar("PATCH", `/api/v1/tickets/status/${coluna.id}`, { descricao: limpo });
  }

  async function excluir() {
    await chamar("DELETE", `/api/v1/tickets/status/${coluna.id}`);
  }

  async function chamar(metodo: string, url: string, corpo?: unknown) {
    aoFalhar("");
    const r = await fetch(url, {
      method: metodo,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      // O status entra na mensagem: sem ele, uma falha de permissao e uma de
      // regra de negocio chegam como o mesmo "nao foi possivel".
      aoFalhar(dados?.error?.message ?? `Não foi possível alterar a coluna (HTTP ${r.status})`);
      setNome(coluna.descricao);
      return;
    }
    aoMudar();
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "12px 13px 10px", flexShrink: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 22 }}>
        {editando ? (
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={renomear}
            onKeyDown={(e) => {
              if (e.key === "Enter") renomear();
              if (e.key === "Escape") {
                setNome(coluna.descricao);
                setEditando(false);
              }
            }}
            maxLength={40}
            style={{ ...inputStyle, height: 22, flex: 1, minWidth: 0 }}
          />
        ) : (
          <>
            <span
              onDoubleClick={() => !coluna.sistema && setEditando(true)}
              title={coluna.sistema ? "Coluna do sistema" : "Clique duas vezes para renomear"}
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "var(--fw-semi)",
                letterSpacing: "var(--tracking-snug)",
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {coluna.descricao}
            </span>

            <span style={{ flex: 1 }} />

            {hover && !coluna.sistema && (
              <>
                <BotaoIcone titulo="Renomear" onClick={() => setEditando(true)}>
                  ✎
                </BotaoIcone>
                {/* Confirmar saiu do proprio botao e virou aviso no canto: dois
                    cliques no mesmo ✕ nao anunciavam o segundo passo, e a
                    leitura certa da tela era "cliquei e nada aconteceu". */}
                <BotaoIcone
                  titulo="Excluir"
                  onClick={() =>
                    confirmar(
                      `Excluir a coluna "${coluna.descricao}"?`,
                      "Excluir",
                      () => void excluir(),
                      quantidade > 0
                        ? `Ela tem ${quantidade} ticket(s) — mova-os antes.`
                        : "A coluna some do quadro. Os tickets não são afetados.",
                    )
                  }
                >
                  ✕
                </BotaoIcone>
              </>
            )}

            {/* Numero solto, cinza, encostado na direita. Pastilha e cor aqui
                competiriam com as contagens do card sem dizer nada a mais — a
                posicao ja identifica o que o numero conta. */}
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-medium)",
                color: "var(--text-tertiary)",
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {quantidade}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function BotaoIcone({
  children,
  titulo,
  perigo,
  onClick,
}: {
  children: React.ReactNode;
  titulo: string;
  perigo?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      style={{
        width: 20,
        height: 20,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-xs)",
        border: "none",
        background: perigo ? "var(--danger-bg)" : "transparent",
        color: perigo ? "var(--danger-text)" : "var(--text-tertiary)",
        fontSize: 11,
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Card do quadro.
 *
 * O rodape responde as tres perguntas na ordem em que elas aparecem: quanto
 * trabalho tem (servicos), quanto ja virou cobranca (contas) e quanto vale
 * (total, encostado na direita e alinhado entre os cards).
 *
 * As contagens sao pastilhas tingidas, nao texto cinza: a cor e o que separa
 * "3 servicos" de "2 contas" sem obrigar a ler o icone.
 */
function CardTicket({
  ticket,
  aoAbrir,
  aoArrastar,
  aoSoltar,
}: {
  ticket: TicketNoQuadro;
  aoAbrir: (id: number) => void;
  aoArrastar: (id: number) => void;
  aoSoltar: () => void;
}) {
  const cancelada = ticket.cancelada;

  return (
    /*
     * Moldura de 2px na cor da coluna, envolvendo o cartao branco.
     *
     * Ela existe para dar lugar ao rodape: contagens e valor saem de DENTRO do
     * branco e passam a viver na faixa entre o cartao e a borda. O branco fica
     * so com quem o ticket e; o resto e leitura de apoio, e o degrau de cor diz
     * isso sem precisar de linha divisoria.
     */
    <div
      draggable={!cancelada}
      onDragStart={() => aoArrastar(ticket.id)}
      onDragEnd={aoSoltar}
      onClick={() => aoAbrir(ticket.id)}
      style={{
        background: "var(--kanban-card-moldura)",
        borderRadius: "var(--radius-md)",
        padding: 2,
        // Sombra fraca de base para o card se descolar da coluna sem borda; no
        // hover ela abre um pouco, que e o que sinaliza que da para arrastar.
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.09)",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        transition: "box-shadow 120ms var(--ease), transform 100ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 5px 14px rgba(0, 0, 0, 0.13)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.09)";
        e.currentTarget.style.transform = "none";
      }}
    >
      <div
        style={{
          // Cancelado fica cinza escuro no lugar em que parou — nao vira
          // coluna, porque cancelar nao apaga a etapa em que o ticket estava.
          background: cancelada ? "rgba(0, 0, 0, 0.045)" : "var(--surface)",
          color: cancelada ? "var(--text-tertiary)" : undefined,
          borderRadius: "var(--radius-sm)",
          padding: "10px 12px 11px",
        }}
      >
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
          {/* Numero como etiqueta, sem "#": a moldura ja o separa do resto, e o
              simbolo era ruido num campo que so tem numero. */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 17,
              padding: "0 6px",
              borderRadius: "var(--radius-xs)",
              background: cancelada ? "rgba(0, 0, 0, 0.05)" : "var(--primary-subtle)",
              color: cancelada ? "var(--text-tertiary)" : "var(--primary)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
            }}
          >
            {ticket.numero}
          </span>

          {cancelada ? (
            <span style={{ color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>
              CANCELADO
            </span>
          ) : (
            // Periodo, nao a data de encerramento: o card responde "quando isso
            // aconteceu", e o dia exato nao muda decisao nenhuma aqui.
            <span
              style={{
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontVariantNumeric: "normal",
              }}
            >
              {periodoEmMeses(ticket.inicio, ticket.fim)}
            </span>
          )}
        </div>

        <div
          style={{
            // Duas linhas em vez de reticencias: razao social cortada em
            // "COMERCIO DE MATERIAIS ELET…" nao identifica ninguem.
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-medium)",
            lineHeight: 1.32,
            letterSpacing: "var(--tracking-normal)",
            marginTop: 7,
            textDecoration: cancelada ? "line-through" : undefined,
          }}
        >
          {ticket.clienteNome ?? "—"}
        </div>

        {ticket.centroCustoNome && (
          <div
            style={{
              marginTop: 4,
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              letterSpacing: "var(--tracking-normal)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ticket.centroCustoNome}
          </div>
        )}

        <Assunto ticket={ticket} />
      </div>

      {/* Faixa da moldura: contagens a esquerda, valor a direita. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px 4px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Contagem
            icone={<IconeServico />}
            valor={ticket.qtdServicos}
            titulo={`${ticket.qtdServicos} serviço(s)`}
          />
          {/* Conta a receber so aparece quando existe: um "0" ali anunciaria
              uma cobranca que nunca foi emitida. */}
          {ticket.qtdFaturas > 0 && (
            <Contagem
              icone={<IconeFatura />}
              valor={ticket.qtdFaturas}
              titulo={`${ticket.qtdFaturas} conta(s) a receber`}
            />
          )}
        </div>

        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-normal)",
            color: cancelada ? "var(--text-tertiary)" : "var(--text-primary)",
          }}
        >
          {formatarSemSimbolo(ticket.total)}
        </span>
      </div>
    </div>
  );
}

/**
 * Segunda linha do card: o assunto do ticket.
 *
 * Nos 151 migrados o titulo e SO O NUMERO DA FATURA DE ORIGEM — o ticket 155
 * tem titulo "214". Solto num card, esse numero nao diz nada e ainda concorre
 * com o numero do proprio ticket. Por isso titulo puramente numerico conta como
 * ausente.
 *
 * A comparacao NAO pode ser com `ticket.id`: os dois numeros sao diferentes, e
 * a checagem passa batido.
 *
 * Sem titulo, a linha simplesmente nao existe. Preencher com data rotulada so
 * trocava um dado sem sentido por outro.
 */
function Assunto({ ticket }: { ticket: TicketNoQuadro }) {
  const texto = ticket.titulo.trim();
  if (texto === "" || /^\d+$/.test(texto)) return null;

  return (
    <div
      style={{
        marginTop: 4,
        fontSize: "var(--text-sm)",
        color: "var(--text-tertiary)",
        letterSpacing: "var(--tracking-normal)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {texto}
    </div>
  );
}

/**
 * Icone e contagem, em cinza.
 *
 * Sem cor: elas dividem a faixa da moldura com o VALOR, e valor e o unico
 * numero do card que merece peso. Coloridas, as duas contagens chamavam mais
 * atencao que o dinheiro.
 */
function Contagem({
  icone,
  valor,
  titulo,
}: {
  icone: React.ReactNode;
  valor: number;
  titulo: string;
}) {
  return (
    <span
      title={titulo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "var(--text-tertiary)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        lineHeight: 1,
      }}
    >
      {icone}
      {valor}
    </span>
  );
}
