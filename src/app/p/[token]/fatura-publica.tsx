"use client";

import { useState } from "react";
import type { FaturaPublica } from "@/modules/publico/publico.repository";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";

/**
 * A fatura como o cliente a ve — no formato do documento, nao de um resumo.
 *
 * A tela imita o impresso de proposito: quem recebe a cobranca ja conhece aquele
 * papel, e reconhecer o documento e o que faz a pessoa confiar no link. O botao
 * de imprimir usa o MESMO gerador do sistema, entao o que sai no PDF e o que
 * esta na tela.
 */

const VERDE = "#006A28";
const CINZA_LINHA = "#f5f5f5";

/**
 * jsPDF pesa ~400 KB e so serve a quem clica em imprimir.
 *
 * Carregado sob demanda, a pagina do cliente abre sem pagar por ele — e quem
 * abre no celular, no meio da rua, e a maioria.
 */
const carregarPdf = () => import("@/app/(app)/tickets/pdf");

export function FaturaPublicaView({
  fatura,
  token,
}: {
  fatura: FaturaPublica;
  token: string;
}) {
  const [imprimindo, setImprimindo] = useState(false);

  const parcela = fatura.parcelas.find((p) => p.atual);
  const competencia = periodoEmMeses(fatura.competenciaDe, fatura.competenciaAte);

  async function imprimir() {
    setImprimindo(true);
    try {
      const { imprimirTicket } = await carregarPdf();

      /*
       * O gerador foi escrito para o ticket, e a fatura cabe na mesma forma:
       * cabecalho de quem emite, bloco de quem paga, tabela de itens e as
       * parcelas embaixo. Reaproveitar mantem UM layout — dois geradores
       * divergiriam no primeiro ajuste, e o cliente veria dois documentos
       * diferentes para a mesma cobranca.
       */
      await imprimirTicket(
        {
          id: fatura.numero,
          numero: fatura.numero,
          status: parcela?.pago ? "PAGA" : "EM ABERTO",
          cancelada: false,
          clienteNome: fatura.cliente.nome,
          clienteDoc: fatura.cliente.doc,
          clienteEndereco: null,
          centroCustoNome: null,
          inicio: fatura.competenciaDe,
          fim: fatura.competenciaAte,
          descricao: fatura.observacoes,
          faturado: fatura.total,
          itens: fatura.itens.map((i) => ({
            servicoNome: null,
            descricao: i.descricao,
            data: null,
            quantidade: i.quantidade,
            unidade: "UN" as const,
            valorUnitario: i.valor,
            desconto: i.desconto,
            acrescimo: i.acrescimo,
            despesas: [],
          })),
          faturas: [
            {
              faturaId: fatura.numero,
              pago: fatura.parcelas.filter((p) => p.pago).reduce((s, p) => s + p.total, 0),
              parcelas: fatura.parcelas.map((p) => ({
                numero: p.numero,
                vencimento: p.vencimento,
                valor: p.total,
                pago: p.pago,
              })),
            },
          ],
          empresa: {
            razaoSocial: fatura.empresa.razaoSocial,
            endereco: fatura.empresa.endereco,
            cnpj: fatura.empresa.cnpj,
            logo: fatura.empresa.logo,
          },
        },
        fatura.empresa.razaoSocial ?? "",
      );
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
      <div
        style={{
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid #e5e5e5",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          padding: "28px 24px 32px",
        }}
      >
        {/* ── Cabeçalho: quem cobra ─────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "flex-start",
            paddingBottom: 18,
            borderBottom: `2px solid ${VERDE}`,
          }}
        >
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            {fatura.empresa.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fatura.empresa.logo}
                alt=""
                style={{ maxHeight: 44, maxWidth: 180, marginBottom: 8, display: "block" }}
              />
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>
              {fatura.empresa.razaoSocial ?? "—"}
            </div>
            {fatura.empresa.cnpj && (
              <div style={{ fontSize: 12, color: "#6b6b6b", marginTop: 2 }}>
                CNPJ {fatura.empresa.cnpj}
              </div>
            )}
            {fatura.empresa.endereco && (
              <div style={{ fontSize: 12, color: "#6b6b6b", lineHeight: 1.5 }}>
                {fatura.empresa.endereco}
              </div>
            )}
          </div>

          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#6b6b6b",
              }}
            >
              Fatura
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: VERDE,
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fatura.numero}
            </div>
            {competencia && (
              <div style={{ fontSize: 12, color: "#6b6b6b", marginTop: 2 }}>{competencia}</div>
            )}
          </div>
        </div>

        {/* ── Quem paga ─────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 0", borderBottom: "1px solid #f0f0f0" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6b6b6b",
              marginBottom: 4,
            }}
          >
            Cobrar de
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{fatura.cliente.nome ?? "—"}</div>
          {fatura.cliente.doc && (
            <div style={{ fontSize: 12, color: "#6b6b6b" }}>CNPJ {fatura.cliente.doc}</div>
          )}
        </div>

        {/* ── Itens ─────────────────────────────────────────────────────── */}
        <div style={{ overflowX: "auto", margin: "18px 0 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr style={{ background: "#cfcfcf" }}>
                <Cabecalho>Descrição</Cabecalho>
                <Cabecalho alinhar="right">Qtd</Cabecalho>
                <Cabecalho alinhar="right">Valor</Cabecalho>
                <Cabecalho alinhar="right">Total</Cabecalho>
              </tr>
            </thead>
            <tbody>
              {fatura.itens.map((i, n) => (
                <tr key={n} style={{ background: n % 2 ? CINZA_LINHA : "#ffffff" }}>
                  <Celula>{i.descricao}</Celula>
                  <Celula alinhar="right">
                    {Number.isInteger(i.quantidade) ? i.quantidade : i.quantidade.toFixed(2)}
                  </Celula>
                  <Celula alinhar="right">{formatarSemSimbolo(i.valor as Centavos)}</Celula>
                  <Celula alinhar="right" forte>
                    {formatarSemSimbolo(i.total as Centavos)}
                  </Celula>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "baseline",
            gap: 12,
            padding: "14px 8px 0",
          }}
        >
          <span style={{ fontSize: 13, color: "#6b6b6b" }}>Total da fatura</span>
          <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {formatarSemSimbolo(fatura.total as Centavos)}
          </span>
        </div>

        {/* ── Parcelas ──────────────────────────────────────────────────── */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6b6b6b",
              marginBottom: 8,
            }}
          >
            Parcelas
          </div>

          {fatura.parcelas.map((p) => (
            <div
              key={p.numero}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 4,
                /* A parcela deste link em destaque: a pessoa abriu para pagar
                   UMA, e numa lista de doze todas parecem iguais. */
                background: p.atual ? "#eef7f0" : CINZA_LINHA,
                border: p.atual ? `1px solid ${VERDE}` : "1px solid transparent",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 24 }}>{p.numero}</span>
              <span style={{ flex: 1, fontSize: 13, color: "#444" }}>
                {p.vencimento ? paraFormatoBR(p.vencimento as DataISO) : "—"}
              </span>
              {p.pago && (
                <span style={{ fontSize: 11, fontWeight: 700, color: VERDE }}>PAGA</span>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {formatarSemSimbolo(p.total as Centavos)}
              </span>
            </div>
          ))}
        </div>

        {(fatura.observacoes || fatura.rodape) && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid #f0f0f0",
              fontSize: 12,
              color: "#6b6b6b",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {[fatura.observacoes, fatura.rodape].filter(Boolean).join("\n")}
          </div>
        )}
      </div>

      {/* ── O que dá para fazer daqui ───────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        {fatura.temBoleto && (
          <Botao href={`/p/${token}/documento?tipo=boleto`}>Baixar boleto</Botao>
        )}
        {fatura.temNfs && (
          <Botao href={`/p/${token}/documento?tipo=nfs`} secundario>
            Baixar nota fiscal
          </Botao>
        )}
        <Botao onClick={imprimir} secundario>
          {imprimindo ? "Gerando…" : "Imprimir fatura"}
        </Botao>
      </div>
    </div>
  );
}

function Cabecalho({
  children,
  alinhar = "left",
}: {
  children: React.ReactNode;
  alinhar?: "left" | "right";
}) {
  return (
    <th
      style={{
        padding: "8px 10px",
        textAlign: alinhar,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#1a1a1a",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Celula({
  children,
  alinhar = "left",
  forte,
}: {
  children: React.ReactNode;
  alinhar?: "left" | "right";
  forte?: boolean;
}) {
  return (
    <td
      style={{
        padding: "9px 10px",
        textAlign: alinhar,
        fontSize: 13,
        fontWeight: forte ? 600 : 400,
        color: "#1a1a1a",
        fontVariantNumeric: alinhar === "right" ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function Botao({
  href,
  onClick,
  secundario,
  children,
}: {
  href?: string;
  onClick?: () => void;
  secundario?: boolean;
  children: React.ReactNode;
}) {
  const estilo: React.CSSProperties = {
    display: "block",
    width: "100%",
    maxWidth: 320,
    margin: "0 auto 10px",
    padding: "14px 28px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    textAlign: "center",
    textDecoration: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    border: secundario ? `1px solid ${VERDE}` : "none",
    background: secundario ? "transparent" : VERDE,
    color: secundario ? VERDE : "#ffffff",
  };

  return href ? (
    <a href={href} style={estilo}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} style={estilo}>
      {children}
    </button>
  );
}
