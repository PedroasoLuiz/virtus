import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";

/**
 * PDF do ticket, no mesmo desenho do documento do VPay legado.
 *
 * A referência é `generateFaturaPDF` do FlutterFlow, e a ordem dos blocos é a
 * mesma: cabeçalho (logo à esquerda, emitente à direita), bloco do cliente em
 * pares rótulo/valor, tabela de serviços, totais alinhados à direita, parcelas,
 * mini-tabelas de pago/saldo, observações e rodapé com paginação.
 *
 * ⚠️ Duas diferenças conscientes com o legado:
 *
 * 1. O legado abria `window.open(blobUrl)`. Aqui o documento vai para a fila de
 *    impressão do navegador — o botão é de impressora, e quem quiser arquivo
 *    usa "Salvar como PDF" no próprio diálogo.
 *
 * 2. Colunas de acréscimo e desconto continuam aparecendo só quando existem, e
 *    entrou uma de despesas pela mesma regra: coluna zerada em todas as linhas
 *    é largura gasta sem informação.
 */

type Despesa = { descricao: string; valor: number };

type Item = {
  servicoNome: string | null;
  descricao: string;
  data: string | null;
  quantidade: number;
  unidade: "UN" | "H";
  valorUnitario: number;
  desconto: number;
  acrescimo: number;
  despesas: Despesa[];
};

type Parcela = {
  numero: number | null;
  vencimento: string | null;
  valor: number;
  pago: boolean;
};

type Conta = { faturaId: number; pago: number; parcelas: Parcela[] };

type Endereco = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
};

export type TicketParaPDF = {
  id: number;
  numero: number;
  status: string;
  cancelada: boolean;
  clienteNome: string | null;
  clienteDoc: string | null;
  clienteEndereco: Endereco | null;
  centroCustoNome: string | null;
  inicio: string | null;
  fim: string | null;
  descricao: string | null;
  faturado: number;
  itens: Item[];
  faturas: Conta[];
  empresa: {
    razaoSocial: string | null;
    endereco: string | null;
    cnpj: string | null;
    logo: string | null;
  };
};

// Os mesmos cinzas do legado: 0xCFCFCF no cabeçalho, 0xF5F5F5 nas linhas.
const CINZA_CABECALHO: [number, number, number] = [207, 207, 207];
const CINZA_LINHA: [number, number, number] = [245, 245, 245];
const MARGEM = 20;

const dinheiro = (v: number) => `R$ ${formatarSemSimbolo(v as Centavos)}`;

/**
 * Quantidade com a unidade em que foi lançada.
 *
 * Sem ela, "2,5" no documento pode ser duas horas e meia ou dois pacotes e
 * meio, e quem recebe a fatura não tem como saber. Horas saem como "2h30" —
 * o decimal é o formato de quem calcula, não de quem lê.
 */
function qtd(q: number, unidade: "UN" | "H"): string {
  if (unidade === "H") {
    const minutos = Math.round(q * 60);
    const m = minutos % 60;
    return m === 0 ? `${minutos / 60}h` : `${Math.floor(minutos / 60)}h${String(m).padStart(2, "0")}`;
  }
  return Number.isInteger(q) ? `${q} un` : `${q.toFixed(2).replace(".", ",")} un`;
}

function totalDoItem(i: Item): number {
  const bruto = Math.round(i.quantidade * i.valorUnitario);
  const despesas = i.despesas.reduce((s, d) => s + d.valor, 0);
  return Math.max(0, bruto - i.desconto + i.acrescimo + despesas);
}

