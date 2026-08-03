import jsPDF from "jspdf";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { carregarLogo } from "../tickets/pdf";

/**
 * Recibo de pagamento de uma parcela.
 *
 * Mesma linguagem visual do documento do ticket — faixa verde, emitente à
 * esquerda, tipografia da Apple, régua fina em vez de linha inteira pintada —
 * porque quem recebe os dois reconhece a mesma origem.
 *
 * O que muda é o propósito: o ticket **cobra**, o recibo **comprova**. Por isso
 * ele nasce só de parcela já baixada, tem a frase de quitação por extenso e
 * assinatura no rodapé. Um "recibo" de algo em aberto seria um documento que
 * afirma o que não aconteceu.
 */

const MARGEM = 40;
const VERDE: [number, number, number] = [0, 106, 40];
const TINTA: [number, number, number] = [29, 29, 31];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];

export type ReciboParaPDF = {
  numeroConta: number;
  parcela: number;
  totalParcelas: number;
  valor: number;
  vencimento: string | null;
  /** Quando a baixa foi registrada. Sem ela o recibo nao tem data do fato. */
  pagoEm: string | null;
  clienteNome: string | null;
  clienteDoc: string | null;
  /** Os tickets que a conta cobre. E a referencia que o cliente reconhece. */
  tickets: { numero: number; titulo: string }[];
  emitente: {
    razaoSocial: string | null;
    endereco: string | null;
    cnpj: string | null;
    logo: string | null;
  };
};

export async function imprimirReciboDePagamento(
  r: ReciboParaPDF,
  emitidoPor: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const direita = largura - MARGEM;

  // Faixa da marca, sangrando de ponta a ponta.
  doc.setFillColor(...VERDE).rect(0, 0, largura, 8, "F");

  let y = MARGEM + 18;

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  const logo = await carregarLogo(r.emitente.logo);
  if (logo) {
    const proporcao = logo.largura / logo.altura;
    doc.addImage(logo.dados, "PNG", direita - 26 * proporcao, MARGEM, 26 * proporcao, 26);
  }

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...VERDE);
  doc.text("RECIBO DE PAGAMENTO", MARGEM, y);

  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  doc.text("Conta", MARGEM, y);
  doc.text("Parcela", MARGEM, y + 13);
  doc.text("Pago em", MARGEM, y + 26);

  doc.setFont("helvetica", "bold").setTextColor(...TINTA);
  doc.text(String(r.numeroConta), MARGEM + 56, y);
  doc.text(`${r.parcela} de ${r.totalParcelas}`, MARGEM + 56, y + 13);
  doc.text(r.pagoEm ? paraFormatoBR(r.pagoEm.slice(0, 10) as DataISO) : "—", MARGEM + 56, y + 26);

  y += 52;

  // ── Emitente e pagador ────────────────────────────────────────────────────
  const meio = MARGEM + (largura - MARGEM * 2) / 2;

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text("RECEBEMOS DE", MARGEM, y);
  doc.text("EMITIDO POR", meio, y);

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TINTA);
  doc.text(r.clienteNome ?? "—", MARGEM, y + 14);
  doc.text(r.emitente.razaoSocial ?? "—", meio, y + 14);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
  if (r.clienteDoc) doc.text(r.clienteDoc, MARGEM, y + 26);
  if (r.emitente.cnpj) doc.text(`CNPJ ${r.emitente.cnpj}`, meio, y + 26);
  if (r.emitente.endereco) {
    doc.text(doc.splitTextToSize(r.emitente.endereco, meio - MARGEM - 20), meio, y + 37);
  }

  y += 62;

  // ── A quantia, por extenso do jeito que se lê num recibo ─────────────────
  doc.setDrawColor(...REGUA).setLineWidth(0.6);
  doc.line(MARGEM, y, direita, y);

  y += 26;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  doc.text("A importância de", MARGEM, y);

  doc.setFont("helvetica", "bold").setFontSize(24).setTextColor(...VERDE);
  doc.text(`R$ ${formatarSemSimbolo(r.valor as Centavos)}`, MARGEM, y + 26);

  y += 48;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...TINTA);
  const referencia =
    r.tickets.length === 0
      ? `referente à conta ${r.numeroConta}`
      : r.tickets.length === 1
        ? `referente ao ticket ${r.tickets[0].numero}`
        : `referente aos tickets ${r.tickets.map((t) => t.numero).join(", ")}`;

  const frase =
    `Declaramos para os devidos fins que recebemos a quantia acima, ${referencia}` +
    `${r.vencimento ? `, com vencimento em ${paraFormatoBR(r.vencimento.slice(0, 10) as DataISO)}` : ""}` +
    `, dando plena e geral quitação desta parcela.`;

  doc.text(doc.splitTextToSize(frase, largura - MARGEM * 2), MARGEM, y, { lineHeightFactor: 1.5 });

  // ── Itens cobertos ────────────────────────────────────────────────────────
  if (r.tickets.length > 0) {
    y += 46;
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
    doc.text("REFERENTE A", MARGEM, y);

    y += 12;
    doc.setDrawColor(...REGUA);
    doc.line(MARGEM, y, direita, y);

    for (const t of r.tickets) {
      y += 16;
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
      doc.text(`Ticket ${t.numero}`, MARGEM, y);
      if (t.titulo && t.titulo !== String(t.numero)) {
        doc.setTextColor(...CINZA);
        doc.text(doc.splitTextToSize(t.titulo, 320), MARGEM + 70, y);
      }
      doc.setDrawColor(...REGUA);
      doc.line(MARGEM, y + 5, direita, y + 5);
    }
  }

  // ── Assinatura, colada no pé ──────────────────────────────────────────────
  //
  // Fixa embaixo e não depois do texto: recibo é documento, e o mesmo desenho
  // em toda emissão é o que faz um documento parecer confiável.
  const linhaAssinatura = altura - MARGEM - 44;
  doc.setDrawColor(...TINTA).setLineWidth(0.8);
  doc.line(largura / 2 - 110, linhaAssinatura, largura / 2 + 110, linhaAssinatura);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
  doc.text(r.emitente.razaoSocial ?? "—", largura / 2, linhaAssinatura + 13, { align: "center" });

  doc.setFontSize(7.5).setTextColor(...CINZA);
  doc.text(
    `Emitido em ${paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO)}${emitidoPor ? ` por ${emitidoPor}` : ""}`,
    MARGEM,
    altura - MARGEM,
  );
  doc.text("1 / 1", direita, altura - MARGEM, { align: "right" });

  doc.save(`recibo-${r.numeroConta}-${r.parcela}.pdf`);
}

