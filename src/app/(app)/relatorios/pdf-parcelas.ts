import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { carregarLogo } from "@/app/(app)/tickets/pdf-base";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import type { Relatorio } from "@/modules/relatorios/relatorios.types";

/**
 * O relatorio de parcelas em aberto, em PDF.
 *
 * Mesmo template dos outros documentos do sistema — faixa da marca no topo,
 * titulo a esquerda e logo a direita, identificacao em pares rotulo/valor, regua
 * fina no lugar de linha pintada, rodape com quem emitiu e a paginacao.
 *
 * ⚠️ EM PE (`portrait`), ao contrario da DRE e do fluxo. Sao seis colunas e uma
 * delas e nome de gente: deitado, "CONSTRUMART MATERIAL DE CONSTRUCAO LTDA"
 * caberia com folga e as outras cinco ficariam com o dobro da largura que o
 * numero precisa, com metade da folha vazia.
 *
 * ⚠️ UMA TABELA POR MES, e nao uma tabela so com linha de subtotal.
 *
 * O subtotal e o que se veio ler, e como linha no meio de uma grade longa ele se
 * perde entre as parcelas. Cada mes fechando a sua propria tabela poe o total
 * onde o olho ja esta quando termina o bloco — e deixa o autotable quebrar
 * pagina entre meses, em vez de no meio de um.
 */

const MARGEM = 40;

/* Azul da marca (#0a52b9). jsPDF quer RGB numerico, entao o token de
   `globals.css` nao chega aqui — se a marca mudar, muda tambem aqui. */
const AZUL: [number, number, number] = [10, 82, 185];
const TINTA: [number, number, number] = [16, 16, 18];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];
const VERMELHO: [number, number, number] = [185, 28, 28];

/** Altura reservada ao rodape, em pontos. */
const RODAPE = 56;

const MESES_POR_EXTENSO = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export async function imprimirParcelas(
  relatorio: Relatorio,
  empresa: EmpresaParaDocumento,
  emitidoPor: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  const recebe = relatorio.lado === "receber";
  const titulo = recebe ? "Contas a receber" : "Contas a pagar";

  let y = await cabecalho(doc, empresa, titulo, direita, largura);
  y = identificacao(doc, empresa, relatorio, y);

  const ciclos = relatorio.cartao?.ciclos ?? [];

  if (relatorio.meses.length === 0 && ciclos.length === 0) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(9)
      .setTextColor(...CINZA);
    doc.text(
      recebe ? "Nada a receber neste período." : "Nada a pagar neste período.",
      MARGEM,
      y + 8,
    );
    rodape(doc, emitidoPor, largura);
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
    return;
  }

  for (const mes of relatorio.meses) {
    y = bloco(doc, relatorio, mes, y, largura);
  }

  if (ciclos.length > 0) cartao(doc, relatorio, y, largura);

  fecho(doc, relatorio, largura);
  rodape(doc, emitidoPor, largura);

  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

// ── Cabeçalho ───────────────────────────────────────────────────────────────

async function cabecalho(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  titulo: string,
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
  doc.text(titulo, MARGEM, y + 14);

  /* Só a marca no topo: o nome da empresa desce para a identificação, e nos
     dois lugares ele apareceria duas vezes na mesma dobra. */
  const logo = await carregarLogo(empresa.logo);
  if (logo) {
    const altura = 26;
    const larguraLogo = altura * (logo.largura / logo.altura);
    doc.addImage(
      logo.dados,
      "PNG",
      direita - larguraLogo,
      y - 4,
      larguraLogo,
      altura,
    );
  }

  return y + 32;
}

/**
 * Quem emitiu, sobre que periodo, e quanto ja venceu.
 *
 * ⚠️ O VENCIDO entra aqui, e nao so espalhado nas linhas. Ele e a pergunta que
 * faz alguem imprimir isto: quanto esta atrasado. Descobrir somando a coluna de
 * atraso a mao seria pedir que o leitor fizesse a conta que o documento existe
 * para dar pronta.
 */
function identificacao(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  relatorio: Relatorio,
  y: number,
): number {
  const pares: [string, string][] = [
    ["Empresa", empresa.razaoSocial ?? "—"],
    ["CNPJ", empresa.cnpj ?? "—"],
    [
      "Período",
      `${paraFormatoBR(relatorio.de as DataISO)} a ${paraFormatoBR(relatorio.ate as DataISO)}`,
    ],
  ];

  if (relatorio.vencido > 0) {
    pares.push(["Vencido", formatarSemSimbolo(relatorio.vencido)]);
  }

  let linha = y;
  for (const [rotulo, valor] of pares) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8.5)
      .setTextColor(...CINZA);
    doc.text(`${rotulo}:`, MARGEM, linha);

    doc.setFont("helvetica", "bold").setTextColor(...TINTA);
    doc.text(valor, MARGEM + 56, linha);

    linha += 13;
  }

  return linha + 10;
}