export async function imprimirTicket(t: TicketParaPDF, emitidoPor: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  const y = await cabecalho(doc, t, direita);
  const depoisDoCliente = blocoDoCliente(doc, t, y, largura);
  const depoisDosServicos = tabelaDeServicos(doc, t, depoisDoCliente, largura);
  const depoisDosTotais = totais(doc, t, depoisDosServicos, direita);
  const depoisDasParcelas = tabelaDeParcelas(doc, t, depoisDosTotais);
  const depoisDaCobranca = totaisDeCobranca(doc, t, depoisDasParcelas, direita);

  observacoes(doc, t, depoisDaCobranca);
  rodape(doc, emitidoPor);

  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

// ── Cabeçalho ───────────────────────────────────────────────────────────────

async function cabecalho(doc: jsPDF, t: TicketParaPDF, direita: number): Promise<number> {
  const logo = await carregarLogo(t.empresa.logo);

  if (logo) {
    // Altura fixa de 24pt como no legado; a largura acompanha a proporção para
    // a marca não sair achatada.
    const proporcao = logo.largura / logo.altura;
    doc.addImage(logo.dados, "PNG", MARGEM, MARGEM, 24 * proporcao, 24);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(18);
    doc.text(t.empresa.razaoSocial ?? "VPAY", MARGEM, MARGEM + 18);
  }

  // Emitente à direita.
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0);
  doc.text(t.empresa.razaoSocial ?? "—", direita, MARGEM + 8, { align: "right" });

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
  doc.text(t.empresa.endereco ?? "—", direita, MARGEM + 20, { align: "right" });
  doc.text(t.empresa.cnpj ?? "—", direita, MARGEM + 31, { align: "right" });

  // Título e situação, à esquerda, abaixo da marca.
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(0);
  doc.text(`TICKET Nº ${t.numero}`, MARGEM, MARGEM + 66);

  const situacao = t.cancelada ? "CANCELADO" : t.status.toUpperCase();
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(situacao, MARGEM, MARGEM + 79);

  return MARGEM + 100;
}

/**
 * A logo vem de URL e o jsPDF precisa dos bytes.
 *
 * Falha em silêncio de propósito: logo que não carrega não pode impedir a
 * emissão do documento — o cabeçalho cai para o nome da empresa.
 */
export async function carregarLogo(
  url: string | null,
): Promise<{ dados: string; largura: number; altura: number } | null> {
  if (!url) return null;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;

    const blob = await resposta.blob();
    const dados = await new Promise<string>((ok, falha) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = falha;
      leitor.readAsDataURL(blob);
    });

    const { largura, altura } = await new Promise<{ largura: number; altura: number }>(
      (ok, falha) => {
        const img = new Image();
        img.onload = () => ok({ largura: img.width, altura: img.height });
        img.onerror = falha;
        img.src = dados;
      },
    );

    return { dados, largura, altura };
  } catch {
    return null;
  }
}

// ── Bloco do cliente ────────────────────────────────────────────────────────

/** Quatro linhas de dois pares rótulo/valor, como no legado. */
function blocoDoCliente(doc: jsPDF, t: TicketParaPDF, y: number, largura: number): number {
  const e = t.clienteEndereco;
  const rua = [e?.logradouro, e?.numero, e?.complemento].filter(Boolean).join(", ");
  const periodo = periodoEmMeses(
    (t.inicio ?? null) as DataISO | null,
    (t.fim ?? null) as DataISO | null,
  );

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM },
    tableWidth: largura - MARGEM * 2,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 4, textColor: 0, lineWidth: 0.8, lineColor: 255 },
    columnStyles: {
      0: { cellWidth: (largura - MARGEM * 2) / 6, fontStyle: "bold", fillColor: CINZA_CABECALHO },
      1: { cellWidth: ((largura - MARGEM * 2) / 6) * 2, fillColor: CINZA_LINHA },
      2: { cellWidth: (largura - MARGEM * 2) / 6, fontStyle: "bold", fillColor: CINZA_CABECALHO },
      3: { cellWidth: ((largura - MARGEM * 2) / 6) * 2, fillColor: CINZA_LINHA },
    },
    body: [
      ["Destinatário", t.clienteNome ?? "--", "CNPJ / CPF", formatarDoc(t.clienteDoc)],
      ["Endereço", rua || "--", "CEP", e?.cep || "--"],
      ["Bairro", e?.bairro || "--", "Cidade / UF", [e?.cidade, e?.uf].filter(Boolean).join(" - ") || "--"],
      ["Centro de custo", t.centroCustoNome ?? "--", "Apuração", periodo ?? "--"],
    ],
  });

  return tabelaTerminaEm(doc) + 20;
}

/** O cadastro mistura CNPJ (14) e CPF (11) na mesma coluna. */
function formatarDoc(doc: string | null): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d || "--";
}