/**
 * Resumo da conta a receber inteira.
 *
 * Nao e o recibo: o recibo comprova UMA parcela paga; este mostra o acordo
 * completo — de onde vem, quanto e, em quantas vezes, e o que ja entrou. E o
 * papel que se manda quando o cliente pergunta "como ficou?".
 */
export type ResumoParaPDF = {
  numeroConta: number;
  situacao: string;
  competencia: string | null;
  clienteNome: string | null;
  clienteDoc: string | null;
  total: number;
  pago: number;
  tickets: { numero: number; titulo: string; valor: number }[];
  parcelas: {
    numero: number;
    vencimento: string | null;
    total: number;
    desconto: number;
    pago: boolean;
  }[];
  emitente: ReciboParaPDF["emitente"];
};

export async function imprimirResumoDaConta(
  r: ResumoParaPDF,
  emitidoPor: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const direita = largura - MARGEM;

  doc.setFillColor(...VERDE).rect(0, 0, largura, 8, "F");

  let y = MARGEM + 18;

  const logo = await carregarLogo(r.emitente.logo);
  if (logo) {
    const p = logo.largura / logo.altura;
    doc.addImage(logo.dados, "PNG", direita - 26 * p, MARGEM, 26 * p, 26);
  }

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...VERDE);
  doc.text("CONTA A RECEBER", MARGEM, y);

  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  doc.text("Número", MARGEM, y);
  doc.text("Situação", MARGEM, y + 13);
  if (r.competencia) doc.text("Apuração", MARGEM, y + 26);

  doc.setFont("helvetica", "bold").setTextColor(...TINTA);
  doc.text(String(r.numeroConta), MARGEM + 56, y);
  doc.text(r.situacao, MARGEM + 56, y + 13);
  if (r.competencia) doc.text(r.competencia, MARGEM + 56, y + 26);

  y += r.competencia ? 50 : 37;

  // ── Partes ────────────────────────────────────────────────────────────────
  const meio = MARGEM + (largura - MARGEM * 2) / 2;

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text("DE", MARGEM, y);
  doc.text("PARA", meio, y);

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TINTA);
  doc.text(r.emitente.razaoSocial ?? "—", MARGEM, y + 14);
  doc.text(r.clienteNome ?? "—", meio, y + 14);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
  if (r.emitente.cnpj) doc.text(`CNPJ ${r.emitente.cnpj}`, MARGEM, y + 26);
  if (r.clienteDoc) doc.text(r.clienteDoc, meio, y + 26);
  if (r.emitente.endereco) {
    doc.text(doc.splitTextToSize(r.emitente.endereco, meio - MARGEM - 20), MARGEM, y + 37);
  }

  y += 62;

  // ── De onde vem ───────────────────────────────────────────────────────────
  if (r.tickets.length > 0) {
    y = secao(doc, "COMPOSIÇÃO", y, MARGEM, direita);

    for (const t of r.tickets) {
      y += 16;
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
      doc.text(`Ticket ${t.numero}`, MARGEM, y);
      if (t.titulo && t.titulo !== String(t.numero)) {
        doc.setTextColor(...CINZA);
        doc.text(doc.splitTextToSize(t.titulo, 280), MARGEM + 70, y);
      }
      doc.setFont("helvetica", "normal").setTextColor(...TINTA);
      doc.text(formatarSemSimbolo(t.valor as Centavos), direita, y, { align: "right" });
      doc.setDrawColor(...REGUA).line(MARGEM, y + 5, direita, y + 5);
    }
    y += 22;
  }

  // ── Como se paga ──────────────────────────────────────────────────────────
  y = secao(doc, "PARCELAS", y, MARGEM, direita);

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text("VENCIMENTO", MARGEM + 30, y + 12);
  doc.text("SITUAÇÃO", MARGEM + 150, y + 12);
  doc.text("VALOR", direita, y + 12, { align: "right" });
  y += 12;
  doc.setDrawColor(...REGUA).line(MARGEM, y + 5, direita, y + 5);

  for (const p of r.parcelas) {
    y += 16;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
    doc.text(String(p.numero), MARGEM, y);
    doc.text(p.vencimento ? paraFormatoBR(p.vencimento.slice(0, 10) as DataISO) : "—", MARGEM + 30, y);

    doc.setTextColor(...(p.pago ? VERDE : CINZA));
    doc.text(p.pago ? "Paga" : "Em aberto", MARGEM + 150, y);

    doc.setTextColor(...TINTA);
    doc.text(formatarSemSimbolo(p.total as Centavos), direita, y, { align: "right" });
    doc.setDrawColor(...REGUA).line(MARGEM, y + 5, direita, y + 5);
  }

  // ── Fechamento ────────────────────────────────────────────────────────────
  y += 26;
  const rotulo = direita - 150;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  doc.text("Total", rotulo, y);
  doc.text("Recebido", rotulo, y + 15);

  doc.setTextColor(...TINTA);
  doc.text(formatarSemSimbolo(r.total as Centavos), direita, y, { align: "right" });
  doc.setTextColor(...VERDE);
  doc.text(formatarSemSimbolo(r.pago as Centavos), direita, y + 15, { align: "right" });

  doc.setDrawColor(...REGUA).line(rotulo, y + 22, direita, y + 22);

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TINTA);
  doc.text("Em aberto", rotulo, y + 38);
  doc.text(formatarSemSimbolo((r.total - r.pago) as Centavos), direita, y + 38, { align: "right" });

  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
  doc.text(
    `Emitido em ${paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO)}${emitidoPor ? ` por ${emitidoPor}` : ""}`,
    MARGEM,
    altura - MARGEM,
  );
  doc.text("1 / 1", direita, altura - MARGEM, { align: "right" });

  doc.save(`conta-${r.numeroConta}.pdf`);
}

/** Titulo de secao com a regua embaixo. Repetido tres vezes; vale a funcao. */
function secao(doc: jsPDF, titulo: string, y: number, esquerda: number, direita: number): number {
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text(titulo, esquerda, y);
  doc.setDrawColor(...REGUA).setLineWidth(0.6).line(esquerda, y + 6, direita, y + 6);
  return y + 6;
}
