import { formatarDocumento } from "@/shared/domain/documento";
import jsPDF from "jspdf";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import {
  acrescimoPorAtraso,
  type ParametrosDeCobranca,
} from "@/shared/domain/cobranca";
import { valorPorExtenso } from "@/shared/utils/extenso";
import { carregarLogo } from "../tickets/pdf-base";

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
/* Azul da marca (#0a52b9). jsPDF quer RGB numerico, entao o token de
   `globals.css` nao chega aqui — se a marca mudar, muda tambem aqui. */
const AZUL: [number, number, number] = [10, 82, 185];
const TINTA: [number, number, number] = [16, 16, 18];
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
  /**
   * Onde o cliente fica, e em que centro de custo ele entra.
   *
   * ⚠️ Cobranca identifica QUEM deve, e nome sozinho nao identifica: duas
   * empresas do mesmo grupo tem razoes sociais parecidas, e o documento com o
   * endereco e o que separa uma da outra.
   */
  clienteEndereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  } | null;
  /**
   * As obras que esta conta cobre.
   *
   * ⚠️ PROJETO, e nao centro de custo. O centro de custo e categoria contabil —
   * "Salarios", "Arte impressa" —, e nao diz nada a quem recebe a cobranca. A
   * obra diz: e por ela que o cliente reconhece o que esta pagando.
   *
   * ⚠️ E sao VARIOS, no plural. A conta junta tickets, e cada ticket pertence a
   * uma obra: quatro tickets da mesma empresa podem ser quatro obras na mesma
   * cobranca. Um campo unico obrigaria a escolher uma delas.
   */
  clienteProjetos: string[];
  /** Os tickets que a conta cobre. E a referencia que o cliente reconhece. */
  tickets: {
    numero: number;
    titulo: string;
    valor: number;
    data: string | null;
    /** A obra daquele ticket. Uma conta junta varios, de obras diferentes. */
    projetoNome: string | null;
  }[];
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
  doc.setFillColor(...AZUL).rect(0, 0, largura, 8, "F");

  let y = MARGEM + 18;

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  const logo = await carregarLogo(r.emitente.logo);
  if (logo) {
    const proporcao = logo.largura / logo.altura;
    doc.addImage(
      logo.dados,
      "PNG",
      direita - 26 * proporcao,
      MARGEM,
      26 * proporcao,
      26,
    );
  }

  doc
    .setFont("helvetica", "bold")
    .setFontSize(20)
    .setTextColor(...AZUL);
  doc.text("RECIBO DE PAGAMENTO", MARGEM, y);

  y += 22;
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .setTextColor(...CINZA);
  doc.text("Conta", MARGEM, y);
  doc.text("Parcela", MARGEM, y + 13);
  doc.text("Pago em", MARGEM, y + 26);

  doc.setFont("helvetica", "bold").setTextColor(...TINTA);
  doc.text(String(r.numeroConta), MARGEM + 56, y);
  doc.text(`${r.parcela} de ${r.totalParcelas}`, MARGEM + 56, y + 13);
  doc.text(
    r.pagoEm ? paraFormatoBR(r.pagoEm.slice(0, 10) as DataISO) : "—",
    MARGEM + 56,
    y + 26,
  );

  y += 52;

  // ── Quem pagou ────────────────────────────────────────────────────────────
  //
  // Sem rotulo: nome grande logo abaixo de "RECIBO DE PAGAMENTO" so pode ser de
  // quem pagou, e a etiqueta gastava uma linha para dizer o obvio.
  doc
    .setFont("helvetica", "bold")
    .setFontSize(12)
    .setTextColor(...TINTA);
  doc.text(r.clienteNome ?? "—", MARGEM, y);

  y = identificacaoDoCliente(doc, r, y);

  // ── A quantia, por extenso do jeito que se lê num recibo ─────────────────
  //
  // Sem regua acima: o espaco ja separa, e a linha logo abaixo do nome do
  // cliente parecia fechar um bloco que nao tinha comecado.
  y += 10;
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .setTextColor(...CINZA);
  doc.text("A importância de", MARGEM, y);

  doc
    .setFont("helvetica", "bold")
    .setFontSize(16)
    .setTextColor(...AZUL);
  doc.text(`R$ ${formatarSemSimbolo(r.valor as Centavos)}`, MARGEM, y + 20);

  /*
   * O valor tambem por extenso.
   *
   * E o que impede alterar um algarismo depois de assinado: "1.500,00" vira
   * "5.500,00" com uma canetada; "mil e quinhentos reais" nao.
   */
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .setTextColor(...TINTA);
  doc.text(
    doc.splitTextToSize(`(${valorPorExtenso(r.valor)})`, largura - MARGEM * 2),
    MARGEM,
    y + 34,
  );

  y += 52;
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9.5)
    .setTextColor(...TINTA);
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
      doc
        .setFont("helvetica", "normal")
        .setFontSize(8.5)
        .setTextColor(...TINTA);
      doc.text(String(p.numero), MARGEM, y);
      doc.setTextColor(...CINZA);
      doc.text(
        p.vencimento
          ? paraFormatoBR(p.vencimento.slice(0, 10) as DataISO)
          : "—",
        MARGEM + 62,
        y,
      );
      doc.setTextColor(...TINTA);
      doc.text(formatarSemSimbolo(p.total as Centavos), direita, y, {
        align: "right",
      });
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

  doc
    .setFont("helvetica", "normal")
    .setFontSize(10)
    .setTextColor(...TINTA);
  doc.text("____ / ____ / ________", inicioData, linhaAssinatura - 3);

  doc.setDrawColor(...TINTA).setLineWidth(0.8);
  doc.line(inicioAssinatura, linhaAssinatura, direita - 24, linhaAssinatura);

  doc
    .setFont("helvetica", "bold")
    .setFontSize(9)
    .setTextColor(...TINTA);
  const centroAssinatura = (inicioAssinatura + direita - 24) / 2;
  doc.text(
    r.emitente.razaoSocial ?? "—",
    centroAssinatura,
    linhaAssinatura + 13,
    {
      align: "center",
    },
  );

  if (r.emitente.cnpj) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(...CINZA);
    doc.text(
      `CNPJ ${r.emitente.cnpj}`,
      centroAssinatura,
      linhaAssinatura + 23,
      {
        align: "center",
      },
    );
  }

  doc.setFontSize(7.5).setTextColor(...CINZA);
  doc.text(
    `Emitido em ${paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO)}${emitidoPor ? ` por ${emitidoPor}` : ""}`,
    MARGEM,
    altura - MARGEM,
  );
  doc.text("1 / 1", direita, altura - MARGEM, { align: "right" });

  abrirParaImprimir(doc);
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
  clienteEndereco: ReciboParaPDF["clienteEndereco"];
  clienteProjetos: string[];
  total: number;
  pago: number;
  /** Somado das parcelas. Sem ele os numeros nao fecham e parece erro de conta. */
  desconto: number;
  tickets: {
    numero: number;
    titulo: string;
    valor: number;
    data: string | null;
    /** A obra daquele ticket. Uma conta junta varios, de obras diferentes. */
    projetoNome: string | null;
  }[];
  parcelas: {
    numero: number;
    vencimento: string | null;
    total: number;
    desconto: number;
    pago: boolean;
    /** Quanto ja entrou nesta parcela. E o que sobra que rende mora. */
    recebido: number;
    /** Quando entrou a ultima vez. Nulo enquanto nao entrou nada. */
    pagoEm: string | null;
  }[];
  /**
   * A regra de mora do cliente, quando ha uma.
   *
   * ⚠️ NULA quer dizer que o contrato nao previu encargo, e ai a coluna some do
   * documento inteiro. Imprimir "0,00" em cobranca sugere que houve calculo e
   * deu zero; a ausencia diz a verdade, que e que nao se cobra.
   */
  cobranca: ParametrosDeCobranca | null;
  emitente: ReciboParaPDF["emitente"];
};

