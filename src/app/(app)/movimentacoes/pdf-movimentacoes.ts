import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { carregarLogo } from "@/app/(app)/tickets/pdf-base";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import type { Movimentacao } from "@/modules/movimentacoes/movimentacoes.types";

/**
 * O historico de transferencias entre contas, em PDF.
 *
 * Mesmo template dos outros documentos do sistema — faixa da marca no topo,
 * titulo a esquerda e logo a direita, identificacao em pares rotulo/valor, regua
 * fina no lugar de linha pintada, rodape com quem emitiu e a paginacao.
 *
 * ⚠️ EM PE. Sao seis colunas e duas delas sao nome de conta; deitado sobraria
 * meia folha.
 *
 * ⚠️ NAO e o extrato. O extrato mostra TUDO que passou por uma conta, com saldo
 * de abertura e fecho por dia, e ja existe no drawer de Contas e saldo. Este
 * documento responde outra pergunta: o que trocou de lugar entre as contas da
 * empresa, e quem mandou. Nenhuma linha aqui e receita ou despesa.
 */

const MARGEM = 40;

/* Azul da marca (#0a52b9). jsPDF quer RGB numerico, entao o token de
   `globals.css` nao chega aqui — se a marca mudar, muda tambem aqui. */
const AZUL: [number, number, number] = [10, 82, 185];
const TINTA: [number, number, number] = [16, 16, 18];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];

/** Altura reservada ao rodape, em pontos. */
const RODAPE = 56;

export async function imprimirMovimentacoes(
  linhas: Movimentacao[],
  periodo: { de: DataISO; ate: DataISO },
  /** Nulo quando o documento cobre todas as contas. */
  conta: string | null,
  empresa: EmpresaParaDocumento,
  emitidoPor: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  let y = await cabecalho(doc, empresa, direita, largura);
  y = identificacao(doc, empresa, periodo, conta, linhas, y);

  if (linhas.length === 0) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(9)
      .setTextColor(...CINZA);
    doc.text("Nenhuma transferência no período.", MARGEM, y + 8);
  } else {
    grade(doc, linhas, y, largura);
  }

  rodape(doc, emitidoPor, largura);

  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

// ── Cabeçalho ───────────────────────────────────────────────────────────────

async function cabecalho(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  direita: number,
  largura: number,
): Promise<number> {
  // Faixa de ponta a ponta no topo, colada na borda: dá ao documento uma
  // identidade que sobrevive à fotocópia e ao arquivo em pasta, sem gastar
  // altura de conteúdo.
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, largura, 8, "F");

  const y = MARGEM;

  doc
    .setFont("helvetica", "bold")
    .setFontSize(20)
    .setTextColor(...AZUL);
  doc.text("Movimentações", MARGEM, y + 14);

  /* Só a marca no topo: o nome da empresa desce para a identificação, e nos
     dois lugares ele apareceria duas vezes na mesma dobra. */
  const logo = await carregarLogo(empresa.logo);
  if (logo) {
    const altura = 26;
    const larguraLogo = altura * (logo.largura / logo.altura);
    doc.addImage(logo.dados, "PNG", direita - larguraLogo, y - 4, larguraLogo, altura);
  }

  return y + 32;
}

/**
 * Empresa, periodo, recorte de conta e o quanto se moveu.
 *
 * ⚠️ A CONTA so aparece quando ha recorte. "Todas as contas" escrito em todo
 * documento seria ruido em nove de cada dez; quando o recorte existe, ele e a
 * diferenca entre dois papeis com o mesmo titulo e a mesma data.
 */
