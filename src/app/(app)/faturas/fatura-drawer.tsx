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
  ProgressoValor,
} from "@/components/ui/kit";
import { TicketDrawer } from "../tickets/ticket-drawer";
import { Icon } from "@/components/layout/icones";
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

type Item = {
  id: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  acrescimo: number;
  desconto: number;
  total: number;
  incluir: boolean;
};

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
  itens: Item[];
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <Button size="sm" disabled title="Ainda não implementado">
            Enviar por e-mail
          </Button>
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
          <ProgressoValor total={fatura.total} pago={pago} />

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
              cabecalho={["Ticket", "Encerrado", "Situação", "Valor"]}
              alinhamentos={["left", "left", "center", "right"]}
              vazio="Nenhum ticket vinculado a esta conta."
              aoClicarLinha={(i) => setTicketAberto(fatura.tickets[i].ticketId)}
              linhas={fatura.tickets.map((t) => [
                // Icone de ticket na frente: aqui convivem numero de conta e
                // numero de ticket, e o simbolo separa mais rapido que o rotulo
                // da coluna.
                <span
                  key="t"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <Icon name="ticket" size={13} color="var(--text-tertiary)" />
                  {t.numero}
                  {t.titulo && t.titulo !== String(t.numero) && (
                    <span style={{ color: "var(--text-tertiary)" }}> · {t.titulo}</span>
                  )}
                </span>,
                t.encerradoEm ? paraFormatoBR(t.encerradoEm as DataISO) : "—",
                <Badge key="s" tom="neutral">
                  {t.status}
                </Badge>,
                <strong key="v">{formatarSemSimbolo(t.valor as Centavos)}</strong>,
              ])}
            />
          ) : (
            <Tabela
              cabecalho={["#", "Vencimento", "Valor", "Situação", "Documentos", ""]}
              alinhamentos={["center", "left", "right", "center", "center", "center"]}
              vazio="Nenhuma parcela gerada."
              linhas={fatura.parcelas.map((p) => [
                p.numero,
                <Vencimento key="v" data={p.vencimento} pago={p.pago} />,
                formatarSemSimbolo(p.total as Centavos),
                <Badge key="s" tom={p.pago ? "success" : "info"}>
                  {p.pago ? "PAGA" : "ABERTA"}
                </Badge>,
                <Documentos
                  key="a"
                  faturaId={fatura.id}
                  parcelaId={p.id}
                  boleto={p.boleto}
                  nfs={p.nfs}
                  bloqueado={fatura.situacao === "CANCELADA"}
                  aoMudar={recarregar}
                />,
                <BotaoEnviar
                  key="e"
                  faturaId={fatura.id}
                  parcelaId={p.id}
                  temDocumento={Boolean(p.nfs || p.boleto)}
                  bloqueado={fatura.situacao === "CANCELADA" || p.pago}
                />,
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
 * Nota fiscal e boleto da parcela.
 *
 * Um botao por tipo, sempre os dois: com o botao aparecendo so quando o arquivo
 * ja existe, nao havia por onde ENVIAR o primeiro. Com arquivo, o botao abre; o
 * ✕ ao lado troca ou remove.
 *
 * Abrir e um link normal para a rota, que redireciona para uma URL assinada de
 * uma hora. Guardar a URL na tela criaria uma copia que expira sem avisar.
 */
function Documentos({
  faturaId,
  parcelaId,
  boleto,
  nfs,
  bloqueado,
  aoMudar,
}: {
  faturaId: number;
  parcelaId: number;
  boleto: string | null;
  nfs: string | null;
  bloqueado: boolean;
  aoMudar: () => void;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <Documento
        rotulo="NF"
        tipo="nfs"
        valor={nfs}
        faturaId={faturaId}
        parcelaId={parcelaId}
        bloqueado={bloqueado}
        aoMudar={aoMudar}
      />
      <Documento
        rotulo="Boleto"
        tipo="boleto"
        valor={boleto}
        faturaId={faturaId}
        parcelaId={parcelaId}
        bloqueado={bloqueado}
        aoMudar={aoMudar}
      />
    </span>
  );
}

function Documento({
  rotulo,
  tipo,
  valor,
  faturaId,
  parcelaId,
  bloqueado,
  aoMudar,
}: {
  rotulo: string;
  tipo: "nfs" | "boleto";
  valor: string | null;
  faturaId: number;
  parcelaId: number;
  bloqueado: boolean;
  aoMudar: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const [enviando, setEnviando] = useState(false);
  const url = `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/documento?tipo=${tipo}`;

  async function subir(arquivo: File) {
    const corpo = new FormData();
    corpo.append("arquivo", arquivo);

    setEnviando(true);
    const r = await fetch(url, { method: "POST", body: corpo });
    const dados = await r.json().catch(() => null);
    setEnviando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar o arquivo");
      return;
    }
    avisar("sucesso", `${rotulo} anexada`);
    aoMudar();
  }

  async function remover() {
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível remover");
      return;
    }
    aoMudar();
  }

  if (valor) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--fw-medium)",
            color: "var(--primary)",
            border: "1px solid var(--primary-border)",
            background: "var(--primary-subtle)",
            borderRadius: "var(--radius-xs)",
            padding: "1px 6px",
            textDecoration: "none",
          }}
        >
          {rotulo}
        </a>
        {!bloqueado && (
          <button
            type="button"
            title={`Remover ${rotulo}`}
            aria-label={`Remover ${rotulo}`}
            onClick={() =>
              confirmar(`Remover ${rotulo} desta parcela?`, "Remover", remover, "O arquivo é apagado.")
            }
            style={{
              width: 14,
              height: 14,
              border: "none",
              background: "none",
              padding: 0,
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: 10,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </span>
    );
  }

  if (bloqueado) return <span style={{ color: "var(--text-disabled)" }}>—</span>;

  return (
    <label
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-medium)",
        color: "var(--text-tertiary)",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-xs)",
        padding: "1px 6px",
        cursor: enviando ? "wait" : "pointer",
        opacity: enviando ? 0.5 : 1,
      }}
    >
      {enviando ? "…" : `+ ${rotulo}`}
      <input
        type="file"
        accept="application/pdf,image/*"
        disabled={enviando}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          // O input é zerado para que escolher o MESMO arquivo de novo, depois
          // de um erro, ainda dispare o `change`.
          e.target.value = "";
          if (arquivo) void subir(arquivo);
        }}
        style={{ display: "none" }}
      />
    </label>
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

function Tabela({
  cabecalho,
  alinhamentos,
  linhas,
  vazio,
  aoClicarLinha,
}: {
  cabecalho: string[];
  alinhamentos: ("left" | "center" | "right")[];
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
            {cabecalho.map((c, i) => (
              <th
                key={c}
                className="rotulo"
                style={{
                  height: 32,
                  padding: "0 12px",
                  textAlign: alinhamentos[i],
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
                    textAlign: alinhamentos[ci],
                    fontVariantNumeric: alinhamentos[ci] === "right" ? "tabular-nums" : undefined,
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