/**
 * O que fazer com o PDF depois de montado.
 *
 * ⚠️ Sao duas intencoes DIFERENTES. "imprimir" abre numa aba com a caixa de
 * impressao chamada — e o botao de dentro do sistema, onde a pessoa quer papel
 * na hora. "baixar" salva o arquivo, e e o que a pagina publica precisa: o
 * cliente clicou em "Baixar a conta em PDF", e receber uma aba com um blob no
 * lugar de um arquivo na pasta e o contrario do que o botao prometeu.
 */
export type DestinoDoPdf = "imprimir" | "baixar";

export async function imprimirResumoDaConta(
  r: ResumoParaPDF,
  emitidoPor: string,
  destino: DestinoDoPdf = "imprimir",
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const direita = largura - MARGEM;

  doc.setFillColor(...AZUL).rect(0, 0, largura, 8, "F");

  let y = MARGEM + 18;

  const logo = await carregarLogo(r.emitente.logo);
  if (logo) {
    const p = logo.largura / logo.altura;
    doc.addImage(logo.dados, "PNG", direita - 26 * p, MARGEM, 26 * p, 26);
  }

  doc
    .setFont("helvetica", "bold")
    .setFontSize(20)
    .setTextColor(...AZUL);
  /* ⚠️ "FATURA", e nao "CONTA A RECEBER". O segundo e o nome do modulo aqui
     dentro — quem recebe o documento nao tem conta a receber nenhuma, tem uma
     fatura para pagar. Dentro do sistema o nome continua o de sempre. */
  doc.text("FATURA", MARGEM, y);

  y += 20;
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .setTextColor(...CINZA);
  doc.text("Número", MARGEM, y);
  doc.text("Situação", MARGEM, y + 13);
  if (r.competencia) doc.text("Apuração", MARGEM, y + 26);

  doc.setFont("helvetica", "bold").setTextColor(...TINTA);
  doc.text(String(r.numeroConta), MARGEM + 56, y);
  doc.text(r.situacao, MARGEM + 56, y + 13);
  if (r.competencia) doc.text(r.competencia, MARGEM + 56, y + 26);

  /* ⚠️ Respiro maior antes do nome de quem paga. Colado na linha de apuracao,
     ele lia como se fosse mais um campo do cabecalho, e nao a abertura de outro
     assunto — a folha passa de "que conta e esta" para "de quem e". */
  y += r.competencia ? 68 : 55;

  // ── Para quem ─────────────────────────────────────────────────────────────
  //
  // Sem rotulo, e sem a coluna do emitente: a marca ja esta no topo, o emitente
  // e sempre o mesmo, e o unico nome nesta altura so pode ser o do cliente.
  doc
    .setFont("helvetica", "bold")
    .setFontSize(12)
    .setTextColor(...TINTA);
  doc.text(r.clienteNome ?? "—", MARGEM, y);
  y = identificacaoDoCliente(doc, r, y);

  // ── De onde vem ───────────────────────────────────────────────────────────
  if (r.tickets.length > 0) {
    y = composicao(doc, r.tickets, y, direita);
    // Respiro entre as duas tabelas: coladas, pareciam uma so de duas partes.
    y += 34;
  }

  /*
   * A mora de cada parcela, apurada ANTES de desenhar.
   *
   * ⚠️ Cada uma conta do PROPRIO vencimento, e sobre o proprio saldo. A parcela
   * que recebeu 2.250 de 2.500 deve mora sobre os 250 que faltam, contados
   * desde o dia em que ela venceu — e nao desde a data em que se emitiu o
   * documento, nem sobre o valor cheio.
   */
  const ate = hoje();
  const mora = r.parcelas.map((p) => {
    const saldo = (p.total - p.recebido) as Centavos;
    if (!r.cobranca || saldo <= 0) return { dias: 0, multa: 0, juros: 0 };

    const a = acrescimoPorAtraso(saldo, p.vencimento, ate, r.cobranca);
    return { dias: a.dias, multa: a.multa, juros: a.juros };
  });

  /* A coluna so existe quando ha o que mostrar nela. Ver o comentario do tipo. */
  const temMora = mora.some((m) => m.multa + m.juros > 0);

  /*
   * ⚠️ A tabela MUDA de largura conforme haja mora ou nao.
   *
   * Com encargo, ela vira a planilha de cobranca inteira: contrato, pago, data,
   * dias de atraso, saldo, multa, juros e total — que e o que se leva a uma
   * discussao de divida. Sem encargo, essas colunas seriam sete tracos por
   * linha, e uma tabela cheia de tracos esconde a que tem numero.
   */
  // ── Como se paga ──────────────────────────────────────────────────────────
  y = secao(doc, "PARCELAS", y, MARGEM, direita);

  /* Posicoes fixas em pontos, e nao proporcionais: a tabela precisa caber em
     A4 retrato com dez colunas, e o unico jeito de garantir isso e medir. */
  const X = temMora
    ? {
        parcela: MARGEM,
        vencimento: MARGEM + 26,
        valor: MARGEM + 145,
        pago: MARGEM + 205,
        data: MARGEM + 268,
        dias: MARGEM + 296,
        saldo: MARGEM + 355,
        multa: MARGEM + 405,
        juros: MARGEM + 455,
        encargos: direita,
      }
    : {
        parcela: MARGEM,
        vencimento: MARGEM + 26,
        valor: direita - 240,
        pago: direita - 150,
        data: direita - 80,
        dias: 0,
        saldo: direita,
        multa: 0,
        juros: 0,
        encargos: 0,
      };

  y = colunas(
    doc,
    y,
    direita,
    temMora
      ? [
          { texto: "#", x: X.parcela },
          { texto: "VENCTO.", x: X.vencimento },
          { texto: "CONTRATO", x: X.valor, direita: true },
          { texto: "PAGO", x: X.pago, direita: true },
          { texto: "DATA PGTO.", x: X.data, direita: true },
          { texto: "DIAS", x: X.dias, direita: true },
          { texto: "SALDO", x: X.saldo, direita: true },
          /* ⚠️ O percentual desce para a SEGUNDA linha. Em coluna de 50 pontos,
             "MULTA (2%)" numa linha so encosta no vizinho — foi o que fez os
             dois cabecalhos se sobreporem. */
          {
            texto: "MULTA",
            abaixo: `(${porcento(r.cobranca!.multaPercentual)})`,
            x: X.multa,
            direita: true,
          },
          {
            texto: "JUROS",
            abaixo: `(${porcento(r.cobranca!.jurosPercentual)} a.m.)`,
            x: X.juros,
            direita: true,
          },
          { texto: "ENCARGOS", x: X.encargos, direita: true },
        ]
      : [
          { texto: "#", x: X.parcela },
          { texto: "VENCTO.", x: X.vencimento },
          { texto: "CONTRATO", x: X.valor, direita: true },
          { texto: "PAGO", x: X.pago, direita: true },
          { texto: "DATA PGTO.", x: X.data, direita: true },
          { texto: "SALDO", x: X.saldo, direita: true },
        ],
  );

  const traco = "—";

  for (const [i, p] of r.parcelas.entries()) {
    const m = mora[i];
    const saldo = p.total - p.recebido;
    y += 15;

    doc
      .setFont("helvetica", "normal")
      .setFontSize(temMora ? 7.5 : 8.5)
      .setTextColor(...TINTA);

    doc.text(String(p.numero), X.parcela, y);
    doc.text(
      p.vencimento ? paraFormatoBR(p.vencimento.slice(0, 10) as DataISO) : traco,
      X.vencimento,
      y,
    );
    doc.text(formatarSemSimbolo(p.total as Centavos), X.valor, y, { align: "right" });

    doc.setTextColor(...(p.recebido > 0 ? AZUL : CINZA));
    doc.text(
      p.recebido > 0 ? formatarSemSimbolo(p.recebido as Centavos) : traco,
      X.pago,
      y,
      { align: "right" },
    );

    /* A data ao lado do valor: em cobranca, "quanto" sem "quando" nao prova
       nada — e e a data que separa pagamento no prazo de pagamento em atraso. */
    doc.setTextColor(...CINZA);
    doc.text(
      p.pagoEm ? paraFormatoBR(p.pagoEm.slice(0, 10) as DataISO) : traco,
      X.data,
      y,
      { align: "right" },
    );

    if (temMora) {
      doc.setTextColor(...CINZA);
      doc.text(m.dias > 0 ? String(m.dias) : traco, X.dias, y, {
        align: "right",
      });
    }

    /* O saldo em tinta cheia: e o numero que se cobra, e o unico da linha que
       ainda espera acao. */
    doc.setTextColor(...(saldo > 0 ? TINTA : CINZA));
    doc.text(saldo > 0 ? formatarSemSimbolo(saldo as Centavos) : traco, X.saldo, y, {
      align: "right",
    });

    if (temMora) {
      doc.setTextColor(...(m.multa + m.juros > 0 ? TINTA : CINZA));
      doc.text(
        m.multa > 0 ? formatarSemSimbolo(m.multa as Centavos) : traco,
        X.multa,
        y,
        { align: "right" },
      );
      doc.text(
        m.juros > 0 ? formatarSemSimbolo(m.juros as Centavos) : traco,
        X.juros,
        y,
        { align: "right" },
      );
      doc.text(
        m.multa + m.juros > 0 ? formatarSemSimbolo((m.multa + m.juros) as Centavos) : traco,
        X.encargos,
        y,
        { align: "right" },
      );
    }

    doc.setDrawColor(...REGUA).line(MARGEM, y + 4, direita, y + 4);
  }

  /*
   * ⚠️ A linha de TOTAIS fecha a tabela, e nao so o quadro de fechamento.
   *
   * Quem confere uma planilha de cobranca soma a coluna com o dedo e compara
   * com o rodape dela. Obrigar a procurar o total em outro bloco da folha e
   * convidar a conferencia a parar no meio.
   */
  const somaPago = r.parcelas.reduce((a, p) => a + p.recebido, 0);
  const somaSaldo = r.parcelas.reduce((a, p) => a + (p.total - p.recebido), 0);
  const somaMulta = mora.reduce((a, m) => a + m.multa, 0);
  const somaJuros = mora.reduce((a, m) => a + m.juros, 0);
  const somaEncargos = mora.reduce((a, m) => a + m.multa + m.juros, 0);

  y += 16;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(temMora ? 7.5 : 8.5)
    .setTextColor(...TINTA);
  /* ⚠️ O sinal aparece SO aqui. Dentro da tabela ele repetia em cada linha um
     fato que a coluna ja diz — e transformava uma planilha de conferencia num
     extrato. Na somatoria ele e util: e onde o leitor soma de cabeca e precisa
     saber o que abate e o que acrescenta. */
  doc.text("TOTAIS", X.parcela, y);
  doc.text(formatarSemSimbolo(r.total as Centavos), X.valor, y, { align: "right" });
  doc.text(`-${formatarSemSimbolo(somaPago as Centavos)}`, X.pago, y, { align: "right" });
  doc.text(formatarSemSimbolo(somaSaldo as Centavos), X.saldo, y, { align: "right" });

  if (temMora) {
    doc.text(`+${formatarSemSimbolo(somaMulta as Centavos)}`, X.multa, y, { align: "right" });
    doc.text(`+${formatarSemSimbolo(somaJuros as Centavos)}`, X.juros, y, { align: "right" });
    doc.text(`+${formatarSemSimbolo(somaEncargos as Centavos)}`, X.encargos, y, {
      align: "right",
    });
  }

  // ── Fechamento ────────────────────────────────────────────────────────────
  y += 30;
  fechamento(doc, y, direita, {
    total: r.total,
    pago: r.pago,
    desconto: r.desconto,
    encargos: mora.reduce((s, m) => s + m.multa + m.juros, 0),
  });

  rodape(doc, altura, direita, emitidoPor);

  if (destino === "baixar") {
    // `save` escreve direto na pasta de downloads, com nome de gente. Sem ele o
    // arquivo chegaria como um identificador aleatorio de blob.
    doc.save(`conta-${r.numeroConta}.pdf`);
    return;
  }

  abrirParaImprimir(doc);
}

