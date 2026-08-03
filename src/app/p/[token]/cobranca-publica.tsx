"use client";

import { useState } from "react";
import type { CobrancaCompartilhada, ItemPublico, TicketPublico } from "@/modules/publico/publico.types";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";

/**
 * O ticket como o cliente o ve — o mesmo desenho do documento impresso.
 *
 * Copia a estrutura do PDF secao por secao: cabecalho TICKET com numero,
 * situacao e apuracao; DE / PARA lado a lado; tabela de servicos; totais a
 * direita; COBRANCA; OBSERVACOES. Quem recebe a cobranca ja conhece aquele
 * papel, e reconhecer o documento e o que faz confiar no link.
 *
 * O botao de imprimir chama o MESMO gerador do sistema, entao o que sai no PDF e
 * o que esta na tela.
 */

const VERDE = "#006A28";
const CINZA_CABECALHO = "#cfcfcf";
const CINZA_LINHA = "#f5f5f5";

/**
 * jsPDF pesa ~400 KB e so serve a quem clica em imprimir.
 *
 * Carregado sob demanda, a pagina abre sem pagar por ele — e quem abre no
 * celular, no meio da rua, e a maioria.
 */
const carregarPdf = () => import("@/app/(app)/tickets/pdf");

export function CobrancaPublicaView({
  cobranca,
  token,
}: {
  cobranca: CobrancaCompartilhada;
  token: string;
}) {
  const [imprimindo, setImprimindo] = useState<number | null>(null);

  async function imprimir(t: TicketPublico) {
    setImprimindo(t.numero);
    try {
      const { imprimirTicket } = await carregarPdf();

      await imprimirTicket(
        {
          id: t.numero,
          numero: t.numero,
          status: t.situacao,
          cancelada: false,
          clienteNome: t.cliente.nome,
          clienteDoc: t.cliente.doc,
          clienteEndereco: null,
          centroCustoNome: t.cliente.centroDeCusto,
          inicio: t.inicio,
          fim: t.fim,
          descricao: t.descricao,
          faturado: t.cobranca.reduce((s, c) => s + c.valor, 0),
          itens: t.itens.map((i) => ({
            servicoNome: i.servico,
            descricao: i.descricao ?? "",
            data: i.data,
            quantidade: i.quantidade,
            unidade: i.unidade,
            valorUnitario: i.valor,
            desconto: i.desconto,
            acrescimo: i.acrescimo,
            despesas: i.despesas.map((d) => ({ descricao: d.descricao ?? "", valor: d.valor })),
          })),
          faturas: [
            {
              faturaId: cobranca.faturaNumero,
              pago: t.cobranca.filter((c) => c.pago).reduce((s, c) => s + c.valor, 0),
              parcelas: t.cobranca.map((c) => ({
                numero: c.parcela,
                vencimento: c.vencimento,
                valor: c.valor,
                pago: c.pago,
              })),
            },
          ],
          empresa: {
            razaoSocial: cobranca.empresa.razaoSocial,
            endereco: cobranca.empresa.endereco,
            cnpj: cobranca.empresa.cnpj,
            logo: cobranca.empresa.logo,
          },
        },
        cobranca.empresa.razaoSocial ?? "",
      );
    } finally {
      setImprimindo(null);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 820, margin: "0 auto" }}>
      {cobranca.tickets.map((t) => (
        <Documento
          key={t.numero}
          ticket={t}
          empresa={cobranca.empresa}
          imprimindo={imprimindo === t.numero}
          aoImprimir={() => imprimir(t)}
        />
      ))}

      {/* Os arquivos ficam abaixo dos documentos: primeiro se confere o que
          esta sendo cobrado, depois se baixa o que serve para pagar. */}
      <div style={{ marginTop: 20 }}>
        {cobranca.temBoleto && (
          <Botao href={`/p/${token}/documento?tipo=boleto`}>Baixar boleto</Botao>
        )}
        {cobranca.temNfs && (
          <Botao href={`/p/${token}/documento?tipo=nfs`} secundario>
            Baixar nota fiscal
          </Botao>
        )}
      </div>
    </div>
  );
}

