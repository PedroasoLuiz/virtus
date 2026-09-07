import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";
import { carregarLogo, type TicketParaPDF } from "./pdf-base";

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
 *
 * ⚠️ **Este documento não fala de cobrança.** Ele responde "o que foi feito e
 * quanto vale": serviços, ajustes e total. Parcelas, vencimentos, pagamentos e
 * mora são da CONTA A RECEBER, e saem no documento dela.
 *
 * A tabela de parcelas viveu aqui e foi removida. O motivo é do modelo, não de
 * layout: uma conta reúne VÁRIOS tickets (`faturasorigens` é N para 1). O PDF
 * do ticket 116 imprimia as parcelas que também cobrem o 117 — e o rodapé
 * misturava base, somando "pago" da conta inteira com o total de um ticket só.
 * Numa conta composta essa subtração não é o saldo de nada.
 *
 * Não doía ainda porque todas as 118 contas de hoje têm um ticket só. Doeria na
 * primeira que tivesse dois, e aí já com o documento na mão do cliente.
 *
 * Dois documentos que respondem a mesma pergunta acabam discordando; o que
 * cobra é o da conta.
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
/* Azul da marca (#0a52b9). jsPDF quer RGB numerico, entao o token de
   `globals.css` nao chega aqui — se a marca mudar, muda tambem aqui. */
const AZUL: [number, number, number] = [10, 82, 185];
const TINTA: [number, number, number] = [16, 16, 18];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];

/**
 * Faixa de baixo que o conteudo nao invade.
 *
 * ⚠️ O rodape e desenhado DEPOIS de tudo, por cima. Sem reservar esta altura,
 * um bloco que chegasse ao fim da folha era impresso e o "Emitido em … 1 / 1"
 * caia em cima dele — foi o que aconteceu com Faturado/Valor pago/Saldo
 * devedor. As tabelas recebem a mesma reserva em `margin.bottom`, e os blocos
 * desenhados a mao passam por `garantirEspaco`.
 */
const RESERVA_RODAPE = 56;

/** O que ainda cabe nesta pagina a partir de `y`. */
function espacoLivre(doc: jsPDF, y: number): number {
  return doc.internal.pageSize.getHeight() - RESERVA_RODAPE - y;
}

/**
 * Devolve o `y` onde o bloco cabe — virando a pagina se preciso.
 *
 * ⚠️ Vale para o que e desenhado a MAO. O autotable ja quebra sozinho; o que
 * ele nao sabe e da existencia dos blocos que vem depois dele.
 */
function garantirEspaco(doc: jsPDF, y: number, precisa: number): number {
  if (espacoLivre(doc, y) >= precisa) return y;
  doc.addPage();
  return MARGEM;
}

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

/**
 * O que fazer com o PDF depois de montado.
 *
 * ⚠️ Sao duas intencoes DIFERENTES, e nao um detalhe de implementacao.
 *
 * "imprimir" abre o PDF numa aba com a caixa de impressao ja chamada: e o que o
 * botao de dentro do sistema faz, porque ali a pessoa quer o papel na hora.
 *
 * "baixar" salva o arquivo, e e o que a pagina publica precisa. O cliente
 * clicou em "Baixar ticket em PDF", e receber uma aba com um blob no lugar de
 * um arquivo na pasta de downloads e o contrario do que o botao prometeu.
 */
export type DestinoDoPdf = "imprimir" | "baixar";

