"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button, CampoNumerico, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { TIPOS_DE_RECEBIMENTO } from "@/modules/faturas/faturas.types";

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
  const [quitar, setQuitar] = useState<Record<number, boolean>>({});
  const [data, setData] = useState<string>(hoje());
  const [tipo, setTipo] = useState<string>("PIX");
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
    .map((p) => ({ parcelaId: p.id, valor: valores[p.id], quitar: quitar[p.id] ?? false }));

  const total = destinos.reduce((soma, d) => soma + d.valor, 0) as Centavos;

  async function baixar() {
    setSalvando(true);

    const r = await fetch(`/api/v1/faturas/${faturaId}/baixas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        tipo,
        contaBancariaId: Number(contaId),
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
            disabled={salvando || destinos.length === 0 || !contaId}
            title={!contaId ? "Escolha a conta em que o dinheiro entrou" : undefined}
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
              label="Forma"
              required
              hint="Lista fechada de propósito: no legado o mesmo PIX aparece com quatro grafias diferentes, e nenhum relatório consegue agrupar."
            >
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={selectStyle}>
                {TIPOS_DE_RECEBIMENTO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            {/* Obrigatória: o dinheiro entrou em ALGUM lugar, e baixa sem conta
                não concilia com extrato nenhum — vira um número que não se
                confere depois. */}
            <Field label="Conta" required hint="Onde o dinheiro caiu. É o que liga a baixa ao extrato.">
              <select
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                style={selectStyle}
              >
                <option value="">Escolher…</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Observações">
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Ex.: PIX recebido em conjunto com a conta 214"
                maxLength={400}
                style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
              />
            </Field>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
              Quanto abater de cada parcela
            </div>
            {/* Um recebimento pode cobrir mais de uma parcela, e uma parcela
                pode juntar vários. Por isso o valor é informado aqui, linha a
                linha, e não como um total que o sistema divide sozinho. */}
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              O que sobrar continua em aberto.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {abertas.map((p) => (
              <Linha
                key={p.id}
                parcela={p}
                valor={valores[p.id] ?? 0}
                quitar={quitar[p.id] ?? false}
                aoMudar={(v) => setValores((atual) => ({ ...atual, [p.id]: v }))}
                aoQuitar={(v) => setQuitar((atual) => ({ ...atual, [p.id]: v }))}
              />
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

/**
 * Uma parcela na baixa.
 *
 * Em duas alturas: em cima o que identifica (numero, vencimento, o que ja
 * entrou); embaixo o que se decide. Tudo numa linha so, a mira ficava apertada
 * entre quatro elementos de tamanhos diferentes.
 */
function Linha({
  parcela,
  valor,
  quitar,
  aoMudar,
  aoQuitar,
}: {
  parcela: ParcelaAberta;
  valor: number;
  quitar: boolean;
  aoMudar: (v: number) => void;
  aoQuitar: (v: boolean) => void;
}) {
  const emAberto = parcela.total - parcela.recebido;
  const escolhida = valor > 0;
  const diferenca = escolhida ? emAberto - valor : 0;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${escolhida ? "var(--primary-border)" : "var(--border)"}`,
        background: escolhida ? "var(--primary-subtle)" : "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-wide)",
            color: "var(--primary)",
          }}
        >
          PARCELA {parcela.numero}
        </span>

        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          vence {parcela.vencimento ? paraFormatoBR(parcela.vencimento as DataISO) : "\u2014"}
        </span>

        <span style={{ flex: 1 }} />

        {/* Ja recebeu parte: sem isso, quem ve "em aberto 2.000" numa parcela de
            5.000 acha que o valor esta errado. */}
        {parcela.recebido > 0 && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            {formatarSemSimbolo(parcela.recebido as Centavos)} de{" "}
            {formatarSemSimbolo(parcela.total as Centavos)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          title="Preencher com tudo o que falta"
          onClick={() => aoMudar(escolhida ? 0 : emAberto)}
          style={{
            border: "none",
            background: "none",
            padding: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font)",
            cursor: "pointer",
          }}
        >
          Em aberto{" "}
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatarSemSimbolo(emAberto as Centavos)}
          </strong>
        </button>

        <span style={{ flex: 1 }} />

        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Recebi</span>
        <div style={{ width: 130 }}>
          <CampoNumerico valor={valor} escala={100} aoMudar={(v) => aoMudar(Math.min(v, emAberto))} />
        </div>
      </div>

      {/*
       * A pergunta que o sistema nao pode responder sozinho.
       *
       * Recebi 500 de 510: os 10 continuam devidos, ou eu abri mao? As duas
       * respostas sao legitimas, e so quem recebeu sabe. Aparece apenas quando
       * ha diferenca, e o padrao e deixar em aberto — perdoar divida por
       * omissao seria a escolha errada de fazer sozinho.
       */}
      {diferenca > 0 && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={quitar}
            onChange={(e) => aoQuitar(e.target.checked)}
            style={{ accentColor: "var(--primary)", cursor: "pointer" }}
          />
          Quitar e dar {formatarSemSimbolo(diferenca as Centavos)} de desconto
        </label>
      )}
    </div>
  );
}
