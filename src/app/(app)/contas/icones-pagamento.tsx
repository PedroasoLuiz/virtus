"use client";

/**
 * O tipo do pagamento, em ícone.
 *
 * Num extrato de trinta linhas, "PIX" escrito trinta vezes ocupa uma coluna
 * inteira para dizer o que a forma do desenho diz de relance. O ícone também
 * agrupa visualmente: bate o olho e vê que o dia foi todo de boleto.
 *
 * ⚠️ A forma vem de texto livre do legado, onde o mesmo PIX aparece com quatro
 * grafias. Por isso a decisão é por trecho contido, e não por igualdade.
 */

type Desenho = {
  chave: string;
  /**
   * A grade em que o desenho foi traçado. O Pix é a marca oficial, desenhada em
   * 24; os demais são traço nosso em 16. Misturar sem declarar a grade fazia um
   * sair a dois terços do outro.
   */
  viewBox: string;
  /**
   * Espessura do traço NA GRADE do próprio desenho.
   *
   * Um traço de 1.4 numa grade de 24 sai mais fino que o mesmo 1.4 numa de 16,
   * porque o SVG escala tudo junto. Declarar por ícone é o que faz os dois
   * pesarem igual na tela.
   */
  traco?: number;
  /** Marca preenchida em vez de traçada. Ninguém usa hoje: ver o Pix. */
  preenchido?: boolean;
  /**
   * Tamanho em px, quando o padrão não serve.
   *
   * ⚠️ Serve para compensar GRADE, e não para dar destaque. O Pix é o único que
   * declara: a folga que o `viewBox` dele tem para o traço não ser cortado faz o
   * desenho ocupar menos da caixa que os outros, e sem o ajuste ele sairia maior
   * que os vizinhos para parecer do mesmo tamanho.
   */
  tamanho?: number;
  tracos: React.ReactNode;
};

/**
 * A marca do Pix, na geometria oficial.
 *
 * ⚠️ É a ÚNICA preenchida do conjunto, e é de propósito.
 *
 * Traçada ela fica ruim: o contorno de um caminho composto desenha também as
 * arestas internas, e as quatro setas viram um emaranhado. Preenchida pequena
 * demais também não funciona — as reentrâncias que a tornam reconhecível fecham
 * e sobra um losango disforme.
 *
 * O que resolve é área: preenchida a 19px, contra os 15px dos ícones de traço.
 * Marca cheia precisa de mais espaço que um desenho de linha para dizer a mesma
 * coisa, e forçar as duas ao mesmo tamanho era o erro.
 */
/**
 * A marca oficial do Pix, em 24.
 *
 * ⚠️ NAO simplificar. Cheguei a troca-la por um losango vazado "que le melhor
 * em tamanho pequeno" — e nao era mais o Pix, era um losango. Marca de bandeira
 * e reconhecimento e nao desenho: quem olha nao decodifica a forma, ele a
 * lembra. Simplificada, ela deixa de ser lembrada.
 *
 * ⚠️ Vazada, e nao cheia. E o contorno da mesma marca, e nao outro desenho: ela
 * fica ao lado de um texto miudo, e a versao preenchida virava uma mancha escura
 * mais pesada que a palavra que acompanha. Os outros icones da coluna tambem sao
 * traco — cheia, so ela destoava.
 */
const PIX: React.ReactNode = (
  <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.505 3.505 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.157 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.647 3.647 0 0 1 5.156 0l4.559 4.559ZM4.85 6.51h.433a2.483 2.483 0 0 1 1.75.723l3.6 3.6a1.72 1.72 0 0 0 2.434 0l3.613-3.613a2.482 2.482 0 0 1 1.75-.723h.723l2.734 2.734a3.647 3.647 0 0 1 0 5.157l-2.734 2.734h-.723a2.483 2.483 0 0 1-1.75-.723l-3.613-3.613a1.76 1.76 0 0 0-2.434 0l-3.6 3.6a2.483 2.483 0 0 1-1.75.723H4.85l-2.734-2.735a3.647 3.647 0 0 1 0-5.156Z" />
);
/** Duas setas em sentidos opostos: dinheiro trocando de lugar. */
const TRANSFERENCIA: React.ReactNode = (
  <>
    <path d="M2.4 5.6h10.2M10.2 3.2l2.4 2.4" />
    <path d="M13.6 10.4H3.4M5.8 12.8l-2.4-2.4" />
  </>
);

const CARTAO: React.ReactNode = (
  <>
    <rect x="1.8" y="4" width="12.4" height="8" rx="1.4" />
    <path d="M1.8 6.8h12.4" />
  </>
);

/**
 * A ordem importa: "cartão de débito" contém "cartão", então o mais específico
 * precisa ser testado antes.
 */