/**
 * A tabela de composicao: de onde vem o dinheiro.
 *
 * TICKET, DATA e VALOR, com cabecalho. Sem ele a primeira coluna virava um
 * numero solto que se confundia com o da conta, la em cima.
 */
function composicao(
  doc: jsPDF,
  tickets: {
    numero: number;
    titulo: string;
    valor: number;
    data: string | null;
    projetoNome: string | null;
  }[],
  y: number,
  direita: number,
): number {
  let atual = secao(doc, "COMPOSIÇÃO", y, MARGEM, direita);

  /*
   * ⚠️ A obra fica AQUI, na linha do ticket, e nao so no cabecalho.
   *
   * Uma conta junta varios tickets, e cada um pode ser de uma obra diferente —
   * o cliente e um so, as obras nao. Listada no topo, a informacao diz "esta
   * cobranca toca estas obras"; na linha, ela diz qual valor e de qual, que e o
   * que se confere.
   */
  atual = colunas(doc, atual, direita, [
    { texto: "TICKET", x: MARGEM },
    { texto: "PROJETO", x: MARGEM + 52 },
    { texto: "DATA", x: direita - 90, direita: true },
    { texto: "VALOR", x: direita, direita: true },
  ]);

  for (const t of tickets) {
    atual += 16;
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8.5)
      .setTextColor(...TINTA);
    doc.text(String(t.numero), MARGEM, atual);

    /* O projeto em tinta cheia: e nome proprio, e nao metadado da linha. */
    doc.text(t.projetoNome ?? "—", MARGEM + 52, atual, { maxWidth: 200 });

    doc.setTextColor(...CINZA);
    doc.text(
      t.data ? paraFormatoBR(t.data.slice(0, 10) as DataISO) : "—",
      direita - 90,
      atual,
      { align: "right" },
    );

    doc.setTextColor(...TINTA);
    doc.text(formatarSemSimbolo(t.valor as Centavos), direita, atual, {
      align: "right",
    });

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
  v: { total: number; pago: number; desconto: number; encargos?: number },
): number {
  const rotulo = direita - 160;
  const linhas: {
    texto: string;
    valor: number;
    cor: [number, number, number];
  }[] = [
    { texto: "Total", valor: v.total, cor: TINTA },
    { texto: "Recebido", valor: v.pago, cor: AZUL },
  ];
  if (v.desconto > 0)
    linhas.push({ texto: "Desconto", valor: v.desconto, cor: CINZA });
  /* Multa e juros somam ao que se deve, e por isso ficam FORA do "Em aberto"
     do principal e aparecem em linha propria: quem confere precisa ver quanto
     e divida e quanto e mora, para discutir uma sem tocar na outra. */
  if ((v.encargos ?? 0) > 0)
    linhas.push({ texto: "Multa e juros", valor: v.encargos ?? 0, cor: TINTA });

  let atual = y;
  doc.setFont("helvetica", "normal").setFontSize(9);
  for (const l of linhas) {
    doc.setTextColor(...CINZA);
    doc.text(l.texto, rotulo, atual);
    doc.setTextColor(...l.cor);
    doc.text(formatarSemSimbolo(l.valor as Centavos), direita, atual, {
      align: "right",
    });
    atual += 15;
  }

  doc.setFont("helvetica", "bold").setTextColor(...TINTA);
  doc.text("Em aberto", rotulo, atual);
  doc.text(
    formatarSemSimbolo(
      (v.total - v.pago - v.desconto + (v.encargos ?? 0)) as Centavos,
    ),
    direita,
    atual,
    {
      align: "right",
    },
  );

  return atual;
}

