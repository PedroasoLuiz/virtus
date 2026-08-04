"use client";

/**
 * O tipo do pagamento, em ícone.
 *
 * Num extrato de trinta linhas, "PIX" escrito trinta vezes ocupa uma coluna
 * inteira para dizer o que a forma do desenho diz de relance. O ícone também
 * agrupa visualmente: bate o olho e vê que o dia foi todo de boleto.
 *
 * Círculo com o verde tingido de fundo: é o mesmo tratamento dos badges de
 * status positivo (docs/07). Não é o verde preenchido, que fica reservado à
 * ação — aqui é rótulo, não botão.
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
  /** Marca preenchida em vez de traçada. Hoje só o Pix. */
  preenchido?: boolean;
  /** Tamanho em px. Marca cheia precisa de mais área que um traço. */
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
  { chave: "pix", viewBox: "0 0 24 24", preenchido: true, tamanho: 19, tracos: PIX },
  {
    chave: "boleto",
    viewBox: "0 0 16 16",
    // Código de barras: é o que se olha num boleto.
    tracos: <path d="M3 3.4v9.2M5.4 3.4v9.2M7.6 3.4v9.2M10.2 3.4v9.2M13 3.4v9.2" />,
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
      // `.redondo` e não raio grande: squircle aplicado a raio circular achata
      // as laterais (docs/09).
      className="redondo"
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 30,
        height: 30,
        flexShrink: 0,
        borderRadius: "50%",
        background: "var(--accent-subtle)",
        color: "var(--accent-text)",
      }}
    >
      <svg
        width={desenho.tamanho ?? 15}
        height={desenho.tamanho ?? 15}
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
