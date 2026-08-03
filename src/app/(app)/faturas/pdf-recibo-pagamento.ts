import jsPDF from "jspdf";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { valorPorExtenso } from "@/shared/utils/extenso";
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
  tickets: { numero: number; titulo: string; valor: number; data: string | null }[];
  /** As que ainda faltam. Quem assina o recibo quer saber o que sobra. */
  emAberto: { numero: number; vencimento: string | null; total: number }[];
  /** O fechamento da CONTA, nao desta parcela: e o que sobra depois dela. */
  totalConta: number;
  pagoConta: number;
  descontoConta: number;
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

  // ── Quem pagou ────────────────────────────────────────────────────────────
  //
  // Sem rotulo: nome grande logo abaixo de "RECIBO DE PAGAMENTO" so pode ser de
  // quem pagou, e a etiqueta gastava uma linha para dizer o obvio.
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...TINTA);
  doc.text(r.clienteNome ?? "—", MARGEM, y);

  if (r.clienteDoc) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(r.clienteDoc, MARGEM, y + 13);
  }

  y += 34;

  // ── A quantia, por extenso do jeito que se lê num recibo ─────────────────
  //
  // Sem regua acima: o espaco ja separa, e a linha logo abaixo do nome do
  // cliente parecia fechar um bloco que nao tinha comecado.
  y += 10;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  doc.text("A importância de", MARGEM, y);

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...VERDE);
  doc.text(`R$ ${formatarSemSimbolo(r.valor as Centavos)}`, MARGEM, y + 20);

  /*
   * O valor tambem por extenso.
   *
   * E o que impede alterar um algarismo depois de assinado: "1.500,00" vira
   * "5.500,00" com uma canetada; "mil e quinhentos reais" nao.
   */
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...TINTA);
  doc.text(
    doc.splitTextToSize(`(${valorPorExtenso(r.valor)})`, largura - MARGEM * 2),
    MARGEM,
    y + 34,
  );

  y += 52;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...TINTA);
  doc.text(
    doc.splitTextToSize(
      "Declaramos para os devidos fins que recebemos a quantia acima, referente ao que segue, " +
        "dando plena e geral quitação desta parcela.",
      largura - MARGEM * 2,
    ),
    MARGEM,
    y,
    { lineHeightFactor: 1.5 },
  );

  y += 44;

  // ── Composição, no mesmo desenho do resumo ────────────────────────────────
  if (r.tickets.length > 0) {
    y = composicao(doc, r.tickets, y, direita);
  }

  // ── O que ainda falta ─────────────────────────────────────────────────────
  //
  // Quem assina um recibo de parcela quer saber o que sobra. Sem isso o
  // documento comprova o pedaço e cala sobre o todo.
  if (r.emAberto.length > 0) {
    y += 34;
    y = secao(doc, "PARCELAS EM ABERTO", y, MARGEM, direita);
    y = colunas(doc, y, direita, [
      { texto: "PARCELA", x: MARGEM },
      { texto: "VENCIMENTO", x: MARGEM + 62 },
      { texto: "VALOR", x: direita, direita: true },
    ]);

    for (const p of r.emAberto) {
      y += 15;
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
      doc.text(String(p.numero), MARGEM, y);
      doc.setTextColor(...CINZA);
      doc.text(
        p.vencimento ? paraFormatoBR(p.vencimento.slice(0, 10) as DataISO) : "—",
        MARGEM + 62,
        y,
      );
      doc.setTextColor(...TINTA);
      doc.text(formatarSemSimbolo(p.total as Centavos), direita, y, { align: "right" });
      doc.setDrawColor(...REGUA).line(MARGEM, y + 5, direita, y + 5);
    }
  }

  // ── O fechamento da conta ─────────────────────────────────────────────────
  //
  // Do TODO, nao desta parcela: o valor dela ja esta em destaque la em cima. O
  // que falta saber, depois de pagar uma, e quanto sobra.
  y += 30;
  fechamento(doc, y, direita, {
    total: r.totalConta,
    pago: r.pagoConta,
    desconto: r.descontoConta,
  });

  // ── Assinatura, colada no pé ──────────────────────────────────────────────
  //
  // Fixa embaixo e não depois do texto: recibo é documento, e o mesmo desenho
  // em toda emissão é o que faz um documento parecer confiável.
  const linhaAssinatura = altura - MARGEM - 44;

  /*
   * Data e assinatura na MESMA linha, como num recibo de talao.
   *
   * A data em branco porque o recibo se assina na hora da entrega: a data do
   * papel e a do gesto, nao a do arquivo. Empilhada acima da assinatura ela
   * parecia um campo separado, e nao parte do mesmo ato.
   */
  const larguraData = 118;
  const inicioData = MARGEM + 24;
  const inicioAssinatura = inicioData + larguraData + 26;

  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...TINTA);
  doc.text("____ / ____ / ________", inicioData, linhaAssinatura - 3);

  doc.setDrawColor(...TINTA).setLineWidth(0.8);
  doc.line(inicioAssinatura, linhaAssinatura, direita - 24, linhaAssinatura);

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
  const centroAssinatura = (inicioAssinatura + direita - 24) / 2;
  doc.text(r.emitente.razaoSocial ?? "—", centroAssinatura, linhaAssinatura + 13, {
    align: "center",
  });

  if (r.emitente.cnpj) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
    doc.text(`CNPJ ${r.emitente.cnpj}`, centroAssinatura, linhaAssinatura + 23, {
      align: "center",
    });
  }

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
  /** Somado das parcelas. Sem ele os numeros nao fecham e parece erro de conta. */
  desconto: number;
  tickets: { numero: number; titulo: string; valor: number; data: string | null }[];
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

  // ── Para quem ─────────────────────────────────────────────────────────────
  //
  // Sem rotulo, e sem a coluna do emitente: a marca ja esta no topo, o emitente
  // e sempre o mesmo, e o unico nome nesta altura so pode ser o do cliente.
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...TINTA);
  doc.text(r.clienteNome ?? "—", MARGEM, y);

  if (r.clienteDoc) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(r.clienteDoc, MARGEM, y + 13);
  }

  y += 34;

  // ── De onde vem ───────────────────────────────────────────────────────────
  if (r.tickets.length > 0) {
    y = composicao(doc, r.tickets, y, direita);
    // Respiro entre as duas tabelas: coladas, pareciam uma so de duas partes.
    y += 34;
  }

  // ── Como se paga ──────────────────────────────────────────────────────────
  y = secao(doc, "PARCELAS", y, MARGEM, direita);
  y = colunas(doc, y, direita, [
    { texto: "PARCELA", x: MARGEM },
    { texto: "VENCIMENTO", x: MARGEM + 62 },
    { texto: "SITUAÇÃO", x: MARGEM + 160 },
    { texto: "VALOR", x: direita, direita: true },
  ]);

  for (const p of r.parcelas) {
    y += 16;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
    doc.text(String(p.numero), MARGEM, y);
    doc.text(p.vencimento ? paraFormatoBR(p.vencimento.slice(0, 10) as DataISO) : "—", MARGEM + 62, y);

    doc.setTextColor(...(p.pago ? VERDE : CINZA));
    doc.text(p.pago ? "Paga" : "Em aberto", MARGEM + 160, y);

    doc.setTextColor(...TINTA);
    doc.text(formatarSemSimbolo(p.total as Centavos), direita, y, { align: "right" });
    doc.setDrawColor(...REGUA).line(MARGEM, y + 5, direita, y + 5);
  }

  // ── Fechamento ────────────────────────────────────────────────────────────
  y += 30;
  fechamento(doc, y, direita, {
    total: r.total,
    pago: r.pago,
    desconto: r.desconto,
  });

  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
  doc.text(
    `Emitido em ${paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO)}${emitidoPor ? ` por ${emitidoPor}` : ""}`,
    MARGEM,
    altura - MARGEM,
  );
  doc.text("1 / 1", direita, altura - MARGEM, { align: "right" });

  doc.save(`conta-${r.numeroConta}.pdf`);
}

