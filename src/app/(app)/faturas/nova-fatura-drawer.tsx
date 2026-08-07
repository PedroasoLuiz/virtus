"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoNumerico,
  EmptyRow,
  Field,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";

/**
 * Nova conta a receber, a partir dos tickets em aberto.
 *
 * O caminho do dinheiro no VPay e ticket -> conta a receber -> baixa. Esta tela
 * e o meio: escolhe o cliente, mostra o que ele tem em aberto, e vira cobranca.
 *
 * O valor de cada ticket e EDITAVEL: faturamento parcial e comum — entrega-se
 * metade do escopo e cobra-se metade. O que sobra continua no saldo do ticket,
 * disponivel para a proxima.
 */

type TicketFaturavel = {
  id: number;
  numero: number;
  titulo: string;
  clienteNome: string | null;
  inicio: string | null;
  fim: string | null;
  saldo: number;
  total: number;
};

type OpcaoCliente = { id: number; nome: string };

export function NovaFaturaDrawer({
  clientes,
  onClose,
}: {
  clientes: OpcaoCliente[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [clienteId, setClienteId] = useState("");
  const [tickets, setTickets] = useState<TicketFaturavel[] | null>(null);
  /** Quanto tirar de cada ticket. Ausente = não entra nesta conta. */
  const [valores, setValores] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);

  const [parcelas, setParcelas] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState<string>(hoje());
  const [intervalo, setIntervalo] = useState(30);
  const [observacoes, setObservacoes] = useState("");
  const [emitir, setEmitir] = useState(true);

  /*
   * O efeito so BUSCA; quem limpa a lista e o proprio `onChange` do cliente.
   *
   * Limpar aqui seria escrever estado no meio do render — o React reclama com
   * razao: o efeito rodaria, marcaria a tela como suja e pediria outro render
   * antes de pintar o primeiro.
   */
  useEffect(() => {
    if (!clienteId) return;

    const controle = new AbortController();

    fetch(`/api/v1/tickets/faturaveis?clienteId=${clienteId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar os tickets");
        setTickets(corpo.data as TicketFaturavel[]);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") {
          avisar("erro", e.message);
          setTickets([]);
        }
      });

    return () => controle.abort();
  }, [clienteId, avisar]);

  const escolhidos = useMemo(
    () => (tickets ?? []).filter((t) => (valores[t.id] ?? 0) > 0),
    [tickets, valores],
  );

  const total = escolhidos.reduce((soma, t) => soma + (valores[t.id] ?? 0), 0) as Centavos;

  /*
   * A competência sai do período dos tickets escolhidos, não de um campo.
   *
   * É a mesma pergunta respondida duas vezes: quem escolheu os tickets de julho
   * já disse qual é a competência, e digitá-la de novo só cria a chance de
   * divergir do que está sendo cobrado.
   */
  const datas = escolhidos.flatMap((t) => [t.inicio, t.fim]).filter(Boolean) as string[];
  const apuracaoInicio = datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : hoje();
  const apuracaoFim = datas.length ? datas.reduce((a, b) => (a > b ? a : b)) : hoje();

  function alternar(t: TicketFaturavel) {
    setValores((v) => {
      const copia = { ...v };
      // Marcar traz o saldo inteiro: é o caso comum. Quem cobra parcial ajusta
      // o número ao lado.
      if (copia[t.id]) delete copia[t.id];
      else copia[t.id] = t.saldo;
      return copia;
    });
  }

  async function criar() {
    setSalvando(true);

    const r = await fetch("/api/v1/faturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: Number(clienteId),
        apuracaoInicio,
        apuracaoFim,
        /*
         * Só as origens: quanto sai de cada ticket.
         *
         * A conta a receber não tem itens próprios. O serviço vive no ticket, e
         * copiá-lo para cá criaria um segundo detalhamento que divergiria no
         * primeiro ajuste — e quebraria o faturamento parcial, onde o valor
         * cobrado não é o do serviço.
         */
        origens: escolhidos.map((t) => ({ ticketId: t.id, valor: valores[t.id] })),
        parcelamento: {
          quantidade: parcelas,
          primeiroVencimento,
          intervaloDias: intervalo,
        },
        observacoes: observacoes.trim() || null,
        emitir,
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível criar a conta",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    avisar(
      "sucesso",
      `Conta a receber criada`,
      `${dados.data.parcelas} parcela(s), ${formatarSemSimbolo(dados.data.total)}.`,
    );
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Nova conta a receber"
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
              {escolhidos.length} ticket{escolhidos.length === 1 ? "" : "s"}
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

        </div>
      }
      acoes={
        <Button
          size="xs"
          variant="primary"
          disabled={salvando || escolhidos.length === 0}
          onClick={criar}
        >
          {salvando ? "Criando…" : emitir ? "Criar e emitir" : "Criar rascunho"}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Field label="Cliente" required>
          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              // Nada marcado ao trocar de cliente: valor escolhido para um
              // cliente nao pode sobreviver ao outro.
              setTickets(null);
              setValores({});
            }}
            style={selectStyle}
          >
            <option value="">Escolher…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {clienteId && (
        <div style={{ marginTop: 16 }}>
          <div className="rotulo" style={{ fontSize: "var(--text-xs)", marginBottom: 8 }}>
            Tickets em aberto
          </div>

          <div
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <TableArea minWidth={0}>
              <TableHead>
                <Th minWidth={70}>Ticket</Th>
                <Th>Período</Th>
                <Th align="right" minWidth={90}>
                  Em aberto
                </Th>
                <Th align="right" minWidth={120}>
                  Cobrar
                </Th>
              </TableHead>
              <tbody>
                {tickets == null && <EmptyRow colSpan={4} message="Carregando…" />}
                {tickets != null && tickets.length === 0 && (
                  <EmptyRow
                    colSpan={4}
                    message="Nenhum ticket em aberto para este cliente."
                  />
                )}

                {(tickets ?? []).map((t, n) => {
                  const escolhido = (valores[t.id] ?? 0) > 0;

                  return (
                    <Tr key={t.id} delay={n * 12}>
                      <Td>
                        <span
                          onClick={() => alternar(t)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                          }}
                        >
                          <Caixa marcada={escolhido} />
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{t.numero}</span>
                        </span>
                      </Td>
                      <Td style={{ color: "var(--text-tertiary)" }}>
                        {t.inicio || t.fim
                          ? periodoEmMeses(t.inicio as DataISO, t.fim as DataISO)
                          : "—"}
                      </Td>
                      <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {formatarSemSimbolo(t.saldo as Centavos)}
                      </Td>
                      <Td style={{ padding: "0 8px 0 16px" }}>
                        {/* Editável: faturamento parcial é comum, e o que sobra
                            continua no saldo do ticket para a próxima. */}
                        {escolhido ? (
                          <CampoNumerico
                            valor={valores[t.id]}
                            escala={100}
                            aoMudar={(v) =>
                              setValores((atual) => ({
                                ...atual,
                                [t.id]: Math.min(v, t.saldo),
                              }))
                            }
                          />
                        ) : (
                          <span style={{ color: "var(--text-tertiary)", textAlign: "right", display: "block" }}>
                            —
                          </span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableArea>
          </div>

          {escolhidos.length > 0 && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <Field
                label="Competência"
                hint="Sai do período dos tickets escolhidos — não se digita para não divergir do que está sendo cobrado."
              >
                <div
                  style={{
                    height: "var(--h-input)",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {paraFormatoBR(apuracaoInicio as DataISO)} a{" "}
                  {paraFormatoBR(apuracaoFim as DataISO)}
                </div>
              </Field>

              <Field label="Parcelas">
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={parcelas}
                  onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
                  style={inputStyle}
                />
              </Field>

              <Field label="1º vencimento">
                <input
                  type="date"
                  value={primeiroVencimento}
                  onChange={(e) => setPrimeiroVencimento(e.target.value)}
                  style={inputStyle}
                />
              </Field>

              {parcelas > 1 && (
                <Field label="Intervalo" hint="Dias entre uma parcela e a seguinte.">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={intervalo}
                    onChange={(e) => setIntervalo(Math.max(1, Number(e.target.value) || 30))}
                    style={inputStyle}
                  />
                </Field>
              )}

              <Field label="Observações">
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Sai no documento enviado ao cliente"
                  style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
                />
              </Field>

              <Field
                label="Emitir"
                hint="Rascunho não cobra e não baixa o ticket — serve para conferir antes."
              >
                <label
                  style={{
                    height: "var(--h-input)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "var(--text-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={emitir}
                    onChange={(e) => setEmitir(e.target.checked)}
                    style={{ accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                  Já emitir a conta
                </label>
              </Field>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** Mesma caixa desenhada do resto do app — a nativa varia por navegador. */
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
