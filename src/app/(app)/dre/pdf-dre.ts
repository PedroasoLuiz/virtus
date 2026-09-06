import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { carregarLogo } from "@/app/(app)/tickets/pdf-base";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import { acumuladoPorMes, somaDoMes } from "@/shared/domain/dre";
import type { Dre } from "@/modules/dre/dre.types";

/**
 * A DRE do ano em PDF.
 *
 * Mesmo template dos outros documentos do sistema — faixa da marca no topo,
 * titulo a esquerda e logo a direita, identificacao em pares rotulo/valor,
 * regua fina no lugar de linha pintada, rodape com quem emitiu e a paginacao.
 *
 * ⚠️ DEITADO (`landscape`), e e a unica diferenca de forma. Sao catorze colunas:
 * em retrato, cada mes ficaria com menos de 40pt e todo valor acima de mil
 * quebraria em duas linhas, o que transformaria a grade num paredao ilegivel.
 */

const MARGEM = 32;

/* Azul da marca (#0a52b9). jsPDF quer RGB numerico, entao o token de
   `globals.css` nao chega aqui — se a marca mudar, muda tambem aqui. */
const AZUL: [number, number, number] = [10, 82, 185];
const TINTA: [number, number, number] = [16, 16, 18];
const CINZA: [number, number, number] = [134, 134, 139];
const REGUA: [number, number, number] = [226, 226, 228];

/**
 * O par do resultado. Verde e vermelho aqui sao SEMANTICOS, nao a marca: sobra e
 * verde e falta e vermelha em qualquer demonstrativo. Espelham `--credito` e
 * `--debito` do design system, iguais aos do extrato.
 */
const CREDITO: [number, number, number] = [21, 128, 61];
const VERMELHO: [number, number, number] = [185, 28, 28];

/**
 * Altura reservada ao rodape, em pontos.
 *
 * ⚠️ Foi de 48 para 64 porque a ultima linha da tabela saia cortada ao meio no
 * pe da folha. Deitado, cada pagina tem menos altura e mais linhas por pagina
 * que o retrato: a folga que bastava no extrato nao bastava aqui.
 */
const RODAPE = 64;

/**
 * Largura das colunas de numero, igual em todas as treze.
 *
 * ⚠️ FIXA, e nao proporcional. Com largura calculada, uma coluna com valores
 * grandes ficava mais larga que a vizinha e a grade perdia o prumo — e e o
 * alinhamento entre meses que deixa comparar dois meses de relance. O que sobra
 * vai para a coluna do centro de custo, que e a unica com texto.
 */
const COL_NUM = 46;

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/**
 * ⚠️ Zero vira traco, como na tela.
 *
 * Uma grade de catorze colunas cheia de "0,00" e uma parede de digitos onde o
 * olho nao acha o que aconteceu — e no papel, onde nao da para filtrar nem
 * rolar, isso pesa mais ainda.
 */
function celula(v: Centavos): string {
  return v === 0 ? "—" : formatarSemSimbolo(v);
}

/**
 * O texto de uma celula, venha ela crua ou embrulhada.
 *
 * ⚠️ A linha com respiro proprio chega como `{ content, styles }`, e nao como
 * string. Lendo `String(raw)` direto, ela virava "[object Object]": era isso que
 * fazia o resultado sair TODO verde no papel, inclusive os meses negativos, e o
 * teste do sinal nunca chegava a rodar.
 */
function conteudo(raw: unknown): string {
  if (typeof raw === "string") return raw;
  return String((raw as { content?: unknown } | null)?.content ?? "");
}

function linhaDaTabela(
  rotulo: string,
  meses: Centavos[],
  total: Centavos,
  respiro?: { top: number; bottom: number },
): RowInput {
  const valores = [...meses.map(celula), celula(total)];
  if (!respiro) return [rotulo, ...valores];

  const padding = { ...respiro, left: 0, right: 0 };
  return [
    { content: rotulo, styles: { cellPadding: { ...padding, right: 10 } } },
    ...valores.map((v) => ({ content: v, styles: { cellPadding: padding } })),
  ];
}