/**
 * A tabela de composicao: de onde vem o dinheiro.
 *
 * TICKET, DATA e VALOR, com cabecalho. Sem ele a primeira coluna virava um
 * numero solto que se confundia com o da conta, la em cima.
 */
function composicao(
  doc: jsPDF,
  tickets: { numero: number; titulo: string; valor: number; data: string | null }[],
  y: number,
  direita: number,
): number {
  let atual = secao(doc, "COMPOSIÇÃO", y, MARGEM, direita);

  atual = colunas(doc, atual, direita, [
    { texto: "TICKET", x: MARGEM },
    { texto: "DATA", x: MARGEM + 62 },
    { texto: "VALOR", x: direita, direita: true },
  ]);

  for (const t of tickets) {
    atual += 16;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
    doc.text(String(t.numero), MARGEM, atual);

    doc.setTextColor(...CINZA);
    doc.text(t.data ? paraFormatoBR(t.data.slice(0, 10) as DataISO) : "—", MARGEM + 62, atual);

    doc.setTextColor(...TINTA);
    doc.text(formatarSemSimbolo(t.valor as Centavos), direita, atual, { align: "right" });

    doc.setDrawColor(...REGUA).line(MARGEM, atual + 5, direita, atual + 5);
  }
  return atual;
}

/**
 * O fechamento: total, recebido, desconto e o que sobra.
 *
 * O desconto entra porque sem ele os numeros nao fecham — quem soma total menos
 * recebido acha uma diferenca e pensa que ha parcela esquecida. Ele so aparece
 * quando existe: uma linha "Desconto 0,00" e ruido em toda conta normal.
 *
 * "Em aberto" desconta os dois: o abatido nao volta a ser cobravel. Ver docs/10.
 */
