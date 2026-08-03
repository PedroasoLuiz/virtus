import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";
import { carregarLogo, type TicketParaPDF } from "./pdf";

/**
 * Segundo layout do documento — registro de serviço, no registro de invoice.
 *
 * Convive com `pdf.ts`, que replica o documento do FlutterFlow. Este não o
 * substitui: enquanto os dois estiverem no ar dá para comparar lado a lado com
 * o mesmo ticket, que é a única forma honesta de decidir qual fica.
 *
 * O que muda em relação ao antigo:
 *
 * - **Sem tabela cinza no cabeçalho.** Emitente e destinatário viram duas
 *   colunas de texto. O bloco cinza de quatro linhas gastava um quarto da
 *   página em rótulos que ninguém lê depois da primeira vez.
 * - **Cinza só na régua da tabela**, não no preenchimento de toda linha. Linha
 *   inteira pintada compete com o que está escrito nela; uma régua fina separa
 *   igual e some quando não é procurada.
 * - **Total colado na tabela**, na mesma grade de colunas, com faixa verde
 *   clara sob as duas últimas — em vez de uma pilha de mini-tabelas soltas.
 * - **Verde da marca em dois pontos** — número e total —, dentro da regra dos
 *   ~10% de sotaque. Réguas coloridas e divisórias de rodapé saíram: o espaço
 *   já separa, e linha sobre linha só empilha divisória.
 */

const MARGEM = 40;

/**
 * Largura das colunas de número — a mesma na tabela de serviços, na de
 * cobrança e no bloco de totais.
 *
 * É o que faz o total parecer parte da tabela e não um bloco solto embaixo
 * dela: o valor cai exatamente sob a coluna "Total".
 */
const COL_NUM = 62;
const VERDE: [number, number, number] = [0, 106, 40];
const TINTA: [number, number, number] = [29, 29, 31];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];

const dinheiro = (v: number) => formatarSemSimbolo(v as Centavos);