export async function imprimirDre(
  dre: Dre,
  empresa: EmpresaParaDocumento,
  emitidoPor: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM;

  let y = await cabecalho(doc, empresa, direita, largura);
  y = identificacao(doc, empresa, dre, y);
  grade(doc, dre, y, largura);

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
  doc.text("DRE", MARGEM, y + 14);

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

/** Empresa e exercicio. Duas linhas: e o que identifica o documento. */
function identificacao(
  doc: jsPDF,
  empresa: EmpresaParaDocumento,
  dre: Dre,
  y: number,
): number {
  const pares: [string, string][] = [
    ["Empresa", empresa.razaoSocial ?? "—"],
    ["Exercício", String(dre.ano)],
  ];

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

// ── A grade ─────────────────────────────────────────────────────────────────

/**
 * Centro de custo × doze meses, em dois blocos.
 *
 * ⚠️ O cabecalho de bloco e uma LINHA DA TABELA, e nao um titulo solto acima
 * dela. Solto, ele ficaria orfao no pe da folha toda vez que o bloco comecasse
 * perto do fim — e o autotable, que decide sozinho onde quebrar, nao teria como
 * saber que aquele texto pertence as linhas de baixo.
 */
function grade(doc: jsPDF, dre: Dre, y: number, largura: number): void {
  const corpo: RowInput[] = [];

  corpo.push([
    { content: "RECEITAS", colSpan: 14, styles: { fontStyle: "bold" } },
  ]);
  for (const l of dre.receitas)
    corpo.push(linhaDaTabela(l.categoria, l.meses, l.total));
  corpo.push(
    linhaDaTabela(
      "Total de receitas",
      MESES.map((_, i) => somaDoMes(dre.receitas, i)),
      dre.resumo.receitas,
    ),
  );

  /*
   * ⚠️ O respiro antes de DESPESAS e do proprio cabecalho de bloco, e nao uma
   * linha em branco. Colado no total de receitas, ele lia como parte daquele
   * bloco; e uma linha vazia no meio da grade seria uma celula a mais para o
   * autotable quebrar pagina em cima.
   */
  corpo.push([
    {
      content: "DESPESAS",
      colSpan: 14,
      styles: {
        fontStyle: "bold",
        cellPadding: { top: 18, bottom: 5, left: 0, right: 0 },
      },
    },
  ]);
  for (const l of dre.despesas)
    corpo.push(linhaDaTabela(l.categoria, l.meses, l.total));
  corpo.push(
    linhaDaTabela(
      "Total de despesas",
      MESES.map((_, i) => somaDoMes(dre.despesas, i)),
      dre.resumo.despesas,
    ),
  );

  /*
   * ⚠️ O resultado e a ULTIMA LINHA DA GRADE, e nao um bloco solto embaixo dela.
   *
   * Ele era um numero grande alinhado a direita, fora da tabela, e nao casava
   * com o resto do relatorio: a mesma medida que na tela e uma linha da grade
   * virava, no papel, uma manchete de outro documento. Como linha, ele cai
   * exatamente sob a coluna do mes que fecha — que e o que se veio conferir.
   */
  corpo.push(
    linhaDaTabela("Resultado", dre.resumo.meses, dre.resumo.lucro, {
      top: 18,
      bottom: 5,
    }),
  );

  /*
   * ⚠️ O acumulado vem ABAIXO do resultado e em cinza menor, porque responde
   * outra pergunta: nao "quanto foi neste mes", e sim "quanto sobrou ate aqui".
   * Com o mesmo peso, as duas linhas disputariam a leitura sem dizer que medem
   * coisas diferentes.
   *
   * ⚠️ Janeiro ja nasce somado ao fechamento do ano anterior, e a ultima coluna
   * mostra esse ponto de partida em vez de repetir dezembro.
   */
  const acumulado = acumuladoPorMes(
    dre.resumo.meses,
    dre.resumo.acumuladoAnterior,
  );
  corpo.push([
    /* ⚠️ De onde a soma PARTE, junto do rotulo. Sozinho na ultima coluna, o
       numero nao dizia de que ano era nem do que se tratava. */
    `Acumulado · parte de ${formatarSemSimbolo(dre.resumo.acumuladoAnterior)}, fechamento de ${dre.ano - 1}`,
    ...acumulado.map((v) => formatarSemSimbolo(v)),
    formatarSemSimbolo(
      acumulado[acumulado.length - 1] ?? dre.resumo.acumuladoAnterior,
    ),
  ]);

  if (corpo.length === 6) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(9)
      .setTextColor(...CINZA);
    doc.text("Nenhum lançamento neste exercício.", MARGEM, y + 8);
    return;
  }

  /* A primeira coluna leva o que sobra depois dos treze números: é ela que
     precisa caber "Manutenção de veículos" inteiro. */
  const larguraUtil = largura - MARGEM * 2;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, bottom: RODAPE },
    tableWidth: larguraUtil,
    theme: "plain",
    /*
     * ⚠️ O rotulo da primeira coluna declara o alinhamento na PROPRIA celula.
     *
     * `headStyles` manda alinhar a direita, porque doze das catorze colunas sao
     * numero — e ali ele ganhava do `columnStyles`, deixando "Centro de custo"
     * encostado na coluna de janeiro, longe dos nomes que ele intitula.
     */
    head: [
      [
        { content: "Centro de custo", styles: { halign: "left" as const } },
        ...MESES,
        "Ano",
      ],
    ],
    body: corpo,
    styles: {
      fontSize: 7.5,
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
      0: {
        cellWidth: larguraUtil - COL_NUM * 13,
        halign: "left",
        overflow: "linebreak",
        cellPadding: { top: 5, bottom: 5, left: 0, right: 10 },
      },
      /*
       * ⚠️ Corpo 7 nas colunas de numero, contra 7.5 no texto: com 46pt de
       * largura e `overflow: hidden`, um valor na casa do milhao passava do fim
       * da celula e era CORTADO em silencio. Meio ponto de fonte compra os dois
       * digitos que faltavam.
       *
       * ⚠️ As treze colunas de numero declaram a largura, uma a uma. Sem isso o
       * autotable a calcula pelo conteudo: o mes com valores maiores nasce mais
       * largo que o vizinho, e e o alinhamento entre eles que deixa comparar
       * dois meses de relance.
       */
      ...Object.fromEntries(
        MESES.map((_, i) => [i + 1, { cellWidth: COL_NUM, fontSize: 7 }]),
      ),
      13: { cellWidth: COL_NUM, fontSize: 7, fontStyle: "bold" },
    },
    /*
     * ⚠️ O peso de cada linha sai do CONTEUDO da primeira celula, e nao de um
     * indice guardado a parte. A quantidade de centros muda a cada ano: um
     * indice fixado aqui acertaria hoje e engordaria a linha errada no primeiro
     * mes em que alguem cadastrar um centro novo.
     */
    didParseCell: ({ cell, row, section }) => {
      if (section !== "body") return;

      const rotulo = conteudo((row.raw as unknown[])[0]);

      if (rotulo.startsWith("Total de")) cell.styles.fontStyle = "bold";

      /*
       * ⚠️ COR SO NESTA LINHA, e so pelo sinal da propria celula.
       *
       * Um mes no vermelho dentro de um ano que fechou no azul precisa aparecer
       * vermelho: pela cor do total, a linha mentiria sobre cada mes. E pintar
       * as linhas de centro de custo faria a grade inteira competir com a unica
       * linha que se veio conferir.
       */
      if (rotulo === "Resultado") {
        cell.styles.fontStyle = "bold";

        const texto = conteudo(cell.raw);
        if (texto === rotulo) return;

        if (texto.startsWith("-")) cell.styles.textColor = VERMELHO;
        else if (texto !== "—") cell.styles.textColor = CREDITO;
      }

      if (rotulo.startsWith("Acumulado")) {
        cell.styles.fontSize = 6.5;
        cell.styles.textColor = CINZA;
        /* Sem a regua embaixo: ela e a continuacao da linha de resultado, e um
           traco entre as duas as separaria justamente onde elas se leem juntas. */
        cell.styles.lineWidth = 0;
      }
    },
  });
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