// ── Serviços ────────────────────────────────────────────────────────────────

function tabelaDeServicos(doc: jsPDF, t: TicketParaPDF, y: number, largura: number): number {
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0);
  doc.text("DADOS DO PRODUTO / SERVIÇO", MARGEM, y);

  const temAcrescimo = t.itens.some((i) => i.acrescimo > 0);
  const temDesconto = t.itens.some((i) => i.desconto > 0);
  const temDespesa = t.itens.some((i) => i.despesas.length > 0);

  const cabecalhos = ["Item", "Serviço", "Valor", "Qtd."];
  if (temAcrescimo) cabecalhos.push("Acréscimo");
  if (temDesconto) cabecalhos.push("Desconto");
  if (temDespesa) cabecalhos.push("Despesas");
  cabecalhos.push("Total");

  const linhas = t.itens.map((i, indice) => {
    const nome = i.servicoNome ?? i.descricao ?? "--";
    // Descrição e despesas descem como linhas extras dentro da mesma célula,
    // igual ao legado, que juntava serviço e descrição com "\n".
    const detalhe = [
      i.descricao && i.servicoNome ? i.descricao : "",
      ...i.despesas.map((d) => `• ${d.descricao || "Despesa"}: ${dinheiro(d.valor)}`),
    ].filter(Boolean);

    const celula = [nome, ...detalhe].join("\n");
    const despesas = i.despesas.reduce((s, d) => s + d.valor, 0);

    const linha: (string | number)[] = [
      indice + 1,
      celula,
      dinheiro(i.valorUnitario),
      qtd(i.quantidade, i.unidade),
    ];
    if (temAcrescimo) linha.push(dinheiro(i.acrescimo));
    if (temDesconto) linha.push(dinheiro(i.desconto));
    if (temDespesa) linha.push(dinheiro(despesas));
    linha.push(dinheiro(totalDoItem(i)));

    return linha;
  });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: MARGEM, right: MARGEM },
    tableWidth: largura - MARGEM * 2,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 4, textColor: 0, lineWidth: 0.8, lineColor: 255 },
    headStyles: { fillColor: CINZA_CABECALHO, fontStyle: "bold", textColor: 0 },
    bodyStyles: { fillColor: CINZA_LINHA },
    /*
     * Larguras FIXAS e iguais nas colunas de número.
     *
     * Com largura automática cada coluna acompanhava o maior valor dentro
     * dela, então "Qtd." ficava estreita, "Total" larga, e o serviço engolia o
     * resto — o documento mudava de forma conforme os números do mês. Fixas, a
     * tabela sai igual em todo ticket, e o serviço fica com o que sobra.
     */
    columnStyles: colunasDeNumero(cabecalhos.length),
    head: [cabecalhos],
    body: linhas,
  });

  return tabelaTerminaEm(doc);
}

/** Item estreito, número 62pt em todas, serviço com o restante. */
function colunasDeNumero(quantas: number): Record<number, Partial<{ cellWidth: number; halign: "right"; overflow: "linebreak" }>> {
  const estilos: Record<number, Partial<{ cellWidth: number; halign: "right"; overflow: "linebreak" }>> = {
    0: { cellWidth: 26 },
    1: { overflow: "linebreak" },
  };

  // Da coluna 2 em diante é tudo número: mesma largura, alinhado à direita.
  for (let i = 2; i < quantas; i++) estilos[i] = { cellWidth: 62, halign: "right" };
  return estilos;
}

// ── Totais ──────────────────────────────────────────────────────────────

function totais(doc: jsPDF, t: TicketParaPDF, y: number, direita: number): number {
  const acrescimo = t.itens.reduce((s, i) => s + i.acrescimo, 0);
  const desconto = t.itens.reduce((s, i) => s + i.desconto, 0);
  const despesas = t.itens.reduce((s, i) => s + i.despesas.reduce((x, d) => x + d.valor, 0), 0);
  const total = t.itens.reduce((s, i) => s + totalDoItem(i), 0);

  const linhas: [string, string][] = [];
  if (acrescimo > 0) linhas.push(["Acréscimo:", dinheiro(acrescimo)]);
  if (desconto > 0) linhas.push(["Desconto:", dinheiro(desconto)]);
  if (despesas > 0) linhas.push(["Despesas:", dinheiro(despesas)]);
  linhas.push(["Subtotal:", dinheiro(total)]);

  return empilharValores(doc, linhas, y, direita);
}

