"use client";

import { useCallback, useEffect, useState } from "react";
import { BotaoHistorico, Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import {
  Badge,
  Button,
  CampoBloqueado,
  Field,
  PanelTabs,
} from "@/components/ui/kit";
import { TicketDrawer } from "../tickets/ticket-drawer";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";

/**
 * Detalhe da conta a receber.
 *
 * Ordem herdada da tela `faturas_detahes` do FlutterFlow: primeiro quanto ja
 * entrou e quanto falta, depois de quem e a fatura, e so entao o detalhamento.
 *
 * Tickets e parcelas ficam em abas. No lugar da lista de servicos vem a de
 * TICKETS: no modelo novo o servico vive no ticket, e a conta a receber e
 * composta por valor de um ou mais deles. Clicar num ticket abre o drawer dele
 * — o detalhe do servico esta la, nao aqui.
 *
 * Os campos aparecem como campo de texto bloqueado, com cadeado, e nao como
 * texto solto: a tela ainda nao edita nada, e o cadeado explica por que.
 */


type Parcela = {
  id: number;
  numero: number;
  vencimento: string | null;
  valor: number;
  acrescimo: number;
  desconto: number;
  total: number;
  pago: boolean;
  nfs: string | null;
  boleto: string | null;
};

type TicketDaFatura = {
  ticketId: number;
  numero: number;
  valor: number;
  titulo: string;
  status: string;
  clienteNome: string | null;
  encerradoEm: string | null;
};

type Fatura = {
  id: number;
  numero: number;
  clienteNome: string | null;
  apuracaoInicio: string | null;
  apuracaoFim: string | null;
  situacao: string;
  total: number;
  observacoes: string | null;
  rodape: string | null;
  parcelas: Parcela[];
  tickets: TicketDaFatura[];
  historico: {
    criadoEm: string | null;
    criadoPor: string | null;
    editadoEm: string | null;
    editadoPor: string | null;
  };
};

export function FaturaDrawer({ faturaId, onClose }: { faturaId: number | null; onClose: () => void }) {
  // `key` remonta a cada fatura: o estado nasce vazio sozinho, sem limpar a mao
  // dentro de um efeito, e sem mostrar o registro anterior enquanto carrega.
  return faturaId == null ? null : (
    <Conteudo key={faturaId} faturaId={faturaId} onClose={onClose} />
  );
}

function Conteudo({ faturaId, onClose }: { faturaId: number; onClose: () => void }) {
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"tickets" | "parcelas">("tickets");
  // Ticket aberto por cima da conta: o drawer empilha, o de tras nao fecha.
  const [ticketAberto, setTicketAberto] = useState<number | null>(null);
  const { avisar, confirmar } = useAvisos();

  async function desvincularTicket(ticketId: number) {
    const r = await fetch(`/api/v1/faturas/${faturaId}/tickets/${ticketId}`, {
      method: "DELETE",
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível remover o ticket");
      return;
    }

    // Conta apagada: nao ha o que recarregar, e o drawer fecha.
    if (dados?.data?.contaExcluida) {
      avisar("sucesso", "Conta a receber excluída", "Era o único ticket dela.");
      onClose();
      return;
    }
    recarregar();
  }

  /*
   * Recarrega o registro inteiro depois de anexar ou remover documento.
   *
   * O endpoint ja devolve a conta atualizada, mas buscar de novo mantem UM
   * caminho de leitura: com a tela remendando o proprio estado a partir da
   * resposta de cada acao, a divergencia aparece na terceira acao seguida.
   */
  const recarregar = useCallback(() => {
    fetch(`/api/v1/faturas/${faturaId}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar a fatura");
        setFatura(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error) setErro(e.message);
      });
  }, [faturaId]);

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/faturas/${faturaId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar a fatura");
        setFatura(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [faturaId]);

  // O recebido vem das parcelas baixadas, nao de um campo do cabecalho: e a
  // parcela que carrega a verdade sobre o pagamento.
  const pago = fatura ? fatura.parcelas.filter((p) => p.pago).reduce((s, p) => s + p.total, 0) : 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={fatura ? `Conta a receber ${fatura.numero}` : "Conta a receber"}
      headerExtra={
        fatura ? (
          <BotaoHistorico
            criadoEm={fatura.historico.criadoEm}
            criadoPor={fatura.historico.criadoPor}
            editadoEm={fatura.historico.editadoEm}
            editadoPor={fatura.historico.editadoPor}
          />
        ) : null
      }
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Os totais vivem no rodape, na linha do botao: e o ultimo lugar em
              que a pessoa olha antes de agir, e no topo eles empurravam para
              baixo os campos que se le primeiro. */}
          {fatura && <Totais total={fatura.total} pago={pago} />}

          <span style={{ flex: 1 }} />
          <Button size="sm" variant="primary" disabled title="Ainda não implementado">
            Receber
          </Button>
        </div>
      }
    >
      {erro && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger-text)",
            fontSize: "var(--text-base)",
          }}
        >
          {erro}
        </div>
      )}

      {!fatura && !erro && <Esqueleto />}

      {fatura && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 18 }}>
            <Field label="Cliente">
              <CampoBloqueado valor={fatura.clienteNome ?? "—"} />
            </Field>

            <Field label="Apuração">
              <CampoBloqueado valor={periodo(fatura.apuracaoInicio, fatura.apuracaoFim)} />
            </Field>

            <Field label="Situação">
              <CampoBloqueado valor={fatura.situacao} />
            </Field>

            {fatura.observacoes && (
              <Field label="Observações">
                <CampoBloqueado valor={fatura.observacoes} multilinha />
              </Field>
            )}
          </div>

          <PanelTabs
            tabs={[`Tickets (${fatura.tickets.length})`, `Parcelas (${fatura.parcelas.length})`]}
            active={
              aba === "tickets"
                ? `Tickets (${fatura.tickets.length})`
                : `Parcelas (${fatura.parcelas.length})`
            }
            onChange={(t) => setAba(t.startsWith("Tickets") ? "tickets" : "parcelas")}
          />

          {aba === "tickets" ? (
            <Tabela
              cabecalho={["Ticket", "Encerrado", "Situação", "Valor", "Ações"]}
              vazio="Nenhum ticket vinculado a esta conta."
              linhas={fatura.tickets.map((t) => [
                <span key="t" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t.numero}
                  {t.titulo && t.titulo !== String(t.numero) && (
                    <span style={{ color: "var(--text-tertiary)" }}> · {t.titulo}</span>
                  )}
                </span>,
                t.encerradoEm ? paraFormatoBR(t.encerradoEm as DataISO) : "—",
                <Badge key="s" tom="neutral">
                  {t.status}
                </Badge>,
                formatarSemSimbolo(t.valor as Centavos),
                <span key="a" style={{ display: "inline-flex", gap: 2 }}>
                  <BotaoDeLinha
                    rotulo={`Abrir ticket ${t.numero}`}
                    onClick={() => setTicketAberto(t.ticketId)}
                  >
                    <path d="M4 3h6l3 3v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                    <path d="M10 3v3h3" />
                  </BotaoDeLinha>

                  {/* Tirar o ticket devolve o saldo dele. Sendo o unico, a conta
                      inteira vai junto: conta sem origem nao cobra nada. */}
                  <BotaoDeLinha
                    rotulo="Remover desta conta"
                    perigo
                    onClick={() =>
                      confirmar(
                        `Remover o ticket ${t.numero} desta conta?`,
                        "Remover",
                        () => desvincularTicket(t.ticketId),
                        fatura.tickets.length === 1
                          ? "É o único ticket, então a conta a receber será excluída."
                          : "O saldo dele volta a ficar disponível para cobrar.",
                      )
                    }
                  >
                    <path d="M12 4L4 12M4 4l8 8" />
                  </BotaoDeLinha>
                </span>,
              ])}
            />
          ) : (
            <Tabela
              cabecalho={["#", "Vencimento", "Valor", "Situação", "Documentos", "Ações"]}
              vazio="Nenhuma parcela gerada."
              linhas={fatura.parcelas.map((p) => [
                p.numero,
                <Vencimento key="v" data={p.vencimento} pago={p.pago} />,
                formatarSemSimbolo(p.total as Centavos),
                <Badge key="s" tom={p.pago ? "success" : "info"}>
                  {p.pago ? "PAGA" : "ABERTA"}
                </Badge>,
                <Documentos
                  key="d"
                  faturaId={fatura.id}
                  parcelaId={p.id}
                  boleto={p.boleto}
                  nfs={p.nfs}
                  aoMudar={recarregar}
                />,
                <span key="a" style={{ display: "inline-flex", gap: 2 }}>
                  <AnexarDocumento
                    tipo="nfs"
                    rotulo="Anexar nota fiscal"
                    faturaId={fatura.id}
                    parcelaId={p.id}
                    bloqueado={fatura.situacao === "CANCELADA"}
                    aoMudar={recarregar}
                  >
                    <path d="M4 2h5l3 3v9H4z" />
                    <path d="M6 8h4M6 11h3" />
                  </AnexarDocumento>

                  <AnexarDocumento
                    tipo="boleto"
                    rotulo="Anexar boleto"
                    faturaId={fatura.id}
                    parcelaId={p.id}
                    bloqueado={fatura.situacao === "CANCELADA"}
                    aoMudar={recarregar}
                  >
                    <path d="M2 3v10M5 3v10M8 3v10M11 3v10M14 3v10" />
                  </AnexarDocumento>

                  <BotaoEnviar
                    faturaId={fatura.id}
                    parcelaId={p.id}
                    temDocumento={Boolean(p.nfs || p.boleto)}
                    bloqueado={fatura.situacao === "CANCELADA" || p.pago}
                  />
                </span>,
              ])}
            />
          )}
        </>
      )}

      <TicketDrawer ticketId={ticketAberto} somenteLeitura onClose={() => setTicketAberto(null)} />
    </Drawer>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

function periodo(de: string | null, ate: string | null): string {
  if (!de) return "—";
  const fim = ate ?? de;
  return fim !== de
    ? `${paraFormatoBR(de as DataISO)} a ${paraFormatoBR(fim as DataISO)}`
    : paraFormatoBR(de as DataISO);
}


function Vencimento({ data, pago }: { data: string | null; pago: boolean }) {
  if (!data) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;

  const atrasado = !pago && data < hoje();
  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        color: atrasado ? "var(--danger-text)" : undefined,
        fontWeight: atrasado ? "var(--fw-medium)" : undefined,
      }}
    >
      {paraFormatoBR(data as DataISO)}
    </span>
  );
}

/**
 * As bandeiras dos documentos ja anexados.
 *
 * Cada uma e um par: o rotulo baixa, o ✕ ao lado remove. Dois alvos dentro da
 * mesma moldura, e nao dois controles soltos — assim o ✕ pertence visivelmente
 * AQUELE documento, e nao a linha inteira.
 *
 * Anexar mora na coluna de acoes: e um gesto de escrita, e misturado as
 * bandeiras fazia a coluna significar "o que existe" e "o que da para fazer" ao
 * mesmo tempo.
 */
function Documentos({
  faturaId,
  parcelaId,
  boleto,
  nfs,
  aoMudar,
}: {
  faturaId: number;
  parcelaId: number;
  boleto: string | null;
  nfs: string | null;
  aoMudar: () => void;
}) {
  if (!nfs && !boleto) return <span style={{ color: "var(--text-disabled)" }}>—</span>;

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {nfs && (
        <Bandeira
          rotulo="NF"
          tipo="nfs"
          faturaId={faturaId}
          parcelaId={parcelaId}
          aoMudar={aoMudar}
        />
      )}
      {boleto && (
        <Bandeira
          rotulo="Boleto"
          tipo="boleto"
          faturaId={faturaId}
          parcelaId={parcelaId}
          aoMudar={aoMudar}
        />
      )}
    </span>
  );
}

function Bandeira({
  rotulo,
  tipo,
  faturaId,
  parcelaId,
  aoMudar,
}: {
  rotulo: string;
  tipo: "nfs" | "boleto";
  faturaId: number;
  parcelaId: number;
  aoMudar: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const url = `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/documento?tipo=${tipo}`;

  async function remover() {
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível remover");
      return;
    }
    aoMudar();
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 19,
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--primary-border)",
        background: "var(--primary-subtle)",
        overflow: "hidden",
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        title={`Baixar ${rotulo}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "0 5px 0 6px",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--fw-medium)",
          color: "var(--primary)",
          textDecoration: "none",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
        </svg>
        {rotulo}
      </a>

      <button
        type="button"
        title={`Remover ${rotulo}`}
        aria-label={`Remover ${rotulo}`}
        onClick={() =>
          confirmar(`Remover ${rotulo} desta parcela?`, "Remover", remover, "O arquivo é apagado.")
        }
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 16,
          height: 19,
          border: "none",
          borderLeft: "1px solid var(--primary-border)",
          background: "transparent",
          padding: 0,
          color: "var(--primary)",
          cursor: "pointer",
          fontSize: 9,
        }}
      >
        ✕
      </button>
    </span>
  );
}

/** Anexar um documento. Ícone na coluna de ações; o arquivo entra pelo input. */
function AnexarDocumento({
  tipo,
  rotulo,
  faturaId,
  parcelaId,
  bloqueado,
  aoMudar,
  children,
}: {
  tipo: "nfs" | "boleto";
  rotulo: string;
  faturaId: number;
  parcelaId: number;
  bloqueado: boolean;
  aoMudar: () => void;
  children: React.ReactNode;
}) {
  const { avisar } = useAvisos();
  const [enviando, setEnviando] = useState(false);

  async function subir(arquivo: File) {
    const corpo = new FormData();
    corpo.append("arquivo", arquivo);

    setEnviando(true);
    const r = await fetch(
      `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/documento?tipo=${tipo}`,
      { method: "POST", body: corpo },
    );
    const dados = await r.json().catch(() => null);
    setEnviando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar o arquivo");
      return;
    }
    aoMudar();
  }

  if (bloqueado) return null;

  return (
    <label
      title={rotulo}
      aria-label={rotulo}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 22,
        height: 22,
        borderRadius: "var(--radius-sm)",
        color: "var(--text-secondary)",
        cursor: enviando ? "wait" : "pointer",
        opacity: enviando ? 0.4 : 1,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <input
        type="file"
        accept="application/pdf,image/*"
        disabled={enviando}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          // Zerado para que escolher o MESMO arquivo de novo, depois de um erro,
          // ainda dispare o `change`.
          e.target.value = "";
          if (arquivo) void subir(arquivo);
        }}
        style={{ display: "none" }}
      />
    </label>
  );
}

