import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { carregarLogo } from "@/app/(app)/tickets/pdf-base";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import type {
  ContaBancaria,
  Extrato,
  MovimentoDoExtrato,
} from "@/modules/contas/contas.types";

/**
 * O extrato de uma conta em PDF.
 *
 * ⚠️ Segue `pdf-recibo`, que e o layout que ficou: faixa verde no topo, regua
 * fina no lugar de linha pintada, numeros na mesma grade de colunas.
 */

const MARGEM = 40;

/**
 * Largura das colunas de numero, a mesma na tabela e no fechamento.
 *
 * E o que faz o total parecer parte da tabela e nao um bloco solto embaixo dela:
 * o valor cai exatamente sob a coluna que ele fecha.
 */
const COL_NUM = 62;
const VERDE: [number, number, number] = [0, 106, 40];
const TINTA: [number, number, number] = [29, 29, 31];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];

/**
 * Altura reservada ao rodape, em pontos.
 *
 * ⚠️ Existe porque o rodape era desenhado por cima do conteudo. A tabela e o
 * fechamento seguiam ate o fim da folha e o "Emitido em ... por ..." caia em
 * cima da ultima linha. Reservado, o autotable quebra a pagina antes e o
 * fechamento sabe quando precisa de folha nova.
 */
const RODAPE = 56;
/** O vermelho de saida. Par do verde da marca, no mesmo peso de tinta. */
const VERMELHO: [number, number, number] = [185, 28, 28];

const dinheiro = (v: Centavos) => formatarSemSimbolo(v);

/**
 * Agrupa por dia, na ordem em que vieram.
 *
 * ⚠️ Mesma divisao que a tela faz. O saldo do dia e o do ULTIMO lancamento dele,
 * porque a lista chega em ordem cronologica e cada linha ja traz o acumulado.
 */
function porDia(
  movimentos: MovimentoDoExtrato[],
): { data: string; movimentos: MovimentoDoExtrato[]; saldoDoDia: Centavos }[] {
  const dias = new Map<string, { data: string; movimentos: MovimentoDoExtrato[]; saldoDoDia: Centavos }>();

  for (const m of movimentos) {
    const chave = m.data ?? "";
    const dia = dias.get(chave) ?? { data: chave, movimentos: [], saldoDoDia: m.saldoApos };

    dia.movimentos.push(m);
    dia.saldoDoDia = m.saldoApos;
    dias.set(chave, dia);
  }

  return [...dias.values()];
}

export async function imprimirExtrato(
  conta: ContaBancaria,
  extrato: Extrato,
  empresa: EmpresaParaDocumento,
  emitidoPor: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  let y = await cabecalho(doc, empresa, direita);
  y = identificacao(doc, empresa, extrato, y);
  y = partes(doc, conta, y, largura);
  y = movimentos(doc, extrato, y, largura);
  fechamento(doc, extrato, y, direita);

  rodape(doc, emitidoPor, largura);

  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

// ── Cabeçalho ───────────────────────────────────────────────────────────────

async function cabecalho(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  direita: number,
): Promise<number> {
  const largura = doc.internal.pageSize.getWidth();

  // Faixa de ponta a ponta no topo, colada na borda: dá ao documento uma
  // identidade que sobrevive à fotocópia e ao arquivo em pasta, sem gastar
  // altura de conteúdo.
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, largura, 8, "F");

  const y = MARGEM;

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...VERDE);
  doc.text("EXTRATO", MARGEM, y + 14);

  /*
   * ⚠️ So a MARCA no topo, sem o nome escrito ao lado.
   *
   * O nome da empresa desceu para a identificacao, logo abaixo do titulo. Nos
   * dois lugares, ele aparecia duas vezes na mesma dobra — e a versao do topo
   * era a que menos servia, porque competia com a logo pela mesma leitura.
   */
  const logo = await carregarLogo(empresa.logo);
  if (logo) {
    const altura = 26;
    const larguraLogo = altura * (logo.largura / logo.altura);
    doc.addImage(logo.dados, "PNG", direita - larguraLogo, y - 4, larguraLogo, altura);
  }

  return y + 34;
}

/**
 * Identificacao do documento, em pares rotulo/valor.
 *
 * ⚠️ EMPRESA e periodo, e nada mais.
 *
 * A conta saiu daqui porque tem bloco proprio logo abaixo, com banco, agencia e
 * numero — repetida, era o mesmo dado em dois lugares a dois centimetros de
 * distancia. E a abertura saiu porque ela fecha a conta la embaixo, junto de
 * entradas e saidas, que e onde a soma se confere.
 *
 * O periodo fica: extrato sem periodo impresso e um documento que ninguem
 * confere seis meses depois, porque nao se sabe o que ele deveria conter.
 */