function Documento({
  ticket,
  empresa,
  imprimindo,
  aoImprimir,
}: {
  ticket: TicketPublico;
  empresa: CobrancaCompartilhada["empresa"];
  imprimindo: boolean;
  aoImprimir: () => void;
}) {
  const apuracao = periodoEmMeses(ticket.inicio, ticket.fim);

  const subtotal = ticket.itens.reduce(
    (s, i) => s + i.valor * i.quantidade + somaDespesas(i),
    0,
  );
  const desconto = ticket.itens.reduce((s, i) => s + i.desconto, 0);
  const acrescimo = ticket.itens.reduce((s, i) => s + i.acrescimo, 0);
  const total = ticket.itens.reduce((s, i) => s + i.total, 0);

  const pago = ticket.cobranca.filter((c) => c.pago).reduce((s, c) => s + c.valor, 0);
  const faturado = ticket.cobranca.reduce((s, c) => s + c.valor, 0);

  return (
    <article
      style={{
        background: "#ffffff",
        borderRadius: 12,
        border: "1px solid #e5e5e5",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        padding: "28px 24px 24px",
        marginBottom: 20,
      }}
    >
      {/* ── TICKET ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: VERDE,
            }}
          >
            TICKET
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 18px",
              marginTop: 8,
              fontSize: 12,
              color: "#444",
            }}
          >
            <Par rotulo="Número" valor={String(ticket.numero)} />
            <Par rotulo="Situação" valor={ticket.situacao || "—"} />
            {apuracao && <Par rotulo="Apuração" valor={apuracao} />}
          </div>
        </div>

        {empresa.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={empresa.logo}
            alt=""
            style={{ maxHeight: 46, maxWidth: 170, objectFit: "contain" }}
          />
        )}
      </div>

      {/* ── DE / PARA ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          margin: "20px 0 0",
          padding: "16px 0",
          borderTop: "1px solid #e5e5e5",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <Rotulo>DE</Rotulo>
          <Forte>{empresa.razaoSocial ?? "—"}</Forte>
          {empresa.cnpj && <Fraco>CNPJ {empresa.cnpj}</Fraco>}
          {empresa.endereco && <Fraco>{empresa.endereco}</Fraco>}
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <Rotulo>PARA</Rotulo>
          <Forte>{ticket.cliente.nome ?? "—"}</Forte>
          {ticket.cliente.doc && <Fraco>{ticket.cliente.doc}</Fraco>}
          {ticket.cliente.endereco && <Fraco>{ticket.cliente.endereco}</Fraco>}
          {ticket.cliente.endereco2 && <Fraco>{ticket.cliente.endereco2}</Fraco>}
          {ticket.cliente.centroDeCusto && (
            <Fraco>Centro de custo: {ticket.cliente.centroDeCusto}</Fraco>
          )}
        </div>
      </div>

      {/* ── Serviços ──────────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto", marginTop: 18 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr style={{ background: CINZA_CABECALHO }}>
              <Th>Serviço</Th>
              <Th>Data</Th>
              <Th alinhar="right">Qtd.</Th>
              <Th alinhar="right">Unitário</Th>
              {desconto > 0 && <Th alinhar="right">Desconto</Th>}
              {acrescimo > 0 && <Th alinhar="right">Acréscimo</Th>}
              <Th alinhar="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {ticket.itens.map((i, n) => (
              <tr key={n} style={{ background: n % 2 ? CINZA_LINHA : "#ffffff" }}>
                <Td>
                  <span style={{ fontWeight: 600 }}>{i.servico ?? "Serviço"}</span>
                  {i.descricao && (
                    <span style={{ display: "block", color: "#6b6b6b", fontSize: 12 }}>
                      {i.descricao}
                    </span>
                  )}
                  {i.despesas.map((d, k) => (
                    <span key={k} style={{ display: "block", color: "#6b6b6b", fontSize: 12 }}>
                      + {d.descricao || "Despesa"}: {formatarSemSimbolo(d.valor as Centavos)}
                    </span>
                  ))}
                </Td>
                <Td>{i.data ? paraFormatoBR(i.data as DataISO) : "—"}</Td>
                <Td alinhar="right">{quantidade(i.quantidade, i.unidade)}</Td>
                <Td alinhar="right">{formatarSemSimbolo(i.valor as Centavos)}</Td>
                {desconto > 0 && (
                  <Td alinhar="right">
                    {i.desconto ? formatarSemSimbolo(i.desconto as Centavos) : "—"}
                  </Td>
                )}
                {acrescimo > 0 && (
                  <Td alinhar="right">
                    {i.acrescimo ? formatarSemSimbolo(i.acrescimo as Centavos) : "—"}
                  </Td>
                )}
                <Td alinhar="right" forte>
                  {formatarSemSimbolo(i.total as Centavos)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totais ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div style={{ minWidth: 240 }}>
          <Total rotulo="Subtotal" valor={subtotal} />
          {desconto > 0 && <Total rotulo="Desconto" valor={desconto} />}
          {acrescimo > 0 && <Total rotulo="Acréscimo" valor={acrescimo} />}
          <Total rotulo="Total" valor={total} destaque />
        </div>
      </div>

      {/* ── COBRANÇA ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <Rotulo>COBRANÇA</Rotulo>

        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
            <thead>
              <tr style={{ background: CINZA_CABECALHO }}>
                <Th>Parcela</Th>
                <Th>Vencimento</Th>
                <Th alinhar="right">Valor</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {ticket.cobranca.map((c, n) => (
                <tr
                  key={c.parcela}
                  style={{
                    /* A parcela deste link em destaque: a pessoa abriu para pagar
                       UMA, e numa lista de doze todas parecem iguais. */
                    background: c.atual ? "#eef7f0" : n % 2 ? CINZA_LINHA : "#ffffff",
                    fontWeight: c.atual ? 600 : 400,
                  }}
                >
                  <Td>{c.parcela}</Td>
                  <Td>{c.vencimento ? paraFormatoBR(c.vencimento as DataISO) : "—"}</Td>
                  <Td alinhar="right">{formatarSemSimbolo(c.valor as Centavos)}</Td>
                  <Td>
                    <span style={{ color: c.pago ? VERDE : "#444" }}>
                      {c.pago ? "Paga" : "Em aberto"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div style={{ minWidth: 240 }}>
            <Total rotulo="Faturado" valor={faturado} />
            <Total rotulo="Valor pago" valor={pago} />
            <Total rotulo="Saldo devedor" valor={faturado - pago} destaque />
          </div>
        </div>
      </div>

      {ticket.descricao && (
        <div style={{ marginTop: 22 }}>
          <Rotulo>OBSERVAÇÕES</Rotulo>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: "#444",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {ticket.descricao}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22, textAlign: "right" }}>
        <button
          type="button"
          onClick={aoImprimir}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: `1px solid ${VERDE}`,
            background: "transparent",
            color: VERDE,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {imprimindo ? "Gerando…" : "Imprimir este ticket"}
        </button>
      </div>
    </article>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

/** Horas saem como "12h30" — o decimal é o formato de quem calcula, não de quem lê. */
function quantidade(q: number, unidade: "UN" | "H"): string {
  if (unidade === "H") {
    const minutos = Math.round(q * 60);
    const m = minutos % 60;
    return m === 0
      ? `${minutos / 60}h`
      : `${Math.floor(minutos / 60)}h${String(m).padStart(2, "0")}`;
  }
  return Number.isInteger(q) ? `${q} un` : `${q.toFixed(2).replace(".", ",")} un`;
}

function somaDespesas(i: ItemPublico): number {
  return i.despesas.reduce((s, d) => s + d.valor, 0);
}

function Par({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <span>
      <span style={{ color: "#6b6b6b" }}>{rotulo}: </span>
      <strong style={{ fontWeight: 600 }}>{valor}</strong>
    </span>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "#6b6b6b",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Forte({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{children}</div>;
}

function Fraco({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#6b6b6b", lineHeight: 1.5 }}>{children}</div>;
}

function Th({
  children,
  alinhar = "left",
}: {
  children: React.ReactNode;
  alinhar?: "left" | "right";
}) {
  return (
    <th
      style={{
        padding: "7px 10px",
        textAlign: alinhar,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.03em",
        color: "#1a1a1a",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
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
        padding: "8px 10px",
        textAlign: alinhar,
        fontSize: 13,
        fontWeight: forte ? 600 : undefined,
        color: "#1a1a1a",
        verticalAlign: "top",
        fontVariantNumeric: alinhar === "right" ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function Total({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: destaque ? "8px 10px" : "4px 10px",
        borderTop: destaque ? "1px solid #e5e5e5" : undefined,
        marginTop: destaque ? 4 : 0,
      }}
    >
      <span style={{ fontSize: destaque ? 14 : 12, color: destaque ? "#1a1a1a" : "#6b6b6b" }}>
        {rotulo}
      </span>
      <span
        style={{
          fontSize: destaque ? 16 : 12,
          fontWeight: destaque ? 700 : 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatarSemSimbolo(valor as Centavos)}
      </span>
    </div>
  );
}

function Botao({
  href,
  secundario,
  children,
}: {
  href: string;
  secundario?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
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
        border: secundario ? `1px solid ${VERDE}` : "none",
        background: secundario ? "transparent" : VERDE,
        color: secundario ? VERDE : "#ffffff",
      }}
    >
      {children}
    </a>
  );
}