export async function imprimirRecibo(
  t: TicketParaPDF,
  emitidoPor: string,
  destino: DestinoDoPdf = "imprimir",
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  let y = await cabecalho(doc, t, direita);
  y = identificacao(doc, t, y, largura);
  y = partes(doc, t, y, largura);
  y = servicos(doc, t, y, largura);
  y = fechamento(doc, t, y, direita);

  observacoes(doc, t, y, largura);
  rodape(doc, emitidoPor, largura);

  if (destino === "baixar") {
    // `save` escreve direto na pasta de downloads, com nome de gente. Sem ele o
    // arquivo chegaria como um identificador aleatorio de blob.
    doc.save(`ticket-${t.numero}.pdf`);
    return;
  }

  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

// ── Cabeçalho ───────────────────────────────────────────────────────────────

async function cabecalho(doc: jsPDF, t: TicketParaPDF, direita: number): Promise<number> {
  const largura = doc.internal.pageSize.getWidth();

  // Faixa de ponta a ponta no topo, colada na borda: dá ao documento uma
  // identidade que sobrevive à fotocópia e ao arquivo em pasta, sem gastar
  // altura de conteúdo.
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, largura, 8, "F");

  const y = MARGEM;

  // Só "TICKET": o número tem campo próprio logo abaixo, e repeti-lo aqui
  // punha o mesmo dado duas vezes na mesma dobra.
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...AZUL);
  doc.text("TICKET", MARGEM, y + 14);

  const logo = await carregarLogo(t.empresa.logo);
  if (logo) {
    const altura = 26;
    const larguraLogo = altura * (logo.largura / logo.altura);
    doc.addImage(logo.dados, "PNG", direita - larguraLogo, y - 4, larguraLogo, altura);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...TINTA);
    doc.text(t.empresa.razaoSocial ?? "VOPE", direita, y + 13, { align: "right" });
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
function identificacao(doc: jsPDF, t: TicketParaPDF, y: number, largura: number): number {
  const periodo = periodoEmMeses(
    (t.inicio ?? null) as DataISO | null,
    (t.fim ?? null) as DataISO | null,
  );

  /*
   * ⚠️ O projeto vem para CA, e nao mais para baixo do endereco do cliente.
   *
   * La ele lia como parte do endereco — mais uma linha cinza no bloco "PARA",
   * do mesmo tamanho do bairro e do CEP. Projeto nao e onde o cliente fica: e
   * a obra a que este ticket pertence, que e informacao de identificacao do
   * documento, igual a numero, situacao e apuracao. Aqui ele ganha rotulo
   * proprio e o nome sai em negrito, na mesma formatacao dos outros tres.
   */
  const pares: [string, string][] = [
    ["Número", String(t.numero)],
    ["Situação", t.cancelada ? "CANCELADO" : t.status],
    ["Apuração", periodo ?? "—"],
  ];
  if (t.projetoNome) pares.push(["Projeto", t.projetoNome]);

  const ROTULO = 52;
  let linha = y;

  for (const [rotulo, valor] of pares) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(`${rotulo}:`, MARGEM, linha);

    doc.setFont("helvetica", "bold").setTextColor(...TINTA);

    /* Nome de obra e texto livre e pode ser longo. Sem quebrar, ele atravessava
       a margem direita e sumia na borda da folha. */
    for (const parte of doc.splitTextToSize(valor, largura - MARGEM * 2 - ROTULO)) {
      doc.text(parte, MARGEM + ROTULO, linha);
      linha += 13;
    }
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
    /* ⚠️ O projeto NAO entra aqui. Subiu para a identificacao do documento —
       ver o comentario em `identificacao`. */
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
    /* ⚠️ `bottom` e o que faz a tabela QUEBRAR antes do rodape em vez de passar
       por baixo dele. Vale tambem para a de cobranca: qualquer uma das duas
       cresce com o ticket, e nenhuma sabia onde a folha acabava. */
    margin: { left: MARGEM, right: MARGEM, bottom: RESERVA_RODAPE },
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

  /* O bloco inteiro cabe na mesma pagina ou vai todo para a proxima: subtotal
     numa folha e total na outra e a unica forma de o leitor nao conseguir
     conferir a conta. */
  const quantas = pares.filter(([, , mostra]) => mostra).length + 1;
  let linha = garantirEspaco(doc, y + 16, quantas * 14 + 8);

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

// ── Observações e rodapé ────────────────────────────────────────────────────

function observacoes(doc: jsPDF, t: TicketParaPDF, y: number, largura: number): void {
  const texto = (t.descricao ?? "").trim();
  if (!texto) return;

  const partes: string[] = doc.splitTextToSize(texto, largura - MARGEM * 2);

  /*
   * ⚠️ Observação longa era impressa por cima do rodapé e do fim da folha.
   *
   * `doc.text` com um array de linhas desce sem olhar a altura da página: ele
   * escreve fora do papel, e o texto simplesmente some. Aqui o bloco pede o
   * espaço antes — e, se o texto for maior que uma folha inteira, quebra
   * sozinho enquanto escreve.
   */
  let linha = garantirEspaco(doc, y + 18, 14 + Math.min(partes.length, 4) * 12);

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
  doc.text("OBSERVAÇÕES", MARGEM, linha);
  linha += 14;

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TINTA);
  for (const parte of partes) {
    linha = garantirEspaco(doc, linha, 12);
    doc.text(parte, MARGEM, linha);
    linha += 12;
  }
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