const DESENHOS: Desenho[] = [
  /*
   * ⚠️ O `viewBox` do Pix e MAIOR que a grade do desenho, de proposito.
   *
   * A marca oficial encosta nas quatro bordas do quadrado de 24. Cheia isso nao
   * incomodava, porque forma preenchida termina exatamente na borda; vazada, o
   * traco de 1,6 se distribui para os dois lados da linha e 0,8 dele cai FORA da
   * caixa — e o SVG corta o que sai. O resultado eram as quatro pontas comidas,
   * com a marca parecendo espremida dentro de um quadrado.
   *
   * Uma unidade e meia de folga em volta cabe o traco inteiro. O desenho nao
   * mudou: o que mudou foi a moldura parar de corta-lo.
   */
  {
    chave: "pix",
    viewBox: "-1.5 -1.5 27 27",
    traco: 1.6,
    tamanho: 13,
    tracos: PIX,
  },
  {
    chave: "boleto",
    viewBox: "0 0 16 16",
    // Código de barras: é o que se olha num boleto.
    tracos: (
      <path d="M3 3.4v9.2M5.4 3.4v9.2M7.6 3.4v9.2M10.2 3.4v9.2M13 3.4v9.2" />
    ),
  },
  {
    chave: "cartão de débito",
    viewBox: "0 0 16 16",
    tracos: (
      <>
        <rect x="1.8" y="4" width="12.4" height="8" rx="1.4" />
        <path d="M1.8 6.8h12.4M4.2 9.8h2.6" />
      </>
    ),
  },
  { chave: "cartão de crédito", viewBox: "0 0 16 16", tracos: CARTAO },
  { chave: "cartão", viewBox: "0 0 16 16", tracos: CARTAO },
  { chave: "transferência", viewBox: "0 0 16 16", tracos: TRANSFERENCIA },
  { chave: "ted", viewBox: "0 0 16 16", tracos: TRANSFERENCIA },
  { chave: "doc", viewBox: "0 0 16 16", tracos: TRANSFERENCIA },
  {
    chave: "dinheiro",
    viewBox: "0 0 16 16",
    // Cédula com a marca no meio.
    tracos: (
      <>
        <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="1.2" />
        <circle cx="8" cy="8" r="1.8" />
      </>
    ),
  },
  {
    chave: "cheque",
    viewBox: "0 0 16 16",
    tracos: (
      <>
        <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="1.2" />
        <path d="M4 9.6h3.4M10.4 6.6h1.8" />
      </>
    ),
  },
];

/** Cifrão: serve a qualquer forma que não se reconheceu, sem fingir precisão. */
const GENERICO: Desenho = {
  chave: "",
  viewBox: "0 0 16 16",
  tracos: (
    <>
      <path d="M8 2.4v11.2" />
      <path d="M10.8 5.2a2.8 2.8 0 0 0-2.8-1.4c-1.6 0-2.8.9-2.8 2.2 0 3 5.6 1.4 5.6 4.4 0 1.3-1.2 2.2-2.8 2.2a2.8 2.8 0 0 1-2.8-1.6" />
    </>
  ),
};

function desenhoDe(forma: string | null, origem: string | null): Desenho {
  const texto = `${forma ?? ""} ${origem ?? ""}`.toLowerCase();
  return DESENHOS.find((d) => texto.includes(d.chave)) ?? GENERICO;
}

/**
 * A forma do pagamento, em icone, ao lado do texto que a nomeia.
 *
 * ⚠️ SO o traco, sem bolha em volta. Houve uma versao com o icone dentro de um
 * circulo de 30px tingido, do tempo em que ele aparecia sozinho numa coluna e
 * precisava de area para ser lido. Hoje ele acompanha a palavra: a bolha pesava
 * o mesmo que o nome do lancamento e disputava a leitura com ele, e sumiu junto
 * com o trilho de cartoes que a usava.
 */
export function IconeDoPagamento({
  forma,
  origem,
}: {
  forma: string | null;
  origem: string | null;
}) {
  const desenho = desenhoDe(forma, origem);

  return (
    <span
      title={forma?.trim() || "Forma não informada"}
      style={{
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
        color: "var(--text-tertiary)",
      }}
    >
      <svg
        /* O tamanho da propria marca quando ela declara um: ver o Pix. */
        width={desenho.tamanho ?? 13}
        height={desenho.tamanho ?? 13}
        viewBox={desenho.viewBox}
        fill={desenho.preenchido ? "currentColor" : "none"}
        stroke={desenho.preenchido ? "none" : "currentColor"}
        strokeWidth={desenho.traco ?? 1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {desenho.tracos}
      </svg>
    </span>
  );
}