/**
 * Faturamento e recebimento, DEPOIS das parcelas.
 *
 * Junto do subtotal eles respondiam outra pergunta no mesmo bloco: um fecha o
 * valor do serviço, o outro fecha a cobrança. Lidos logo abaixo das parcelas,
 * são a soma daquela tabela.
 *
 * Só aparecem quando há faturamento: num orçamento, "Valor pago: R$ 0,00" é
 * linha que só ocupa espaço.
 */
function totaisDeCobranca(doc: jsPDF, t: TicketParaPDF, y: number, direita: number): number {
  if (t.faturado <= 0) return y;

  const total = t.itens.reduce((s, i) => s + totalDoItem(i), 0);
  const pago = t.faturas.reduce((s, f) => s + f.pago, 0);

  return empilharValores(
    doc,
    [
      ["Faturado:", dinheiro(t.faturado)],
      ["Valor pago:", dinheiro(pago)],
      ["Saldo devedor:", dinheiro(Math.max(0, total - pago))],
    ],
    y,
    direita,
  );
}

function empilharValores(
  doc: jsPDF,
  linhas: [string, string][],
  y: number,
  direita: number,
): number {
  let linha = y + 6;
  for (const [rotulo, valor] of linhas) {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(0);
    doc.text(rotulo, direita - 160, linha + 9);

    doc.setFillColor(...CINZA_LINHA);
    doc.rect(direita - 80, linha, 80, 15, "F");

    doc.setFont("helvetica", "normal");
    doc.text(valor, direita - 4, linha + 9, { align: "right" });

    linha += 16;
  }

  return linha + 6;
}


// ── Parcelas ────────────────────────────────────────────────────────────────

function tabelaDeParcelas(doc: jsPDF, t: TicketParaPDF, y: number): number {
  // Uma linha por parcela de cada conta a receber que consumiu valor do ticket.
  const linhas = t.faturas.flatMap((f) =>
    f.parcelas.map((p) => [
      String(f.faturaId),
        p.numero != null ? String(p.numero) : "--",
      p.vencimento ? paraFormatoBR(p.vencimento as DataISO) : "--",
      dinheiro(p.valor),
      p.pago ? dinheiro(p.valor) : dinheiro(0),
    ]),
  );

  if (linhas.length === 0) return y;

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0);
  doc.text("PARCELAS", MARGEM, y + 14);

  autoTable(doc, {
    startY: y + 20,
    margin: { left: MARGEM, right: MARGEM },
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 4, textColor: 0, lineWidth: 0.8, lineColor: 255 },
    headStyles: { fillColor: CINZA_CABECALHO, fontStyle: "bold", textColor: 0 },
    bodyStyles: { fillColor: CINZA_LINHA },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
    },
    head: [["Fatura", "Parcela", "Vencimento", "Valor", "Valor pago"]],
    body: linhas,
  });

  return tabelaTerminaEm(doc);
}

// ── Observações e rodapé ────────────────────────────────────────────────────

function observacoes(doc: jsPDF, t: TicketParaPDF, y: number): void {
  const texto = (t.descricao ?? "").trim();
  if (!texto) return;

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0);
  doc.text("OBSERVAÇÕES", MARGEM, y + 24);

  doc.setFont("helvetica", "normal").setFontSize(9);
  const largura = doc.internal.pageSize.getWidth() - MARGEM * 2;
  doc.text(doc.splitTextToSize(texto, largura), MARGEM, y + 38);
}

function rodape(doc: jsPDF, emitidoPor: string): void {
  const total = doc.getNumberOfPages();
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const emissao = paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO);

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text(`Página ${pagina} de ${total}`, MARGEM, altura - 18);
    doc.text(`Emitido em ${emissao} por ${emitidoPor}`, largura - MARGEM, altura - 18, {
      align: "right",
    });
  }
}

/** `lastAutoTable` não está no tipo público do jsPDF, mas é a API do autotable. */
function tabelaTerminaEm(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