/** Botão de ícone dentro da linha da tabela. */
function BotaoDeLinha({
  rotulo,
  perigo,
  onClick,
  children,
}: {
  rotulo: string;
  perigo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={(e) => {
        // A linha inteira pode ter clique proprio; a acao nao dispara os dois.
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 22,
        height: 22,
        border: "none",
        background: "none",
        padding: 0,
        color: perigo ? "var(--danger)" : "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

/**
 * Total no rodape, com o resto atras de um clique.
 *
 * Total e a pergunta de sempre; pago e saldo so importam quando ha pagamento
 * pela metade. Os tres sempre visiveis faziam a linha do botao competir com o
 * botao.
 */
function Totais({ total, pago }: { total: number; pago: number }) {
  const [aberto, setAberto] = useState(false);
  const saldo = total - pago;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font)",
        }}
      >
        <span className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
          Total
        </span>
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-semi)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-primary)",
          }}
        >
          {formatarSemSimbolo(total as Centavos)}
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: aberto ? "rotate(180deg)" : undefined,
            transition: "transform var(--dur) var(--ease)",
          }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {aberto && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            minWidth: 190,
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-md)",
            zIndex: 5,
          }}
        >
          <Linha rotulo="Recebido" valor={pago} cor="var(--credito)" />
          <Linha rotulo="Em aberto" valor={saldo} />
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "3px 0",
        fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{rotulo}</span>
      <span style={{ fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums", color: cor }}>
        {formatarSemSimbolo(valor as Centavos)}
      </span>
    </div>
  );
}