function fechamento(
  doc: jsPDF,
  y: number,
  direita: number,
  v: { total: number; pago: number; desconto: number },
): number {
  const rotulo = direita - 160;
  const linhas: { texto: string; valor: number; cor: [number, number, number] }[] = [
    { texto: "Total", valor: v.total, cor: TINTA },
    { texto: "Recebido", valor: v.pago, cor: VERDE },
  ];
  if (v.desconto > 0) linhas.push({ texto: "Desconto", valor: v.desconto, cor: CINZA });

  let atual = y;
  doc.setFont("helvetica", "normal").setFontSize(9);
  for (const l of linhas) {
    doc.setTextColor(...CINZA);
    doc.text(l.texto, rotulo, atual);
    doc.setTextColor(...l.cor);
    doc.text(formatarSemSimbolo(l.valor as Centavos), direita, atual, { align: "right" });
    atual += 15;
  }

  doc.setFont("helvetica", "bold").setTextColor(...TINTA);
  doc.text("Em aberto", rotulo, atual);
  doc.text(formatarSemSimbolo((v.total - v.pago - v.desconto) as Centavos), direita, atual, {
    align: "right",
  });

  return atual;
}

/** A linha de cabecalho de uma tabela, com a regua embaixo. */
function colunas(
  doc: jsPDF,
  y: number,
  direita: number,
  cols: { texto: string; x: number; direita?: boolean }[],
): number {
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  for (const c of cols) {
    doc.text(c.texto, c.x, y + 14, c.direita ? { align: "right" } : undefined);
  }
  doc.setDrawColor(...REGUA).setLineWidth(0.6).line(MARGEM, y + 19, direita, y + 19);
  return y + 19;
}

/** Titulo de secao com a regua embaixo. Repetido tres vezes; vale a funcao. */
function secao(doc: jsPDF, titulo: string, y: number, esquerda: number, direita: number): number {
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text(titulo, esquerda, y);
  doc.setDrawColor(...REGUA).setLineWidth(0.6).line(esquerda, y + 6, direita, y + 6);
  return y + 6;
}
