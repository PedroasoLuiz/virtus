"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  Badge,
  Button,
  CampoBloqueado,
  Field,
  ProgressoValor,
  type Tom,
} from "@/components/ui/kit";
import { formatar, formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { situacaoDaConta, type SituacaoConta } from "@/modules/contas-pagar/contas-pagar.types";

/**
 * Detalhe da conta a pagar.
 *
 * Mesmo padrao do drawer de fatura: primeiro quanto ja saiu e quanto falta,
 * depois de quem e a conta, e so entao as parcelas. Campos aparecem como campo
 * bloqueado com cadeado — a tela ainda nao edita nada, e o cadeado explica por
 * que. As acoes de baixa ficam desabilitadas e visiveis, para o que falta nao
 * se esconder.
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

type Conta = {
  id: number;
  descricao: string;
  fornecedorNome: string | null;
  emissao: string | null;
  proximoVencimento: string | null;
  total: number;
  pago: boolean;
  cancelada: boolean;
  qtdParcelas: number;
  parcelasPagas: number;
  observacoes: string | null;
  parcelas: Parcela[];
};

export function ContaDrawer({ contaId, onClose }: { contaId: number | null; onClose: () => void }) {
  // `key` remonta a cada conta: o estado nasce vazio sozinho, sem limpar a mao
  // dentro de um efeito, e sem mostrar o registro anterior enquanto carrega.
  return contaId == null ? null : (
    <Conteudo key={contaId} contaId={contaId} onClose={onClose} />
  );
}

function Conteudo({ contaId, onClose }: { contaId: number; onClose: () => void }) {
  const [conta, setConta] = useState<Conta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/contas-pagar/${contaId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar a conta");
        setConta(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [contaId]);

  const situacao = conta
    ? situacaoDaConta({
        ...conta,
        fornecedorId: null,
        emissao: null,
        proximoVencimento: conta.proximoVencimento as DataISO | null,
        total: conta.total as Centavos,
      })
    : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={conta ? `Conta ${conta.id}` : "Conta a pagar"}
      headerExtra={situacao ? <Badge tom={TOM[situacao]}>{situacao}</Badge> : null}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontSize: "var(--text-md)", fontWeight: "var(--fw-semi)" }}>
            Total: {conta ? formatar(conta.total as Centavos) : "—"}
          </div>
          <Button size="sm" disabled title="Ainda não implementado">
            Baixar parcela
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

      {!conta && !erro && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[70, 90, 55, 100].map((l, i) => (
            <div
              key={i}
              className="sk"
              style={{
                height: 14,
                width: `${l}%`,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-3)",
              }}
            />
          ))}
        </div>
      )}

      {conta && (
        <>
          {/* Pago vem das parcelas baixadas: e a parcela que carrega a verdade
              sobre o pagamento, nao um campo do cabecalho. */}
          <ProgressoValor
            total={conta.total}
            pago={conta.parcelas.filter((p) => p.pago).reduce((s, p) => s + p.total, 0)}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            <Field label="Fornecedor">
              <CampoBloqueado valor={conta.fornecedorNome ?? "—"} />
            </Field>
            <Field label="Descrição">
              <CampoBloqueado valor={conta.descricao || "—"} />
            </Field>
            <Field label="Emissão">
              <CampoBloqueado
                valor={conta.emissao ? paraFormatoBR(conta.emissao as DataISO) : "—"}
              />
            </Field>
            <Field label="Situação">
              <CampoBloqueado valor={situacao ?? "—"} />
            </Field>
            {conta.observacoes && (
              <Field label="Observações">
                <CampoBloqueado valor={conta.observacoes} multilinha />
              </Field>
            )}
          </div>

          <div className="rotulo" style={{ marginBottom: 8 }}>
            Parcelas ({conta.parcelas.length})
          </div>
          <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
              }}
            >
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}
              >
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["#", "Vencimento", "Valor", "Situação", "Anexos"].map((c, i) => (
                      <th
                        key={c}
                        className="rotulo"
                        style={{
                          height: 32,
                          padding: "0 12px",
                          textAlign: i === 2 ? "right" : i === 1 ? "left" : "center",
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
                  {conta.parcelas.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "20px 12px",
                          textAlign: "center",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        Nenhuma parcela gerada.
                      </td>
                    </tr>
                  )}
                  {conta.parcelas.map((p, i) => (
                    <tr
                      key={p.id}
                      style={{ borderTop: i === 0 ? undefined : "1px solid var(--border)" }}
                    >
                      <td style={{ height: 34, padding: "0 12px", textAlign: "center" }}>
                        {p.numero}
                      </td>
                      <td style={{ padding: "0 12px", fontVariantNumeric: "tabular-nums" }}>
                        <Vencimento data={p.vencimento} pago={p.pago} />
                      </td>
                      <td
                        style={{
                          padding: "0 12px",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatarSemSimbolo(p.total as Centavos)}
                      </td>
                      <td style={{ padding: "0 12px", textAlign: "center" }}>
                        <Badge tom={p.pago ? "success" : "info"}>
                          {p.pago ? "PAGA" : "ABERTA"}
                        </Badge>
                      </td>
                      <td style={{ padding: "0 12px", textAlign: "center" }}>
                        <Anexos boleto={p.boleto} nfs={p.nfs} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        </>
      )}
    </Drawer>
  );
}

function Vencimento({ data, pago }: { data: string | null; pago: boolean }) {
  if (!data) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;

  const atrasado = !pago && data < hoje();
  return (
    <span
      style={{
        color: atrasado ? "var(--danger-text)" : undefined,
        fontWeight: atrasado ? "var(--fw-medium)" : undefined,
      }}
    >
      {paraFormatoBR(data as DataISO)}
    </span>
  );
}

function Anexos({ boleto, nfs }: { boleto: string | null; nfs: string | null }) {
  if (!boleto && !nfs) return <span style={{ color: "var(--text-disabled)" }}>—</span>;

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {boleto && <Anexo href={boleto} rotulo="Boleto" />}
      {nfs && <Anexo href={nfs} rotulo="NF" />}
    </span>
  );
}

function Anexo({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <a
      href={href}
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
      }}
    >
      {rotulo}
    </a>
  );
}

const TOM: Record<SituacaoConta, Tom> = {
  ABERTA: "info",
  PARCIAL: "warning",
  VENCIDA: "danger",
  PAGA: "success",
  CANCELADA: "neutral",
};