/**
 * Manda a parcela para o cliente.
 *
 * Desabilitado sem documento: o e-mail seria um aviso de cobrança sem cobrança —
 * o cliente abre, não tem o que pagar, e liga perguntando.
 */
function BotaoEnviar({
  faturaId,
  parcelaId,
  temDocumento,
  bloqueado,
}: {
  faturaId: number;
  parcelaId: number;
  temDocumento: boolean;
  bloqueado: boolean;
}) {
  const { avisar, confirmar } = useAvisos();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    const r = await fetch(`/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const dados = await r.json().catch(() => null);
    setEnviando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar");
      return;
    }
    avisar("sucesso", "E-mail enviado", `Para ${dados.data.para}.`);
  }

  const impedido = bloqueado || !temDocumento;

  return (
    <button
      type="button"
      disabled={impedido || enviando}
      title={
        bloqueado
          ? "Parcela paga ou conta cancelada"
          : !temDocumento
            ? "Anexe a nota fiscal ou o boleto antes de enviar"
            : "Enviar por e-mail ao cliente"
      }
      onClick={() =>
        confirmar(
          "Enviar esta parcela ao cliente?",
          "Enviar",
          enviar,
          "O e-mail vai com os documentos anexados.",
        )
      }
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 22,
        height: 22,
        border: "none",
        background: "none",
        padding: 0,
        color: impedido ? "var(--text-disabled)" : "var(--text-secondary)",
        cursor: impedido ? "not-allowed" : "pointer",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </button>
  );
}

/**
 * Tabela do drawer. Tudo alinhado a ESQUERDA, inclusive numero.
 *
 * Alinhamento por coluna deixava cada tabela com um desenho: valor a direita
 * aqui, situacao ao centro ali, e o olho refazia o percurso a cada aba. Com uma
 * regra so, a leitura comeca sempre na mesma margem.
 */
function Tabela({
  cabecalho,
  linhas,
  vazio,
  aoClicarLinha,
}: {
  cabecalho: string[];
  linhas: React.ReactNode[][];
  vazio: string;
  aoClicarLinha?: (indice: number) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>
            {cabecalho.map((c) => (
              <th
                key={c}
                className="rotulo"
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td
                colSpan={cabecalho.length}
                style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-tertiary)" }}
              >
                {vazio}
              </td>
            </tr>
          )}
          {linhas.map((celulas, li) => (
            <tr
              key={li}
              onClick={aoClicarLinha ? () => aoClicarLinha(li) : undefined}
              style={{
                borderTop: li === 0 ? undefined : "1px solid var(--border)",
                cursor: aoClicarLinha ? "pointer" : undefined,
              }}
              onMouseEnter={(e) => {
                if (aoClicarLinha) e.currentTarget.style.background = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (aoClicarLinha) e.currentTarget.style.background = "transparent";
              }}
            >
              {celulas.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Esqueleto() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[70, 90, 55, 100, 80].map((largura, i) => (
        <div
          key={i}
          className="sk"
          style={{
            height: 14,
            width: `${largura}%`,
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-3)",
          }}
        />
      ))}
    </div>
  );
}

