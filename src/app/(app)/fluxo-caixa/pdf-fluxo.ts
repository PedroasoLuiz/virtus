import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { carregarLogo } from "@/app/(app)/tickets/pdf-base";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import type { ProjecaoDeCaixa } from "@/modules/fluxo-caixa/fluxo-caixa.types";

/**
 * A projecao de caixa em PDF.
 *
 * Mesmo template dos outros documentos do sistema — faixa da marca no topo,
 * titulo a esquerda e logo a direita, identificacao em pares rotulo/valor, regua
 * fina no lugar de linha pintada, rodape com quem emitiu e a paginacao.
 *
 * ⚠️ DEITADO (`landscape`), como a DRE. A coluna do mes leva nome por extenso, e
 * em retrato "Setembro · vencido" nao cabia sem encolher a fonte a ponto de o
 * resto da grade ficar ilegivel junto.
 *
 * ⚠️ A ORDEM DE EXIBICAO e a do legado, por pedido do Pedro: primeiro as contas
 * com o saldo de cada uma e o total, depois a previsao mes a mes com o mes por
 * extenso, o ano em coluna propria, entrada prevista, saida prevista, a
 * diferenca e o saldo acumulado. E a mesma forma que a `get_projecao_caixa_json`
 * devolvia — o que mudou foi o que alimenta os numeros, nao como eles se leem.
 */

const MARGEM = 40;

/* Azul da marca (#0a52b9). jsPDF quer RGB numerico, entao o token de
   `globals.css` nao chega aqui — se a marca mudar, muda tambem aqui. */
const AZUL: [number, number, number] = [10, 82, 185];
const TINTA: [number, number, number] = [16, 16, 18];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];

/**
 * O par do resultado. Verde e vermelho aqui sao SEMANTICOS, nao a marca: sobra e
 * verde e falta e vermelha em qualquer demonstrativo. Espelham `--credito` e
 * `--debito` do design system, iguais aos do extrato e da DRE.
 */
const CREDITO: [number, number, number] = [21, 128, 61];
const VERMELHO: [number, number, number] = [185, 28, 28];

/** Altura reservada ao rodape, em pontos. */
const RODAPE = 56;

/** Largura das colunas de numero, igual em todas as quatro. */
const COL_NUM = 92;

/** A coluna do ano, que leva quatro digitos e nada mais. */
const COL_ANO = 50;

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

/**
 * ⚠️ Zero vira traco, como na tela.
 *
 * Uma coluna cheia de "0,00" e uma parede de digitos onde o olho nao acha o que
 * aconteceu — e no papel, onde nao da para filtrar nem rolar, isso pesa mais.
 */
function celula(v: Centavos): string {
  return v === 0 ? "—" : formatarSemSimbolo(v);
}

/**
 * O texto de uma celula, venha ela crua ou embrulhada.
 *
 * ⚠️ A linha com estilo proprio chega como `{ content, styles }`, e nao como
 * string. Lendo `String(raw)` direto, ela viraria "[object Object]" e o teste do
 * sinal nunca rodaria — foi o defeito que fez a DRE sair toda verde no papel.
 */
function conteudo(raw: unknown): string {
  if (typeof raw === "string") return raw;
  return String((raw as { content?: unknown } | null)?.content ?? "");
}

