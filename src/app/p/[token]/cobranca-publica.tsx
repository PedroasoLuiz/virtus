"use client";

import { useState } from "react";
import type {
  CobrancaCompartilhada,
  ItemPublico,
  TicketPublico,
} from "@/modules/publico/publico.types";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";

/**
 * O ticket como o cliente o ve: uma FOLHA A4, igual a que sai na impressora.
 *
 * Nao e um cartao responsivo com os mesmos dados — e o documento. Medidas em
 * `mm` e `pt`, posicoes fixas, e nada de sombra, borda ou fundo colorido nas
 * secoes. Em tela pequena a folha inteira encolhe por `transform: scale()`, sem
 * redistribuir nada por dentro: o que muda de lugar deixa de ser o mesmo papel.
 *
 * O botao de imprimir chama `imprimirRecibo` — o MESMO gerador do botao de PDF
 * do ticket. `pdf.ts` continua no projeto por comparacao, mas quem esta no ar e
 * o recibo.
 */

const VERDE = "#006B29";
const TINTA = "#1D1D1F";
const CINZA = "#86868B";
const REGUA = "#E3E3E3";

/** jsPDF pesa ~400 KB e so serve a quem clica em imprimir. */
const carregarPdf = () => import("@/app/(app)/tickets/pdf-recibo");

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
      const { imprimirRecibo } = await carregarPdf();

      await imprimirRecibo(
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
    <>
      {/*
       * A folha tem largura fixa de 210mm. Em telas menores ela e REDUZIDA
       * inteira, e nao reorganizada — documento que se reflui em duas colunas no
       * celular deixa de ser o papel que a pessoa vai imprimir.
       */}
      <style>{`
        .folha-wrap { display: flex; justify-content: center; }
        .folha {
          width: 210mm; min-height: 297mm; background: #fff;
          box-sizing: border-box; position: relative;
          transform-origin: top center;
          font-family: Helvetica, Arial, sans-serif;
        }
        @media (max-width: 820px) { .folha { transform: scale(0.86); } }
        @media (max-width: 700px) { .folha { transform: scale(0.72); } }
        @media (max-width: 560px) { .folha { transform: scale(0.55); } }
        @media (max-width: 440px) { .folha { transform: scale(0.44); } }
        .folha table { border-collapse: collapse; width: 100%; }
      `}</style>

      <div style={{ width: "100%" }}>
        {cobranca.tickets.map((t) => (
          <div key={t.numero} style={{ marginBottom: 24 }}>
            <div className="folha-wrap">
              <Folha ticket={t} empresa={cobranca.empresa} fatura={cobranca.faturaNumero} />
            </div>

            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => imprimir(t)}
                style={{
                  padding: "10px 18px",
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
                {imprimindo === t.numero ? "Gerando…" : "Baixar em PDF"}
              </button>
            </div>
          </div>
        ))}

        {/* Os arquivos ficam depois do documento: primeiro se confere o que esta
            sendo cobrado, depois se baixa o que serve para pagar. */}
        {(cobranca.temBoleto || cobranca.temNfs) && (
          <div style={{ maxWidth: 320, margin: "24px auto 0" }}>
            {cobranca.temBoleto && (
              <Botao href={`/p/${token}/documento?tipo=boleto`}>Baixar boleto</Botao>
            )}
            {cobranca.temNfs && (
              <Botao href={`/p/${token}/documento?tipo=nfs`} secundario>
                Baixar nota fiscal
              </Botao>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** Uma folha A4 do documento. */
function Folha({
  ticket,
  empresa,
  fatura,
}: {
  ticket: TicketPublico;
  empresa: CobrancaCompartilhada["empresa"];
  fatura: number;
}) {
  const apuracao = periodoEmMeses(ticket.inicio, ticket.fim);

  const subtotal = ticket.itens.reduce(
    (s, i) => s + i.valor * i.quantidade + i.despesas.reduce((d, x) => d + x.valor, 0),
    0,
  );
  const desconto = ticket.itens.reduce((s, i) => s + i.desconto, 0);
  const acrescimo = ticket.itens.reduce((s, i) => s + i.acrescimo, 0);
  const total = ticket.itens.reduce((s, i) => s + i.total, 0);

  const faturado = ticket.cobranca.reduce((s, c) => s + c.valor, 0);
  const pago = ticket.cobranca.filter((c) => c.pago).reduce((s, c) => s + c.valor, 0);

  return (
    <div className="folha">
      {/* Faixa da marca, sangrando de ponta a ponta. */}
      <div style={{ height: "2.8mm", background: VERDE }} />

      <div style={{ padding: "0 14mm", boxSizing: "border-box" }}>
        {/* ── Identificação ─────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            paddingTop: "8.7mm",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "20pt",
                fontWeight: 700,
                color: VERDE,
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              TICKET
            </div>

            <div style={{ marginTop: "5mm" }}>
              <Campo rotulo="Número" valor={String(ticket.numero)} />
              <Campo rotulo="Situação" valor={ticket.situacao || "—"} />
              {apuracao && <Campo rotulo="Apuração" valor={apuracao} />}
            </div>
          </div>

          {empresa.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logo}
              alt=""
              style={{ width: "29mm", height: "9mm", objectFit: "contain", objectPosition: "right top" }}
            />
          )}
        </div>

        {/* ── DE / PARA ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", marginTop: "9mm" }}>
          <div style={{ width: "91mm", paddingRight: "6mm", boxSizing: "border-box" }}>
            <Secao>DE</Secao>
            <Nome>{empresa.razaoSocial ?? "—"}</Nome>
            {empresa.cnpj && <Detalhe>CNPJ {empresa.cnpj}</Detalhe>}
            {empresa.endereco && <Detalhe>{empresa.endereco}</Detalhe>}
          </div>

          <div style={{ width: "91mm", boxSizing: "border-box" }}>
            <Secao>PARA</Secao>
            <Nome>{ticket.cliente.nome ?? "—"}</Nome>
            {ticket.cliente.doc && <Detalhe>{ticket.cliente.doc}</Detalhe>}
            {ticket.cliente.endereco && <Detalhe>{ticket.cliente.endereco}</Detalhe>}
            {ticket.cliente.endereco2 && <Detalhe>{ticket.cliente.endereco2}</Detalhe>}
            {ticket.cliente.centroDeCusto && (
              <Detalhe>Centro de custo: {ticket.cliente.centroDeCusto}</Detalhe>
            )}
          </div>
        </div>

        {/* ── Serviços ──────────────────────────────────────────────────── */}
        <table style={{ marginTop: "14mm" }}>
          <thead>
            <tr>
              <Th>Serviço</Th>
              <Th direita larguraMm={20}>Data</Th>
              <Th direita larguraMm={16}>Qtd.</Th>
              <Th direita larguraMm={22}>Unitário</Th>
              {desconto > 0 && (
                <Th direita larguraMm={22}>
                  Desconto
                </Th>
              )}
              {acrescimo > 0 && (
                <Th direita larguraMm={22}>
                  Acréscimo
                </Th>
              )}
              <Th direita larguraMm={24}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {ticket.itens.map((i, n) => (
              <tr key={n}>
                <Td>
                  <div>{i.servico ?? "Serviço"}</div>
                  {i.descricao && <div style={{ color: CINZA }}>{i.descricao}</div>}
                  {i.despesas.map((d, k) => (
                    <div key={k} style={{ color: CINZA }}>
                      + {d.descricao || "Despesa"} {formatarSemSimbolo(d.valor as Centavos)}
                    </div>
                  ))}
                </Td>
                <Td direita>{i.data ? paraFormatoBR(i.data as DataISO) : "—"}</Td>
                <Td direita>{quantidade(i.quantidade, i.unidade)}</Td>
                <Td direita>{formatarSemSimbolo(i.valor as Centavos)}</Td>
                {desconto > 0 && (
                  <Td direita>{i.desconto ? formatarSemSimbolo(i.desconto as Centavos) : "—"}</Td>
                )}
                {acrescimo > 0 && (
                  <Td direita>{i.acrescimo ? formatarSemSimbolo(i.acrescimo as Centavos) : "—"}</Td>
                )}
                <Td direita>{formatarSemSimbolo(i.total as Centavos)}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        <Resumo
          linhas={[
            { rotulo: "Subtotal", valor: subtotal },
            ...(desconto > 0 ? [{ rotulo: "Desconto", valor: desconto }] : []),
            ...(acrescimo > 0 ? [{ rotulo: "Acréscimo", valor: acrescimo }] : []),
            { rotulo: "Total", valor: total, forte: true },
          ]}
        />

        {/* ── Cobrança ──────────────────────────────────────────────────── */}
        <div style={{ marginTop: "12mm" }}>
          <Secao>COBRANÇA</Secao>

          <table style={{ marginTop: "2mm" }}>
            <thead>
              <tr>
                <Th larguraMm={22}>Fatura</Th>
                <Th larguraMm={20}>Parcela</Th>
                <Th larguraMm={30}>Vencimento</Th>
                <Th direita larguraMm={26}>Valor</Th>
                <Th direita>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {ticket.cobranca.map((c) => (
                <tr key={c.parcela}>
                  <Td>{c.fatura}</Td>
                  <Td>{c.parcela}</Td>
                  <Td>{c.vencimento ? paraFormatoBR(c.vencimento as DataISO) : "—"}</Td>
                  <Td direita>{formatarSemSimbolo(c.valor as Centavos)}</Td>
                  <Td direita>{c.pago ? "Paga" : "Em aberto"}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          <Resumo
            linhas={[
              { rotulo: "Faturado", valor: faturado, forte: true },
              { rotulo: "Valor pago", valor: pago, forte: true },
              { rotulo: "Saldo devedor", valor: faturado - pago, forte: true },
            ]}
          />
        </div>

        {ticket.descricao && (
          <div style={{ marginTop: "12mm" }}>
            <Secao>OBSERVAÇÕES</Secao>
            <div
              style={{
                marginTop: "1.5mm",
                fontSize: "8.5pt",
                color: TINTA,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {ticket.descricao}
            </div>
          </div>
        )}
      </div>

      {/*
       * Rodape colado no pe da folha, e nao depois do conteudo.
       *
       * O branco entre as observacoes e o rodape faz parte do documento: se ele
       * subisse junto com o texto, a folha mudaria de cara conforme o numero de
       * servicos, e duas cobrancas do mesmo cliente nao pareceriam o mesmo papel.
       */}
      <div
        style={{
          position: "absolute",
          left: "14mm",
          right: "14mm",
          bottom: "7mm",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "7.5pt",
          color: CINZA,
        }}
      >
        <span>Fatura {fatura}</span>
        <span>1 / 1</span>
      </div>
    </div>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", lineHeight: 1.65, whiteSpace: "nowrap" }}>
      {/* Largura fixa alinha os tres valores na mesma coluna. `nowrap` porque
          sem ele "Apuração" quebrava e o valor caía para a linha de baixo. */}
      <span style={{ width: "18mm", flexShrink: 0, fontSize: "8.5pt", color: CINZA }}>
        {rotulo}
      </span>
      <span style={{ fontSize: "8.5pt", fontWeight: 700, color: TINTA }}>{valor}</span>
    </div>
  );
}

function Secao({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "7pt",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: CINZA,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function Nome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10pt", fontWeight: 700, color: TINTA, marginTop: "1.5mm" }}>
      {children}
    </div>
  );
}

function Detalhe({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "8.5pt", color: CINZA, lineHeight: 1.45 }}>{children}</div>;
}

function Th({
  children,
  direita,
  larguraMm,
}: {
  children: React.ReactNode;
  direita?: boolean;
  larguraMm?: number;
}) {
  return (
    <th
      style={{
        width: larguraMm ? `${larguraMm}mm` : undefined,
        padding: "0 0 1.5mm",
        textAlign: direita ? "right" : "left",
        fontSize: "7pt",
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: CINZA,
        textTransform: "uppercase",
        borderBottom: `0.3mm solid ${REGUA}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

/**
 * Celula de tabela: preta e sem negrito, sempre.
 *
 * O peso e do cabecalho, que e cinza. Negrito no corpo tira do cabecalho a unica
 * marca que ele tem, e a tabela perde a hierarquia.
 */
function Td({
  children,
  direita,
}: {
  children: React.ReactNode;
  direita?: boolean;
}) {
  return (
    <td
      style={{
        padding: "2mm 0",
        textAlign: direita ? "right" : "left",
        verticalAlign: "top",
        fontSize: "8.5pt",
        fontWeight: 400,
        color: TINTA,
        lineHeight: 1.45,
        borderBottom: `0.3mm solid ${REGUA}`,
      }}
    >
      {children}
    </td>
  );
}

/**
 * Resumo a direita, na largura da coluna de valores.
 *
 * E o que faz o total parecer parte da tabela e nao um bloco solto embaixo dela.
 */
function Resumo({
  linhas,
}: {
  linhas: { rotulo: string; valor: number; forte?: boolean }[];
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2.5mm" }}>
      <div style={{ width: "56mm" }}>
        {linhas.map((l) => (
          <div
            key={l.rotulo}
            style={{
              display: "flex",
              justifyContent: "space-between",
              lineHeight: 1.7,
              fontSize: "8.5pt",
            }}
          >
            <span style={{ color: l.forte ? TINTA : CINZA, fontWeight: l.forte ? 700 : 400 }}>
              {l.rotulo}
            </span>
            <span style={{ color: TINTA, fontWeight: l.forte ? 700 : 400 }}>
              {formatarSemSimbolo(l.valor as Centavos)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horas saem como "12h30" — o decimal é o formato de quem calcula, não de quem lê. */
function quantidade(q: number, unidade: ItemPublico["unidade"]): string {
  if (unidade === "H") {
    const minutos = Math.round(q * 60);
    const m = minutos % 60;
    return m === 0
      ? `${minutos / 60}h`
      : `${Math.floor(minutos / 60)}h${String(m).padStart(2, "0")}`;
  }
  return Number.isInteger(q) ? `${q} un` : `${q.toFixed(2).replace(".", ",")} un`;
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
        padding: "14px 28px",
        marginBottom: 10,
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        textAlign: "center",
        textDecoration: "none",
        fontFamily: "Helvetica, Arial, sans-serif",
        border: secundario ? `1px solid ${VERDE}` : "none",
        background: secundario ? "transparent" : VERDE,
        color: secundario ? VERDE : "#ffffff",
      }}
    >
      {children}
    </a>
  );
}