// ── Um mês ──────────────────────────────────────────────────────────────────

function bloco(
  doc: jsPDF,
  relatorio: Relatorio,
  mes: Relatorio["meses"][number],
  y: number,
  largura: number,
): number {
  const larguraUtil = largura - MARGEM * 2;
  const recebe = relatorio.lado === "receber";

  const corpo: RowInput[] = mes.parcelas.map((p) => [
    paraFormatoBR(p.vencimento as DataISO),
    String(p.documentoNumero),
    `${p.numero}/${p.deQuantas}`,
    /* Nome e descrição na MESMA célula, separados por quebra: em colunas, um
       título com uma frase inteira empurraria o valor para fora da folha. */
    p.descricao ? `${p.pessoa}\n${p.descricao}` : p.pessoa,
    p.diasDeAtraso > 0 ? `${p.diasDeAtraso} d` : "—",
    /* De quanto era, quando parte já entrou: sem isso, 250,00 numa parcela de
       2.500 parece erro de cadastro. */
    p.jaPago > 0
      ? `${formatarSemSimbolo(p.emAberto)}\nde ${formatarSemSimbolo(p.valor)}`
      : formatarSemSimbolo(p.emAberto),
  ]);

  corpo.push([
    { content: mesPorExtenso(mes.mes), colSpan: 5, styles: { fontStyle: "bold" } },
    { content: formatarSemSimbolo(mes.total), styles: { fontStyle: "bold" } },
  ]);

  const COL_VENC = 64;
  const COL_NUM = 44;
  const COL_PARC = 46;
  const COL_ATRASO = 48;
  const COL_VALOR = 84;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, bottom: RODAPE },
    tableWidth: larguraUtil,
    theme: "plain",
    head: [
      [
        { content: "Vencimento", styles: { halign: "left" as const } },
        { content: "Nº", styles: { halign: "left" as const } },
        { content: "Parc.", styles: { halign: "left" as const } },
        { content: recebe ? "Cliente" : "Fornecedor", styles: { halign: "left" as const } },
        "Atraso",
        "Em aberto",
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
      0: { cellWidth: COL_VENC, halign: "left" },
      1: { cellWidth: COL_NUM, halign: "left" },
      2: { cellWidth: COL_PARC, halign: "left" },
      3: {
        cellWidth:
          larguraUtil - COL_VENC - COL_NUM - COL_PARC - COL_ATRASO - COL_VALOR,
        halign: "left",
        overflow: "linebreak",
        cellPadding: { top: 5, bottom: 5, left: 0, right: 10 },
      },
      4: { cellWidth: COL_ATRASO },
      5: { cellWidth: COL_VALOR },
    },
    /*
     * ⚠️ Só o ATRASO ganha cor, e só quando existe.
     *
     * Pintar a linha vencida inteira faria um relatório de cobrança todo
     * vermelho — e aí a cor deixa de apontar coisa alguma. Mesma decisão da
     * tela, e da linha de resultado da DRE.
     */
    didParseCell: ({ cell, column, row, section }) => {
      if (section !== "body") return;

      /* A linha de subtotal é a última do corpo e tem `colSpan`: reconhecida
         pela quantidade de células, e não por um índice guardado à parte, que
         erraria assim que um mês mudasse de tamanho. */
      const ehSubtotal = (row.raw as unknown[]).length === 2;
      if (ehSubtotal) {
        cell.styles.lineWidth = { top: 0.8, bottom: 0 };
        cell.styles.lineColor = REGUA;
        return;
      }

      if (column.index !== 4) return;
      const texto = String((cell.raw as { content?: unknown })?.content ?? cell.raw);
      if (texto !== "—") cell.styles.textColor = VERMELHO;
    },
  });

  return (
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 18
  );
}

// ── O cartão ────────────────────────────────────────────────────────────────

/**
 * As faturas de cartao ainda abertas, uma linha por ciclo.
 *
 * ⚠️ TABELA SEPARADA, e nao misturada nos meses.
 *
 * O ciclo nao e parcela de titulo: nao tem numero de documento, nao tem
 * fornecedor unico e nao se cobra dele parcela a parcela. A fatura vence
 * inteira, num dia so — e e assim que o compromisso existe. Misturado na grade
 * das parcelas, precisaria de colunas vazias em toda linha.
 *
 * ⚠️ So aparece quando a pessoa PEDIU. Ver `relatorio.cartao`: nulo e "nao
 * perguntou", e o papel entao nao fala de cartao em lugar nenhum.
 */