/** "2%" a partir de 2, e "1,5%" a partir de 1.5. */
function porcento(v: number): string {
  return `${v.toFixed(2).replace(/\.?0+$/, "").replace(".", ",")}%`;
}

/**
 * O bloco de quem paga: documento, endereco e centro de custo, embaixo do nome.
 *
 * ⚠️ Cobranca identifica QUEM deve, e nome sozinho nao identifica: duas empresas
 * do mesmo grupo tem razoes sociais parecidas, e o documento com o endereco e o
 * que separa uma da outra. O centro de custo entra porque e por ele que o
 * cliente acha a despesa no proprio controle.
 *
 * ⚠️ Linha que nao existe nao vira traco. Uma sequencia de tracos ocupa o mesmo
 * espaco de um endereco de verdade e nao diz nada; o bloco simplesmente encolhe,
 * e por isso ele devolve o `y` em vez de somar uma altura fixa.
 *
 * Os dois documentos usam este mesmo bloco: o recibo de uma parcela e o resumo
 * da conta identificam o mesmo pagador, e escritos duas vezes ja teriam
 * divergido no primeiro ajuste.
 */
function identificacaoDoCliente(
  doc: jsPDF,
  r: Pick<ReciboParaPDF, "clienteDoc" | "clienteEndereco" | "clienteProjetos">,
  y: number,
): number {
  const e = r.clienteEndereco;
  const linhas = [
    /* ⚠️ Com mascara, e a mesma funcao para os dois: o cadastro guarda ora
       "38276247000108" ora "55.133.311/0001-10", e num documento de cobranca os
       dois precisam ler igual. `formatarDocumento` decide pelo tamanho se e CPF
       ou CNPJ e devolve o que veio quando nao reconhece. */
    r.clienteDoc ? formatarDocumento(r.clienteDoc) : "",
    [e?.logradouro, e?.numero, e?.complemento].filter(Boolean).join(", "),
    [e?.bairro, [e?.cidade, e?.uf].filter(Boolean).join("/"), e?.cep]
      .filter(Boolean)
      .join(" · "),
    /* Uma linha so, com as obras separadas por virgula: em documento de
       cobranca, "Projetos: A, B" se le de uma vez; uma linha por obra faria o
       bloco de identificacao crescer mais que o proprio nome do cliente. */
    r.clienteProjetos.length > 0
      ? `${r.clienteProjetos.length > 1 ? "Projetos" : "Projeto"}: ${r.clienteProjetos.join(", ")}`
      : "",
  ].filter((l): l is string => Boolean(l) && l!.length > 0);

  doc
    .setFont("helvetica", "normal")
    .setFontSize(8.5)
    .setTextColor(...CINZA);
  for (const [i, linha] of linhas.entries()) {
    doc.text(linha, MARGEM, y + 13 + i * 11);
  }

  return y + 26 + linhas.length * 11;
}

