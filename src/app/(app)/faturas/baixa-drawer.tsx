"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button, CampoNumerico, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";

/**
 * Dar baixa: registrar o que entrou e dizer para onde foi.
 *
 * O valor vai POR PARCELA, e não um total que o sistema divide sozinho. Os três
 * casos reais só cabem assim:
 *
 *   um PIX de 3.000 quitando três parcelas de 1.000;
 *   uma parcela de 5.000 recebida em 1.000 + 2.000 + 1.500 + 500;
 *   um pagamento a menor, deixando o resto em aberto.
 *
 * Dividir automaticamente acertaria o primeiro e erraria os outros dois — e o
 * erro só apareceria no fechamento do mês.
 */

type ParcelaAberta = {
  id: number;
  numero: number;
  vencimento: string | null;
  total: number;
  recebido: number;
  pago: boolean;
};

export function BaixaDrawer({
  faturaId,
  numero,
  parcelas,
  aoBaixar,
  onClose,
}: {
  faturaId: number;
  numero: number;
  parcelas: ParcelaAberta[];
  aoBaixar: (fatura: unknown) => void;
  onClose: () => void;
}) {
  const { avisar } = useAvisos();

  const abertas = useMemo(
    () => parcelas.filter((p) => !p.pago && p.total - p.recebido > 0),
    [parcelas],
  );

  const [valores, setValores] = useState<Record<number, number>>({});
  const [data, setData] = useState<string>(hoje());
  const [contaId, setContaId] = useState("");
  const [contas, setContas] = useState<{ id: number; nome: string }[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const controle = new AbortController();

    fetch("/api/v1/contas-bancarias", { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (r.ok) setContas(corpo.data);
      })
      .catch(() => {
        // Sem conta cadastrada a baixa continua valendo: o rateio é o que
        // importa, e a conta bancária é para o extrato saber de onde veio.
      });

    return () => controle.abort();
  }, []);

  const destinos = abertas
    .filter((p) => (valores[p.id] ?? 0) > 0)
    .map((p) => ({ parcelaId: p.id, valor: valores[p.id] }));

  const total = destinos.reduce((soma, d) => soma + d.valor, 0) as Centavos;

  async function baixar() {
    setSalvando(true);

    const r = await fetch(`/api/v1/faturas/${faturaId}/baixas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        contaBancariaId: contaId ? Number(contaId) : null,
        observacoes: observacoes.trim() || null,
        destinos,
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível registrar a baixa",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    avisar("sucesso", "Baixa registrada", `${formatarSemSimbolo(total)} em ${destinos.length} parcela(s).`);
    aoBaixar(dados.data);
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Dar baixa na conta ${numero}`}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
              Recebendo
            </div>
            <div
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "var(--fw-semi)",
                fontVariantNumeric: "tabular-nums",
                color: total > 0 ? "var(--credito)" : "var(--text-tertiary)",
              }}
            >
              {formatarSemSimbolo(total)}
            </div>
          </div>

          <span style={{ flex: 1 }} />
          <Button
            size="sm"
            variant="primary"
            disabled={salvando || destinos.length === 0}
            onClick={baixar}
          >
            {salvando ? "Registrando…" : "Registrar baixa"}
          </Button>
        </div>
      }
    >
      {abertas.length === 0 ? (
        <div
          style={{
            padding: "28px 16px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-base)",
            lineHeight: 1.6,
          }}
        >
          Todas as parcelas desta conta já foram recebidas.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 16 }}>
            <Field label="Data" required hint="Quando o dinheiro entrou, não quando você lançou.">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field
              label="Conta"
              hint={
                contas.length === 0
                  ? "Nenhuma conta bancária cadastrada. A baixa vale mesmo assim."
                  : "Onde o dinheiro caiu. É o que liga a baixa ao extrato."
              }
            >
              <select
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                style={selectStyle}
              >
                <option value="">Não informar</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Observações">
              <input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: PIX recebido em conjunto com a conta 214"
                maxLength={200}
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="rotulo" style={{ fontSize: "var(--text-xs)", marginBottom: 8 }}>
            Para onde vai
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {abertas.map((p) => (
              <Linha
                key={p.id}
                parcela={p}
                valor={valores[p.id] ?? 0}
                aoMudar={(v) => setValores((atual) => ({ ...atual, [p.id]: v }))}
              />
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

function Linha({
  parcela,
  valor,
  aoMudar,
}: {
  parcela: ParcelaAberta;
  valor: number;
  aoMudar: (v: number) => void;
}) {
  const emAberto = parcela.total - parcela.recebido;
  const escolhida = valor > 0;
  const parcial = parcela.recebido > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: "var(--radius-md)",
        background: escolhida ? "var(--primary-subtle)" : "var(--surface-2)",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: "var(--fw-semi)",
          color: "var(--primary)",
          minWidth: 18,
        }}
      >
        {parcela.numero}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)" }}>
          {parcela.vencimento ? paraFormatoBR(parcela.vencimento as DataISO) : "—"}
        </div>
        {/* Já recebeu parte: sem isso, quem vê "em aberto 2.000" numa parcela de
            5.000 acha que o valor está errado. */}
        {parcial && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {formatarSemSimbolo(parcela.recebido as Centavos)} de{" "}
            {formatarSemSimbolo(parcela.total as Centavos)}
          </div>
        )}
      </div>

      <button
        type="button"
        title="Receber tudo o que falta"
        onClick={() => aoMudar(escolhida ? 0 : emAberto)}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
          fontVariantNumeric: "tabular-nums",
          cursor: "pointer",
        }}
      >
        {formatarSemSimbolo(emAberto as Centavos)}
      </button>

      {/* Editável: pagamento a menor é comum, e o que sobra continua em aberto. */}
      <div style={{ width: 118 }}>
        <CampoNumerico
          valor={valor}
          escala={100}
          aoMudar={(v) => aoMudar(Math.min(v, emAberto))}
        />
      </div>
    </div>
  );
}