export async function imprimirFluxo(
  projecao: ProjecaoDeCaixa,
  empresa: EmpresaParaDocumento,
  emitidoPor: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  let y = await cabecalho(doc, empresa, direita, largura);
  y = identificacao(doc, empresa, projecao, y);
  y = contas(doc, projecao, y, largura);
  previsao(doc, projecao, y, largura);

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
  doc.text("Fluxo de caixa", MARGEM, y + 14);

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
 * Quem emitiu e sobre que periodo.
 *
 * ⚠️ O SALDO DE HOJE saiu daqui: ele ja e o total da tabela de contas, logo
 * abaixo. Repetido, virava o mesmo numero duas vezes na mesma dobra — e o de
 * baixo e o util, porque vem acompanhado das contas que o formam.
 *
 * ⚠️ O CNPJ entra porque isto e documento: sai da empresa e pode ir para o
 * contador ou para o banco, e a razao social sozinha nao identifica quem emitiu.
 */
function identificacao(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  projecao: ProjecaoDeCaixa,
  y: number,
): number {
  const primeiro = projecao.meses[0]?.mes;
  const ultimo = projecao.meses[projecao.meses.length - 1]?.mes;

  const pares: [string, string][] = [
    ["Empresa", empresa.razaoSocial ?? "—"],
    ["CNPJ", empresa.cnpj ?? "—"],
    [
      "Período",
      primeiro && ultimo
        ? `${mesEAno(primeiro)} a ${mesEAno(ultimo)}`
        : "Nada em aberto",
    ],
  ];

  /*
   * ⚠️ O RECORTE entra na identificação, e só quando não é o padrão.
   *
   * Duas emissões do mesmo mês — uma só da Cresol e outra de todas as contas —
   * são documentos diferentes com o mesmo título e a mesma data. Sem isto
   * escrito, quem achar as duas na pasta daqui a três meses não distingue uma da
   * outra, e vai confiar na que estiver por cima.
   *
   * Quando é o padrão (todas as contas, com o vencido), a linha não aparece:
   * dizer "todas as contas" em todo relatório é ruído em 9 de cada 10 deles.
   */
  if (projecao.contasEscolhidas) {
    const nomes = projecao.contas.map((c) => c.apelido ?? `Conta ${c.id}`);
    pares.push(["Contas", nomes.join(", ") || "—"]);
  }

  if (!projecao.incluiVencidos) {
    pares.push(["Recorte", "Sem os meses vencidos"]);
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

// ── As contas ───────────────────────────────────────────────────────────────

/**
 * De onde a curva parte, conta a conta.
 *
 * ⚠️ Vem ANTES da previsao, como no legado. O saldo de hoje e a unica coisa
 * certa deste documento; tudo depois dele e previsao, e se le a partir dali.
 */
function contas(
  doc: jsPDF,
  projecao: ProjecaoDeCaixa,
  y: number,
  largura: number,
): number {
  const larguraUtil = largura - MARGEM * 2;

  doc
    .setFont("helvetica", "bold")
    .setFontSize(9)
    .setTextColor(...TINTA);
  doc.text("Contas e saldo de hoje", MARGEM, y);

  const corpo: RowInput[] = projecao.contas.map((c) => [
    [c.apelido ?? `Conta ${c.id}`, c.banco, c.conta].filter(Boolean).join(" · "),
    formatarSemSimbolo(c.saldo),
  ]);

  corpo.push(["Total", formatarSemSimbolo(projecao.saldoHoje)]);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: MARGEM, right: MARGEM, bottom: RODAPE },
    tableWidth: larguraUtil,
    theme: "plain",
    head: [
      [
        { content: "Conta", styles: { halign: "left" as const } },
        "Saldo hoje",
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
      0: { cellWidth: larguraUtil - COL_NUM, halign: "left" },
      1: { cellWidth: COL_NUM },
    },
    didParseCell: ({ cell, row, section }) => {
      if (section !== "body") return;
      if (conteudo((row.raw as unknown[])[0]) === "Total") {
        cell.styles.fontStyle = "bold";
      }
    },
  });

  const fim = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;

  return fim + 24;
}

// ── A previsão ──────────────────────────────────────────────────────────────

/**
 * Mes a mes: o que entra, o que sai, a diferenca e o saldo acumulado.
 *
 * ⚠️ As colunas sao as do legado, na mesma ordem. O que mudou por baixo:
 * o filtro de centro de custo que escondia 40% da divida saiu, parcela cancelada
 * nao entra mais, o cartao deixou de contar duas vezes e o saldo de hoje nao
 * soma mais pagamento de data futura.
 */
function previsao(
  doc: jsPDF,
  projecao: ProjecaoDeCaixa,
  y: number,
  largura: number,
): void {
  const larguraUtil = largura - MARGEM * 2;

  doc
    .setFont("helvetica", "bold")
    .setFontSize(9)
    .setTextColor(...TINTA);
  doc.text("Previsão mês a mês", MARGEM, y);

  if (projecao.meses.length === 0) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(9)
      .setTextColor(...CINZA);
    doc.text("Nada em aberto para projetar.", MARGEM, y + 18);
    return;
  }

  /*
   * ⚠️ O mes JA VENCIDO leva a marca, e nao sai da tabela.
   *
   * Ele esta aqui porque a serie comeca no menor vencimento em aberto — decisao
   * do Pedro, e a mesma do legado. Mas o saldo acumulado da linha parte do saldo
   * de HOJE e soma meses que ja passaram: sem a marca, essa coluna afirmaria no
   * papel um saldo historico que nunca existiu. No papel isso pesa mais do que
   * na tela, porque nao ha dica de mouse para explicar.
   */
  const corpo: RowInput[] = projecao.meses.map((m) => [
    m.vencido ? `${nomeDoMes(m.mes)} · vencido` : nomeDoMes(m.mes),
    m.mes.slice(0, 4),
    celula(m.entrada),
    celula(m.saida),
    celula(m.resultado),
    formatarSemSimbolo(m.saldo),
  ]);

  const COL_MES = larguraUtil - COL_ANO - COL_NUM * 4;

  autoTable(doc, {
    startY: y + 8,
    margin: { left: MARGEM, right: MARGEM, bottom: RODAPE },
    tableWidth: larguraUtil,
    theme: "plain",
    head: [
      [
        { content: "Mês", styles: { halign: "left" as const } },
        { content: "Ano", styles: { halign: "left" as const } },
        "Entradas",
        "Saídas",
        "Diferença",
        "Saldo acumulado",
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
      0: { cellWidth: COL_MES, halign: "left" },
      1: { cellWidth: COL_ANO, halign: "left" },
      2: { cellWidth: COL_NUM },
      3: { cellWidth: COL_NUM },
      4: { cellWidth: COL_NUM },
      5: { cellWidth: COL_NUM, fontStyle: "bold" },
    },
    /*
     * ⚠️ A cor sai do SINAL da propria celula, e so nas duas colunas que medem
     * resultado. Pintar entradas de verde e saidas de vermelho faria a grade
     * inteira competir com a linha que interessa — a mesma decisao da DRE.
     */
    didParseCell: ({ cell, column, row, section }) => {
      if (section !== "body") return;

      const rotulo = conteudo((row.raw as unknown[])[0]);

      /* O mes vencido inteiro em cinza: ele e historico em aberto, e nao
         previsao — e a linha precisa dizer isso antes do numero. */
      if (rotulo.endsWith("· vencido")) cell.styles.textColor = CINZA;

      if (column.index !== 4 && column.index !== 5) return;

      const texto = conteudo(cell.raw);
      if (texto === "—") return;

      if (texto.startsWith("-")) cell.styles.textColor = VERMELHO;
      else if (column.index === 4) cell.styles.textColor = CREDITO;
    },
  });

  observacoes(doc, projecao);
}

/**
 * O que a grade nao consegue dizer sozinha, embaixo dela.
 *
 * ⚠️ O CARTAO virou uma frase, e nao uma coluna.
 *
 * Ele chegou a ter uma coluna "do qual cartao", para poder ser conferido, e ela
 * produziu justamente o erro de leitura que devia evitar: ao lado de "Saidas", o
 * numero lia como uma segunda saida, e a conta da diferenca parava de fechar aos
 * olhos de quem conferia. Ele esta DENTRO de Saidas, e uma frase diz isso melhor
 * do que qualquer coluna.
 *
 * ⚠️ Depois da tabela, e nao antes. Quem le o papel vem para os numeros; a
 * ressalva e o que se procura quando um deles nao fecha.
 */
function observacoes(doc: jsPDF, projecao: ProjecaoDeCaixa): void {
  const fim = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;

  const linhas = [
    "As saídas já consideram as faturas de cartão de crédito ainda abertas, cada uma no mês em que vence. A fatura já fechada entra como conta a pagar.",
  ];

  /* Quanto do previsto e acrescimo por atraso. Esta DENTRO das entradas: a
     projecao soma o que falta receber mais o que o atraso cobra. */
  const acrescimo = projecao.meses.reduce((t, m) => t + m.entradaAcrescimo, 0);

  if (acrescimo > 0) {
    linhas.push(
      "As entradas dos meses vencidos incluem " +
        formatarSemSimbolo(acrescimo as Centavos) +
        " de multa e juros calculados até a data de emissão, pela política de cobrança de cada cliente. As parcelas entram pelo saldo que falta receber, e não pelo valor combinado.",
    );
  }

  if (projecao.meses.some((m) => m.vencido)) {
    linhas.push(
      "Os meses marcados como vencidos reúnem parcelas com vencimento passado e ainda em aberto. Nessas linhas o saldo acumulado parte do saldo de hoje, e por isso não representa o saldo daquele mês.",
    );
  }

  const largura = doc.internal.pageSize.getWidth() - MARGEM * 2;
  let y = fim + 16;

  doc
    .setFont("helvetica", "normal")
    .setFontSize(7.5)
    .setTextColor(...CINZA);

  for (const texto of linhas) {
    /* Quebra pela largura util: sem isso a frase sai da folha pela direita e o
       fim dela simplesmente nao existe no papel. */
    for (const linha of doc.splitTextToSize(texto, largura) as string[]) {
      doc.text(linha, MARGEM, y);
      y += 10;
    }
    y += 3;
  }
}

// ── Peças ───────────────────────────────────────────────────────────────────

/** "2026-09-01" -> "Setembro". */
function nomeDoMes(iso: string): string {
  return MESES_POR_EXTENSO[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7);
}

/** "2026-09-01" -> "Setembro de 2026". */
function mesEAno(iso: string): string {
  return `${nomeDoMes(iso)} de ${iso.slice(0, 4)}`;
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