function identificacao(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  extrato: Extrato,
  y: number,
): number {
  const pares: [string, string][] = [
    ["Empresa", empresa.razaoSocial ?? "—"],
    ["Período", `${paraFormatoBR(extrato.de)} a ${paraFormatoBR(extrato.ate)}`],
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

// ── Emitente e conta, lado a lado ───────────────────────────────────────────

/**
 * A conta, no lugar em que o recibo poe o emitente.
 *
 * ⚠️ Uma coluna so, e nao duas. Extrato nao tem destinatario: ele nao sai para
 * um cliente. A segunda coluna do recibo repetiria a empresa, que ja esta na
 * identificacao logo acima — e o que interessa neste documento e a
 * identificacao BANCARIA, que e o dado conferido contra o papel do banco.
 *
 * ⚠️ SEM o nome do banco em linha propria. Ele ja esta no nome da conta logo
 * acima, em negrito — "CORA SCD S.A." seguido de "Cora" e a mesma palavra duas
 * vezes, uma delas menor. A linha de baixo comeca pelo CODIGO, que e o primeiro
 * dos numeros que se confere contra o papel do banco.
 *
 * ⚠️ O tipo vem colado no numero da conta: "Corrente 4923909-0". Sozinho numa
 * linha, ele virava uma palavra solta no fim do bloco sem dizer de que.
 */
function partes(
  doc: jsPDF,
  conta: ContaBancaria,
  y: number,
  largura: number,
): number {
  const identificacaoBancaria = [
    conta.banco?.trim() ?? "",
    conta.agencia ? `Agência ${conta.agencia}` : "",
    [conta.tipo?.trim(), conta.conta?.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  const bancaria = [conta.apelido?.trim() || conta.nome, identificacaoBancaria].filter(Boolean);

  const altura = coluna(doc, "CONTA", bancaria, MARGEM, y, largura - MARGEM * 2);

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

// ── Lançamentos ─────────────────────────────────────────────────────────────

/**
 * Os lancamentos, agrupados por DIA.
 *
 * ⚠️ O saldo saiu da coluna de cada linha e virou uma linha de fecho por dia.
 *
 * Saldo corrido linha a linha e a leitura de quem esta reconstruindo a conta;
 * quem confere extrato compara com o papel do banco, e o banco fecha por DIA. A
 * coluna repetia um numero que so importa no ultimo lancamento de cada data, e
 * gastava a largura que o historico precisava.
 *
 * ⚠️ A mesma leitura da tela. La o extrato ja e um trilho de dias, com o fecho
 * de cada um; imprimir de outro jeito faria a conferencia mudar de forma entre
 * a tela e o papel.
 */
function movimentos(doc: jsPDF, extrato: Extrato, y: number, largura: number): number {
  /* Caixa normal, tinta cheia e corpo maior: e o titulo do bloco principal do
     documento, e nao mais um rotulo de coluna como o "CONTA" ali em cima. */
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TINTA);
  doc.text("Lançamentos", MARGEM, y);

  const linhas: RowInput[] = [];
  /* Os indices das linhas de fecho: e o que `didParseCell` usa para dar a elas
     o traco em cima e o negrito, sem precisar inspecionar o conteudo. */
  const fechos = new Set<number>();

  for (const dia of porDia(extrato.movimentos)) {
    for (const m of dia.movimentos) {
      linhas.push([
        m.data ? paraFormatoBR(m.data) : "—",
        m.nome?.trim() || m.descricao?.trim() || "—",
        m.formaPagamento?.trim() || "—",
        /*
         * ⚠️ A palavra, e nao um visto.
         *
         * O visto diz "sim" e deixa o "nao" como ausencia — e ausencia num
         * documento impresso se confunde com dado que faltou preencher. Com as
         * duas palavras, a coluna afirma as duas respostas.
         */
        m.conciliado ? "Sim" : "Não",
        /*
         * ⚠️ O SINAL entra no valor, e o extrato do banco faz igual.
         *
         * A cor ajuda quem le na tela, mas o documento e impresso em preto e
         * branco e fotocopiado. Sem o sinal, uma saida de 500 e uma entrada de
         * 500 sao a mesma linha.
         */
        `${m.tipo === "SAIDA" ? "-" : ""}${dinheiro(m.valor)}`,
      ]);
    }

    /*
     * ⚠️ O rotulo ocupa as QUATRO primeiras colunas, e nao a de "Conf.".
     *
     * Posto numa celula so, ele caia numa coluna de 26pt e virava "Saldo do
     * dia..." cortado. Com `colSpan`, o texto tem a linha inteira e encosta no
     * valor, que e onde a leitura precisa dele.
     */
    fechos.add(linhas.length);
    linhas.push([
      { content: "Saldo do dia", colSpan: 4, styles: { halign: "right" } },
      dinheiro(dia.saldoDoDia),
    ]);
  }

  if (linhas.length === 0) linhas.push(["—", "Nenhum lançamento no período", "", "", ""]);

  autoTable(doc, {
    startY: y + 10,
    margin: { left: MARGEM, right: MARGEM, bottom: RODAPE },
    tableWidth: largura - MARGEM * 2,
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
    columnStyles: {
      0: { cellWidth: 54 },
      /*
       * ⚠️ O recuo a DIREITA nesta coluna, e so nela.
       *
       * O tema `plain` zera o recuo das celulas para os numeros fecharem na
       * mesma grade. No historico isso encostava o nome do cliente na coluna
       * seguinte: "MARKETING LTDA" e "PIX" viravam uma palavra so quando o nome
       * chegava na borda. A quebra de linha ja existia — o que faltava era o
       * espaco antes dela decidir quebrar.
       */
      1: { overflow: "linebreak", cellPadding: { top: 7, bottom: 7, left: 0, right: 12 } },
      2: { cellWidth: 78 },
      3: { cellWidth: 38, halign: "center" },
      4: { cellWidth: COL_NUM, halign: "right" },
    },
    head: [["Data", "Histórico", "Forma", "Conf.", "Valor"]],
    body: linhas,
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index >= 3) d.cell.styles.halign = "right";
      if (d.section !== "body") return;

      if (fechos.has(d.row.index)) {
        // O traco que ele desenha e o de CIMA: e o fecho do que veio antes, e
        // nao a abertura do que vem depois.
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.lineWidth = { top: 0.8, bottom: 0 };
        d.cell.styles.lineColor = REGUA;
        if (d.column.index === 3) d.cell.styles.halign = "right";
        if (d.column.index === 3) d.cell.styles.textColor = CINZA;
        return;
      }

      /*
       * ⚠️ Verde e vermelho nos valores, e o sinal CONTINUA.
       *
       * A cor e o que faz a coluna se ler de relance na tela e no PDF na tela;
       * o sinal e o que sobrevive a impressora preto e branco e a fotocopia.
       * Os dois juntos custam nada e cobrem os dois leitores.
       */
      if (d.column.index === 4) {
        const texto = String(d.cell.raw ?? "");
        d.cell.styles.textColor = texto.startsWith("-") ? VERMELHO : VERDE;
      }
    },
  });

  return tabelaTerminaEm(doc);
}

/**
 * Fecha a tabela, e nao um bloco novo embaixo dela.
 *
 * Os valores caem na MESMA coluna do "Saldo": e isso que faz o bloco ler como
 * fechamento da tabela, e nao como um quadro solto. A abertura repete aqui para
 * a conta do periodo poder ser refeita de cabeca — abertura mais entradas menos
 * saidas e o fecho.
 */
function fechamento(doc: jsPDF, extrato: Extrato, y: number, direita: number): number {
  /* ⚠️ Cor so em entradas e saidas. A abertura e o fecho sao posicao, e nao
     direcao: pintados, o documento viraria quatro numeros coloridos e a cor
     deixaria de distinguir o que entrou do que saiu. */
  const pares: [string, Centavos, [number, number, number]][] = [
    ["Saldo de abertura", extrato.saldoInicial, TINTA],
    ["Entradas", extrato.entradas, VERDE],
    ["Saídas", extrato.saidas, VERMELHO],
  ];

  const xRotulo = direita - COL_NUM * 2;
  const altura = doc.internal.pageSize.getHeight();

  /*
   * ⚠️ O bloco vai INTEIRO para a folha seguinte, ou nao vai.
   *
   * Ele e desenhado com `doc.text` em coordenada calculada, e o autotable nao
   * sabe da existencia dele: sem esta conta, as quatro linhas seguiam ate o fim
   * da folha e invadiam o rodape, ou eram partidas ao meio com o total numa
   * pagina e a abertura na outra. Sao quatro linhas de 14 mais o respiro.
   */
  const precisa = 16 + 14 * 4;
  let linha = y + 16;

  if (linha + precisa > altura - RODAPE) {
    doc.addPage();
    linha = MARGEM + 16;
  }

  for (const [rotulo, valor, cor] of pares) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(rotulo, xRotulo, linha);
    doc.setTextColor(...cor);
    doc.text(dinheiro(valor), direita, linha, { align: "right" });
    linha += 14;
  }

  // Mesmo corpo de texto dos demais; só o negrito o separa. O fecho é
  // conclusão, não manchete.
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...TINTA);
  doc.text("Saldo do período", xRotulo, linha);
  doc.text(dinheiro(extrato.saldoFinal), direita, linha, { align: "right" });

  return linha + 22;
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