function cartao(
  doc: jsPDF,
  relatorio: Relatorio,
  y: number,
  largura: number,
): void {
  const resumo = relatorio.cartao;
  if (!resumo || resumo.ciclos.length === 0) return;

  const larguraUtil = largura - MARGEM * 2;

  const corpo: RowInput[] = resumo.ciclos.map((c) => [
    paraFormatoBR(c.vencimento as DataISO),
    `Ciclo ${c.competencia.slice(5, 7)}/${c.competencia.slice(0, 4)}`,
    c.cartao,
    String(c.compras),
    formatarSemSimbolo(c.total),
  ]);

  corpo.push([
    { content: "Cartão de crédito", colSpan: 4, styles: { fontStyle: "bold" } },
    { content: formatarSemSimbolo(resumo.total), styles: { fontStyle: "bold" } },
  ]);

  const COL_VENC = 64;
  const COL_CICLO = 84;
  const COL_COMPRAS = 60;
  const COL_TOTAL = 84;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, bottom: RODAPE },
    tableWidth: larguraUtil,
    theme: "plain",
    head: [
      [
        { content: "Vencimento", styles: { halign: "left" as const } },
        { content: "Ciclo", styles: { halign: "left" as const } },
        { content: "Cartão", styles: { halign: "left" as const } },
        "Compras",
        "Total",
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
      0: { cellWidth: COL_VENC, halign: "left" },
      1: { cellWidth: COL_CICLO, halign: "left" },
      2: {
        cellWidth:
          larguraUtil - COL_VENC - COL_CICLO - COL_COMPRAS - COL_TOTAL,
        halign: "left",
        cellPadding: { top: 5, bottom: 5, left: 0, right: 10 },
      },
      3: { cellWidth: COL_COMPRAS },
      4: { cellWidth: COL_TOTAL },
    },
    didParseCell: ({ cell, row, section }) => {
      if (section !== "body") return;

      /* A linha de subtotal e a ultima e tem `colSpan`: reconhecida pela
         quantidade de celulas, e nao por um indice que erraria assim que o
         periodo mudasse de tamanho. */
      if ((row.raw as unknown[]).length === 2) {
        cell.styles.lineWidth = { top: 0.8, bottom: 0 };
        cell.styles.lineColor = REGUA;
      }
    },
  });

  const fim = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;

  doc
    .setFont("helvetica", "normal")
    .setFontSize(7.5)
    .setTextColor(...CINZA);
  doc.text(
    "Só os ciclos ainda abertos, pelo vencimento da fatura. O ciclo já fechado virou conta a pagar e aparece nos meses acima.",
    MARGEM,
    fim + 12,
  );
}

// ── Fecho ───────────────────────────────────────────────────────────────────

/**
 * O total do periodo, depois do ultimo mes.
 *
 * ⚠️ Fora das tabelas, e nao como uma linha da ultima. Ele soma TODOS os meses,
 * e dentro da tabela de dezembro leria como se fosse o total de dezembro.
 */
function fecho(doc: jsPDF, relatorio: Relatorio, largura: number): void {
  const fim = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;

  const altura = doc.internal.pageSize.getHeight();
  let y = fim + 6;

  /* Sem espaço na folha, o total desce para a próxima: cortado ao meio no pé da
     página, ele viraria a única informação ilegível do documento. */
  if (y > altura - RODAPE - 40) {
    doc.addPage();
    y = MARGEM + 10;
  }

  doc.setDrawColor(...REGUA).setLineWidth(0.8);
  doc.line(MARGEM, y, largura - MARGEM, y);

  y += 14;

  doc
    .setFont("helvetica", "bold")
    .setFontSize(9)
    .setTextColor(...TINTA);
  doc.text("Total do período", MARGEM, y);
  doc.text(formatarSemSimbolo(relatorio.total), largura - MARGEM, y, {
    align: "right",
  });

  y += 16;

  doc
    .setFont("helvetica", "normal")
    .setFontSize(7.5)
    .setTextColor(...CINZA);

  const nota =
    "Os valores são o saldo que falta, e não o valor combinado da parcela: a que já recebeu parte entra apenas pelo restante. Parcelas canceladas e títulos cancelados não aparecem.";

  for (const linha of doc.splitTextToSize(
    nota,
    largura - MARGEM * 2,
  ) as string[]) {
    doc.text(linha, MARGEM, y);
    y += 10;
  }
}

// ── Peças ───────────────────────────────────────────────────────────────────

/** "2026-09-01" -> "Setembro de 2026". */
function mesPorExtenso(iso: string): string {
  return `${MESES_POR_EXTENSO[Number(iso.slice(5, 7)) - 1] ?? ""} de ${iso.slice(0, 4)}`;
}

function rodape(doc: jsPDF, emitidoPor: string, largura: number): void {
  const total = doc.getNumberOfPages();
  const altura = doc.internal.pageSize.getHeight();
  const emissao = paraFormatoBR(
    new Date().toISOString().slice(0, 10) as DataISO,
  );

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(7.5)
      .setTextColor(...CINZA);
    doc.text(`Emitido em ${emissao} por ${emitidoPor}`, MARGEM, altura - 20);
    doc.text(`${pagina} / ${total}`, largura - MARGEM, altura - 20, {
      align: "right",
    });
  }
}