function identificacao(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  periodo: { de: DataISO; ate: DataISO },
  conta: string | null,
  linhas: Movimentacao[],
  y: number,
): number {
  const pares: [string, string][] = [
    ["Empresa", empresa.razaoSocial ?? "—"],
    ["CNPJ", empresa.cnpj ?? "—"],
    ["Período", `${paraFormatoBR(periodo.de)} a ${paraFormatoBR(periodo.ate)}`],
  ];

  if (conta) pares.push(["Conta", conta]);

  /*
   * ⚠️ "Movimentado" e nao "total": este numero nao e entrada nem saida. Ele
   * conta o quanto trocou de lugar, e somar isso ao caixa contaria duas vezes o
   * mesmo dinheiro.
   */
  if (linhas.length > 0) {
    const soma = linhas.reduce((t, m) => t + m.valor, 0) as Centavos;
    pares.push(["Movimentado", formatarSemSimbolo(soma)]);
  }

  let linha = y;
  for (const [rotulo, valor] of pares) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8.5)
      .setTextColor(...CINZA);
    doc.text(`${rotulo}:`, MARGEM, linha);

    doc.setFont("helvetica", "bold").setTextColor(...TINTA);
    doc.text(valor, MARGEM + 62, linha);

    linha += 13;
  }

  return linha + 10;
}

// ── A grade ─────────────────────────────────────────────────────────────────

function grade(doc: jsPDF, linhas: Movimentacao[], y: number, largura: number): void {
  const larguraUtil = largura - MARGEM * 2;

  const corpo: RowInput[] = linhas.map((m) => [
    String(m.numero ?? "—"),
    paraFormatoBR(m.data),
    /* Observação como segunda linha do nome, e não coluna: ela é texto livre e
       em coluna própria empurraria o valor para fora da folha. */
    m.observacoes ? `${m.origemNome}\n${m.observacoes}` : m.origemNome,
    m.destinoNome,
    formatarSemSimbolo(m.valor),
    m.criadoPor ?? "—",
  ]);

  const COL_NUM = 34;
  const COL_DATA = 60;
  const COL_VALOR = 78;
  const COL_AUTOR = 96;
  const COL_CONTA = (larguraUtil - COL_NUM - COL_DATA - COL_VALOR - COL_AUTOR) / 2;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, bottom: RODAPE },
    tableWidth: larguraUtil,
    theme: "plain",
    head: [
      [
        { content: "Nº", styles: { halign: "left" as const } },
        { content: "Data", styles: { halign: "left" as const } },
        { content: "Origem", styles: { halign: "left" as const } },
        { content: "Destino", styles: { halign: "left" as const } },
        "Valor",
        { content: "Lançado por", styles: { halign: "left" as const } },
      ],
    ],
    body: corpo,
    styles: {
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 0, right: 0 },
      textColor: TINTA,
      lineColor: REGUA,
      overflow: "hidden",
    },
    headStyles: {
      fontSize: 6.5,
      fontStyle: "bold",
      textColor: CINZA,
      lineWidth: { bottom: 0.8 },
      lineColor: REGUA,
      halign: "right",
    },
    bodyStyles: {
      lineWidth: { bottom: 0.5 },
      lineColor: REGUA,
      halign: "right",
    },
    columnStyles: {
      0: { cellWidth: COL_NUM, halign: "left" },
      1: { cellWidth: COL_DATA, halign: "left" },
      2: {
        cellWidth: COL_CONTA,
        halign: "left",
        overflow: "linebreak",
        cellPadding: { top: 5, bottom: 5, left: 0, right: 8 },
      },
      3: {
        cellWidth: COL_CONTA,
        halign: "left",
        cellPadding: { top: 5, bottom: 5, left: 0, right: 8 },
      },
      4: { cellWidth: COL_VALOR },
      5: { cellWidth: COL_AUTOR, halign: "left" },
    },
  });
}

function rodape(doc: jsPDF, emitidoPor: string, largura: number): void {
  const total = doc.getNumberOfPages();
  const altura = doc.internal.pageSize.getHeight();
  const emissao = paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO);

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(7.5)
      .setTextColor(...CINZA);
    doc.text(`Emitido em ${emissao} por ${emitidoPor}`, MARGEM, altura - 20);
    doc.text(`${pagina} / ${total}`, largura - MARGEM, altura - 20, { align: "right" });
  }
}
