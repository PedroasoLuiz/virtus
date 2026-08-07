"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Badge,
  Button,
  CampoBloqueado,
  CampoNumerico,
  Field,
  PanelTabs,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { PERIODICIDADES } from "@/modules/contratos/contratos.types";
import { competenciaBR } from "./contratos-tela";

/** Detalhe do contrato: dados e o histórico de competências geradas. */

type Competencia = {
  id: number;
  competencia: string;
  ticketId: number | null;
  valor: number;
  geradaEm: string;
};

type Contrato = {
  id: number;
  numero: string | null;
  descricao: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  valor: number;
  periodicidade: string;
  diaVencimento: number | null;
  inicio: string | null;
  fim: string | null;
  proximaCompetencia: string | null;
  ativo: boolean;
  qtdCompetencias: number;
  competencias: Competencia[];
};

export type OpcaoCliente = { id: number; nome: string };

const ROTULO: Record<string, string> = {
  MENSAL: "Mensal",
  BIMESTRAL: "Bimestral",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

const ABA_DADOS = "Dados";
const ABA_HISTORICO = "Competências";

export function ContratoDrawer({
  contratoId,
  criando,
  clientes,
  clienteInicial,
  onClose,
  aoCriar,
}: {
  contratoId: number | null;
  criando?: boolean;
  clientes: OpcaoCliente[];
  /** Ja vem escolhido quando o contrato nasce de dentro de um projeto. */
  clienteInicial?: number | null;
  onClose: () => void;
  /** Recebe o id do contrato recem-criado. Quem abriu decide o que fazer com ele. */
  aoCriar?: (id: number) => void;
}) {
  if (!criando && contratoId == null) return null;
  return (
    <Conteudo
      key={criando ? "novo" : contratoId}
      contratoId={criando ? null : contratoId}
      clientes={clientes}
      clienteInicial={clienteInicial}
      onClose={onClose}
      aoCriar={aoCriar}
    />
  );
}

function Conteudo({
  contratoId,
  clientes,
  clienteInicial,
  onClose,
  aoCriar,
}: {
  contratoId: number | null;
  clientes: OpcaoCliente[];
  clienteInicial?: number | null;
  onClose: () => void;
  aoCriar?: (id: number) => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const criando = contratoId == null;

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [aba, setAba] = useState(ABA_DADOS);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    numero: "",
    descricao: "",
    clienteId: clienteInicial ? String(clienteInicial) : "",
    valor: 0,
    periodicidade: "MENSAL",
    diaVencimento: 0,
    inicio: "",
    fim: "",
  });

  useEffect(() => {
    if (contratoId == null) return;
    const controle = new AbortController();

    fetch(`/api/v1/contratos/${contratoId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o contrato");
        const c = corpo.data as Contrato;
        setContrato(c);
        setForm({
          numero: c.numero ?? "",
          descricao: c.descricao ?? "",
          clienteId: c.clienteId ? String(c.clienteId) : "",
          valor: c.valor,
          periodicidade: c.periodicidade,
          diaVencimento: c.diaVencimento ?? 0,
          inicio: c.inicio ?? "",
          fim: c.fim ?? "",
        });
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") avisar("erro", e.message);
      });

    return () => controle.abort();
  }, [contratoId, avisar]);

  async function salvar() {
    setSalvando(true);

    const r = await fetch(criando ? "/api/v1/contratos" : `/api/v1/contratos/${contratoId}`, {
      method: criando ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: form.numero.trim() || null,
        descricao: form.descricao.trim() || null,
        clienteId: form.clienteId ? Number(form.clienteId) : null,
        valor: form.valor,
        periodicidade: form.periodicidade,
        diaVencimento: form.diaVencimento || null,
        inicio: form.inicio || null,
        fim: form.fim || null,
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      // `details` traz o campo que o Zod recusou; só "dados inválidos"
      // obrigaria o usuário a adivinhar qual.
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível salvar",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    router.refresh();
    avisar("sucesso", criando ? "Contrato criado" : "Contrato salvo");
    if (criando && dados?.data?.id != null) aoCriar?.(dados.data.id as number);
    onClose();
  }

  // Periodicidade congela depois da primeira competência: `proxima_competencia`
  // avança pelo passo dela, e trocar no meio pularia meses já devidos.
  const travaPeriodicidade = (contrato?.qtdCompetencias ?? 0) > 0;
  const abaHistorico = `${ABA_HISTORICO} (${contrato?.competencias.length ?? 0})`;

  return (
    <Drawer
      open
      onClose={onClose}
      title={criando ? "Novo contrato" : `Contrato ${contrato?.numero ?? contratoId}`}
      subtitle={contrato?.descricao ?? undefined}
      acoes={
        <Button size="xs" variant="primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : criando ? "Criar" : "Salvar"}
        </Button>
      }
    >
      {!criando && (
        <PanelTabs
          tabs={[ABA_DADOS, abaHistorico]}
          active={aba === ABA_DADOS ? ABA_DADOS : abaHistorico}
          onChange={(t) => setAba(t === ABA_DADOS ? ABA_DADOS : ABA_HISTORICO)}
        />
      )}

      {aba === ABA_DADOS ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Field label="Número">
            <input
              value={form.numero}
              onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              maxLength={40}
              style={inputStyle}
            />
          </Field>

          <Field label="Cliente">
            <select
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
              style={selectStyle}
            >
              <option value="">Selecione…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valor por período">
            <CampoNumerico
              valor={form.valor}
              escala={100}
              aoMudar={(v) => setForm((f) => ({ ...f, valor: v }))}
            />
          </Field>

          <Field
            label="Periodicidade"
            hint={travaPeriodicidade ? "Travada: já há competência gerada" : undefined}
          >
            {travaPeriodicidade ? (
              <CampoBloqueado valor={ROTULO[form.periodicidade] ?? form.periodicidade} />
            ) : (
              <select
                value={form.periodicidade}
                onChange={(e) => setForm((f) => ({ ...f, periodicidade: e.target.value }))}
                style={selectStyle}
              >
                {PERIODICIDADES.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO[p]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Dia de vencimento">
            <CampoNumerico
              valor={form.diaVencimento}
              casas={0}
              aoMudar={(v) => setForm((f) => ({ ...f, diaVencimento: v }))}
            />
          </Field>

          <Field label="Início">
            <input
              type="date"
              value={form.inicio}
              onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Fim" hint="Vazio = contrato sem prazo">
            <input
              type="date"
              value={form.fim}
              onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
            />
          </Field>

          {!criando && (
            <Field label="Próxima competência">
              <CampoBloqueado
                valor={
                  contrato?.proximaCompetencia
                    ? competenciaBR(contrato.proximaCompetencia as DataISO)
                    : "—"
                }
                titulo="Avança sozinha a cada competência gerada"
              />
            </Field>
          )}
        </div>
      ) : (
        <Historico competencias={contrato?.competencias ?? []} />
      )}
    </Drawer>
  );
}

/** Cada linha é um período já cobrado — é o que impede gerar o mesmo mês duas vezes. */
function Historico({ competencias }: { competencias: Competencia[] }) {
  if (competencias.length === 0) {
    return (
      <div
        style={{
          padding: "28px 12px",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: "var(--text-base)",
        }}
      >
        Nenhuma competência gerada.
      </div>
    );
  }

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
            {["Competência", "Ticket", "Gerada em", "Valor"].map((t, i) => (
              <th
                key={t}
                className="rotulo"
                style={{
                  height: 32,
                  padding: "0 12px",
                  textAlign: i === 3 ? "right" : "left",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {competencias.map((c, i) => (
            <tr key={c.id} style={{ borderTop: i === 0 ? undefined : "1px solid var(--border)" }}>
              <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>
                {competenciaBR(c.competencia as DataISO)}
              </td>
              <td style={{ padding: "9px 12px" }}>
                {c.ticketId ? <Badge tom="info">{c.ticketId}</Badge> : "—"}
              </td>
              <td style={{ padding: "9px 12px", color: "var(--text-tertiary)" }}>
                {paraFormatoBR(c.geradaEm.slice(0, 10) as DataISO)}
              </td>
              <td
                style={{
                  padding: "9px 12px",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: "var(--fw-medium)",
                }}
              >
                {formatarSemSimbolo(c.valor as Centavos)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