function qtdComUnidade(q: number, unidade: "UN" | "H"): string {
  if (unidade === "H") {
    const min = Math.round(q * 60);
    const m = min % 60;
    return m === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${String(m).padStart(2, "0")}`;
  }
  return Number.isInteger(q) ? `${q} un` : `${q.toFixed(2).replace(".", ",")} un`;
}

function totalDoItem(i: TicketParaPDF["itens"][number]): number {
  const bruto = Math.round(i.quantidade * i.valorUnitario);
  const despesas = i.despesas.reduce((s, d) => s + d.valor, 0);
  return Math.max(0, bruto - i.desconto + i.acrescimo + despesas);
}

export async function imprimirRecibo(t: TicketParaPDF, emitidoPor: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  let y = await cabecalho(doc, t, direita);
  y = identificacao(doc, t, y);
  y = partes(doc, t, y, largura);
  y = servicos(doc, t, y, largura);
  y = fechamento(doc, t, y, direita);
  y = parcelas(doc, t, y);

  observacoes(doc, t, y, largura);
  rodape(doc, emitidoPor, largura);

  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

// ── Cabeçalho ───────────────────────────────────────────────────────────────

async function cabecalho(doc: jsPDF, t: TicketParaPDF, direita: number): Promise<number> {
  const largura = doc.internal.pageSize.getWidth();

  // Faixa de ponta a ponta no topo, colada na borda: dá ao documento uma
  // identidade que sobrevive à fotocópia e ao arquivo em pasta, sem gastar
  // altura de conteúdo.
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, largura, 8, "F");

  const y = MARGEM;

  // Só "TICKET": o número tem campo próprio logo abaixo, e repeti-lo aqui
  // punha o mesmo dado duas vezes na mesma dobra.
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...VERDE);
  doc.text("TICKET", MARGEM, y + 14);

  const logo = await carregarLogo(t.empresa.logo);
  if (logo) {
    const altura = 26;
    const larguraLogo = altura * (logo.largura / logo.altura);
    doc.addImage(logo.dados, "PNG", direita - larguraLogo, y - 4, larguraLogo, altura);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...TINTA);
    doc.text(t.empresa.razaoSocial ?? "VPAY", direita, y + 13, { align: "right" });
  }

  return y + 34;
}

/**
 * Identificação do documento, em pares rótulo/valor.
 *
 * Situação e apuração saíram de baixo do título: soltas ali, eram duas frases
 * sem rótulo que só quem conhece o sistema sabia ler. Com rótulo e alinhadas
 * numa coluna, quem recebe o documento entende sem contexto.
 */
function identificacao(doc: jsPDF, t: TicketParaPDF, y: number): number {
  const periodo = periodoEmMeses(
    (t.inicio ?? null) as DataISO | null,
    (t.fim ?? null) as DataISO | null,
  );

  const pares: [string, string][] = [
    ["Número", String(t.numero)],
    ["Situação", t.cancelada ? "CANCELADO" : t.status],
    ["Apuração", periodo ?? "—"],
  ];

  let linha = y;
  for (const [rotulo, valor] of pares) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(`${rotulo}:`, MARGEM, linha);

    doc.setFont("helvetica", "bold").setTextColor(...TINTA);
    doc.text(valor, MARGEM + 52, linha);

    linha += 13;
  }

  return linha + 14;
}

// ── Emitente e destinatário, lado a lado ────────────────────────────────────

function partes(doc: jsPDF, t: TicketParaPDF, y: number, largura: number): number {
  const meio = largura / 2;
  const e = t.clienteEndereco;

  const emitente = [
    t.empresa.razaoSocial ?? "—",
    t.empresa.cnpj ? `CNPJ ${t.empresa.cnpj}` : "",
    t.empresa.endereco ?? "",
  ].filter(Boolean);

  const destinatario = [
    t.clienteNome ?? "—",
    t.clienteDoc ? formatarDoc(t.clienteDoc) : "",
    [e?.logradouro, e?.numero, e?.complemento].filter(Boolean).join(", "),
    [e?.bairro, [e?.cidade, e?.uf].filter(Boolean).join("/"), e?.cep].filter(Boolean).join(" · "),
    t.centroCustoNome ? `Centro de custo: ${t.centroCustoNome}` : "",
  ].filter(Boolean);

  coluna(doc, "DE", emitente, MARGEM, y, meio - MARGEM - 20);
  const altura = coluna(doc, "PARA", destinatario, meio, y, largura - meio - MARGEM);

  return y + altura + 26;
}

function coluna(
  doc: jsPDF,
  rotulo: string,
  linhas: string[],
  x: number,
  y: number,
  largura: number,
): number {
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text(rotulo, x, y);

  let altura = 14;
  linhas.forEach((linha, i) => {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal").setFontSize(i === 0 ? 10 : 8.5);
    doc.setTextColor(...(i === 0 ? TINTA : CINZA));

    // Quebra pela largura da coluna: razão social longa não pode invadir a
    // coluna vizinha.
    for (const parte of doc.splitTextToSize(linha, largura)) {
      doc.text(parte, x, y + altura);
      altura += i === 0 ? 13 : 11;
    }
  });

  return altura;
}

function formatarDoc(doc: string | null): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d || "—";
}

// ── Serviços ────────────────────────────────────────────────────────────────

/**
 * Serviços, com uma coluna por tipo de ajuste.
 *
 * Acréscimo, desconto e despesas aparecem SÓ quando existem em algum item —
 * coluna zerada em todas as linhas é largura gasta sem informação, e a largura
 * aqui é curta.
 *
 * A descrição e as despesas descem por quebra de linha DENTRO da célula do
 * serviço, na mesma cor. Duas tentativas de deixá-las em cinza falharam —
 * desenhar à mão em `didDrawCell` exigia reservar altura por fora do autotable,
 * e linha própria com `colSpan` ocupava a tabela inteira por definição. Ambas
 * quebravam a largura da coluna. Aqui quem quebra o texto é o autotable, que é
 * o único que sabe a largura final da coluna.
 */
function servicos(doc: jsPDF, t: TicketParaPDF, y: number, largura: number): number {
  const temAcrescimo = t.itens.some((i) => i.acrescimo > 0);
  const temDesconto = t.itens.some((i) => i.desconto > 0);
  const temDespesa = t.itens.some((i) => i.despesas.length > 0);

  const cabecalhos = ["Serviço", "Data", "Qtd.", "Unitário"];
  if (temAcrescimo) cabecalhos.push("Acréscimo");
  if (temDesconto) cabecalhos.push("Desconto");
  if (temDespesa) cabecalhos.push("Despesas");
  cabecalhos.push("Total");

  const util = largura - MARGEM * 2;

  // Com sete colunas de número, 62pt cada não cabe em A4. A coluna encolhe até
  // sobrar espaço de leitura para o nome do serviço.
  const colNum = Math.min(COL_NUM, (util - 150) / (cabecalhos.length - 1));

  const linhas = t.itens.map((i) => {
    const despesas = i.despesas.reduce((soma, d) => soma + d.valor, 0);

    const detalhe = [
      i.descricao && i.servicoNome ? i.descricao : "",
      ...i.despesas.map((d) => `${d.descricao || "Despesa"} · ${dinheiro(d.valor)}`),
    ].filter(Boolean);

    const linha: string[] = [
      [i.servicoNome ?? i.descricao ?? "—", ...detalhe].join("\n"),
      i.data ? paraFormatoBR(i.data as DataISO) : "—",
      qtdComUnidade(i.quantidade, i.unidade),
      dinheiro(i.valorUnitario),
    ];
    if (temAcrescimo) linha.push(i.acrescimo > 0 ? dinheiro(i.acrescimo) : "—");
    if (temDesconto) linha.push(i.desconto > 0 ? dinheiro(i.desconto) : "—");
    if (temDespesa) linha.push(despesas > 0 ? dinheiro(despesas) : "—");
    linha.push(dinheiro(totalDoItem(i)));

    return linha;
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM },
    tableWidth: util,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 7, bottom: 7, left: 0, right: 0 },
      textColor: TINTA,
      lineColor: REGUA,
    },
    headStyles: {
      fontSize: 7,
      fontStyle: "bold",
      textColor: CINZA,
      lineWidth: { bottom: 0.8 },
      lineColor: REGUA,
    },
    bodyStyles: { lineWidth: { bottom: 0.5 }, lineColor: REGUA },
    columnStyles: colunas(cabecalhos.length, colNum),
    head: [cabecalhos],
    body: linhas,
    didParseCell: (d) => {
      // Rótulo acompanha o alinhamento da coluna: "Total" à direita sobre
      // números à direita.
      if (d.column.index > 0) d.cell.styles.halign = "right";
    },
  });

  return tabelaTerminaEm(doc);
}

function colunas(
  quantas: number,
  colNum: number,
): Record<number, { cellWidth?: number; halign?: "right"; overflow?: "linebreak" }> {
  const estilos: Record<number, { cellWidth?: number; halign?: "right"; overflow?: "linebreak" }> = {
    0: { overflow: "linebreak" },
  };
  for (let i = 1; i < quantas; i++) estilos[i] = { cellWidth: colNum, halign: "right" };
  return estilos;
}

// ── Fechamento ──────────────────────────────────────────────────────────────

/**
 * Fecha a tabela de serviços, e não um bloco novo embaixo dela.
 *
 * Os valores caem na MESMA coluna do "Total" da tabela, e a faixa do total
 * ocupa exatamente a largura das duas últimas colunas. Antes o bloco flutuava
 * com margens próprias e parecia ter vindo de outro documento.
 */
/**
 * Fecha a tabela: subtotal, os ajustes que existirem, e o total.
 *
 * Subtotal é a soma bruta (quantidade × unitário), antes de qualquer ajuste —
 * sem ele o total apareceria sem a conta que levou até ele. Acréscimo,
 * desconto e despesas só entram quando há.
 *
 * Os valores caem na MESMA coluna do "Total" da tabela: é isso que faz o bloco
 * ler como fechamento dela, e não como um quadro solto embaixo.
 */
function fechamento(doc: jsPDF, t: TicketParaPDF, y: number, direita: number): number {
  const bruto = t.itens.reduce((s, i) => s + Math.round(i.quantidade * i.valorUnitario), 0);
  const acrescimo = t.itens.reduce((s, i) => s + i.acrescimo, 0);
  const desconto = t.itens.reduce((s, i) => s + i.desconto, 0);
  const despesas = t.itens.reduce((s, i) => s + i.despesas.reduce((x, d) => x + d.valor, 0), 0);
  const total = t.itens.reduce((s, i) => s + totalDoItem(i), 0);

  const pares: [string, number, boolean][] = [
    ["Subtotal", bruto, true],
    ["Acréscimo", acrescimo, acrescimo > 0],
    ["Desconto", desconto, desconto > 0],
    ["Despesas", despesas, despesas > 0],
  ];

  const xRotulo = direita - COL_NUM * 2;
  let linha = y + 16;

  for (const [rotulo, valor, mostra] of pares) {
    if (!mostra) continue;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(rotulo, xRotulo, linha);
    doc.setTextColor(...TINTA);
    doc.text(dinheiro(valor), direita, linha, { align: "right" });
    linha += 14;
  }

  // Mesmo corpo de texto dos ajustes; só o negrito o separa. Total é
  // conclusão, não manchete.
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...TINTA);
  doc.text("Total", xRotulo, linha);
  doc.text(dinheiro(total), direita, linha, { align: "right" });

  return linha + 22;
}

// ── Parcelas ────────────────────────────────────────────────────────────────

function parcelas(doc: jsPDF, t: TicketParaPDF, y: number): number {
  const linhas = t.faturas.flatMap((f) =>
    f.parcelas.map((p) => [
      String(f.faturaId),
      p.numero != null ? String(p.numero) : "—",
      p.vencimento ? paraFormatoBR(p.vencimento as DataISO) : "—",
      dinheiro(p.valor),
      p.pago ? "Pago" : "Em aberto",
    ]),
  );

  if (linhas.length === 0) return y;

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text("COBRANÇA", MARGEM, y + 10);

  autoTable(doc, {
    startY: y + 16,
    margin: { left: MARGEM, right: MARGEM },
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: { top: 6, bottom: 6, left: 0, right: 0 }, textColor: TINTA },
    headStyles: { fontSize: 7, fontStyle: "bold", textColor: CINZA, lineWidth: { bottom: 0.8 }, lineColor: REGUA },
    bodyStyles: { lineWidth: { bottom: 0.5 }, lineColor: REGUA },
    columnStyles: {
      1: { cellWidth: COL_NUM, halign: "right" },
      2: { cellWidth: COL_NUM, halign: "right" },
      3: { cellWidth: COL_NUM, halign: "right" },
      4: { cellWidth: COL_NUM, halign: "right" },
    },
    head: [["Fatura", "Parcela", "Vencimento", "Valor", "Situação"]],
    body: linhas,
    didParseCell: (d) => {
      if (d.column.index > 0) d.cell.styles.halign = "right";
    },
  });

  const fim = tabelaTerminaEm(doc);
  if (t.faturado <= 0) return fim;

  const pago = t.faturas.reduce((s, f) => s + f.pago, 0);
  const total = t.itens.reduce((s, i) => s + totalDoItem(i), 0);
  const direita = doc.internal.pageSize.getWidth() - MARGEM;

  let linha = fim + 16;
  for (const [rotulo, valor] of [
    ["Faturado", t.faturado],
    ["Valor pago", pago],
    ["Saldo devedor", Math.max(0, total - pago)],
  ] as [string, number][]) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(rotulo, direita - COL_NUM * 2, linha);
    doc.setFont("helvetica", "bold").setTextColor(...TINTA);
    doc.text(dinheiro(valor), direita, linha, { align: "right" });
    linha += 14;
  }

  return linha + 6;
}

// ── Observações e rodapé ────────────────────────────────────────────────────

function observacoes(doc: jsPDF, t: TicketParaPDF, y: number, largura: number): void {
  const texto = (t.descricao ?? "").trim();
  if (!texto) return;

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text("OBSERVAÇÕES", MARGEM, y + 18);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
  doc.text(doc.splitTextToSize(texto, largura - MARGEM * 2), MARGEM, y + 32);
}

function rodape(doc: jsPDF, emitidoPor: string, largura: number): void {
  const total = doc.getNumberOfPages();
  const altura = doc.internal.pageSize.getHeight();
  const emissao = paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO);

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    // Sem régua acima: a página já termina ali, e mais uma linha só empilha
    // divisória sobre divisória.
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text(`Emitido em ${emissao} por ${emitidoPor}`, MARGEM, altura - 22);
    doc.text(`${pagina} / ${total}`, largura - MARGEM, altura - 22, { align: "right" });
  }
}

function tabelaTerminaEm(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