/**
 * Abre o PDF numa aba, com a caixa de impressao ja chamada.
 *
 * ⚠️ Abrir, e nao salvar. E o mesmo gesto do PDF do ticket, e os dois sao
 * documentos que se olham antes de decidir o que fazer com eles — conferir na
 * tela, imprimir, ou mandar. Salvar obrigava a sair do sistema, achar o arquivo
 * e abrir para so entao ver se estava certo.
 */
function abrirParaImprimir(doc: jsPDF): void {
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

/**
 * O rodape da folha: quem emitiu, quando, e a paginacao.
 *
 * ⚠️ SEM fio em cima. Uma regua ali cortava a folha em duas e dava ao rodape o
 * peso de uma secao; o vao branco ja separa o suficiente.
 */
function rodape(
  doc: jsPDF,
  altura: number,
  direita: number,
  emitidoPor: string,
): void {
  const linha = altura - 30;

  doc
    .setFont("helvetica", "normal")
    .setFontSize(7.5)
    .setTextColor(...CINZA);
  doc.text(
    `Emitido em ${paraFormatoBR(new Date().toISOString().slice(0, 10) as DataISO)}${emitidoPor ? ` por ${emitidoPor}` : ""}`,
    MARGEM,
    linha,
  );
  doc.text("1 / 1", direita, linha, { align: "right" });
}

/** A linha de cabecalho de uma tabela, com a regua embaixo. */
function colunas(
  doc: jsPDF,
  y: number,
  direita: number,
  cols: { texto: string; abaixo?: string; x: number; direita?: boolean }[],
): number {
  doc
    .setFont("helvetica", "bold")
    .setFontSize(7)
    .setTextColor(...CINZA);
  for (const c of cols) {
    const alinha = c.direita ? ({ align: "right" } as const) : undefined;
    doc.text(c.texto, c.x, y + 14, alinha);
    if (c.abaixo) doc.text(c.abaixo, c.x, y + 22, alinha);
  }

  /* ⚠️ A regua DESCE quando ha segunda linha, senao ela corta o percentual ao
     meio — foi o que aconteceu com "(2%)" embaixo de "MULTA". A altura do
     cabecalho e o que muda, e nao a posicao do texto. */
  const base = cols.some((c) => c.abaixo) ? y + 27 : y + 19;

  doc
    .setDrawColor(...REGUA)
    .setLineWidth(0.6)
    .line(MARGEM, base, direita, base);
  return base;
}

/** Titulo de secao com a regua embaixo. Repetido tres vezes; vale a funcao. */
function secao(
  doc: jsPDF,
  titulo: string,
  y: number,
  esquerda: number,
  direita: number,
): number {
  /* ⚠️ Preto, e nao cinza. O titulo abre uma secao do documento; em cinza ele
     tinha o mesmo peso dos rotulos de coluna logo abaixo, e a folha virava uma
     lista de cinzas sem hierarquia. */
  doc
    .setFont("helvetica", "bold")
    .setFontSize(7)
    .setTextColor(...TINTA);
  doc.text(titulo, esquerda, y);
  doc
    .setDrawColor(...REGUA)
    .setLineWidth(0.6)
    .line(esquerda, y + 6, direita, y + 6);
  return y + 6;
}
