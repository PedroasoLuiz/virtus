"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Uma série por dia: linha com área em degradê.
 *
 * ⚠️ SVG à mão, sem biblioteca de gráfico. Séries de trinta pontos não
 * justificam arrastar um pacote inteiro para o bundle, e o dia em que precisar
 * de mais formas é o dia de decidir isso com calma.
 *
 * ⚠️ Genérico de propósito. Um componente por série faria as duas divergirem em
 * escala, margem e rótulo, e um par lado a lado deixaria de ser comparável de
 * relance, que é a única razão de estarem juntos.
 *
 * ⚠️ NUNCA dois eixos num gráfico só. Duas séries de escalas diferentes num par
 * de eixos parecem correlacionadas por construção, e a conclusão errada sai de
 * graça. Duas medidas são dois gráficos, alinhados no mesmo período.
 */

export type PontoDoGrafico = { dia: string; valor: number };

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * O valor sob o cursor, num balão.
 *
 * ⚠️ Fundo sólido, e não texto solto sobre o desenho. Escrito direto no SVG, o
 * número cruzava a linha e a área em degradê e ficava ilegível justamente nos
 * picos, que são os pontos que alguém vai querer ler.
 *
 * ⚠️ A largura é ESTIMADA por contagem de caracteres, e não medida. Medir texto
 * em SVG exige `getComputedTextLength`, que só existe depois de pintar: o balão
 * nasceria com o tamanho errado e se ajustaria no quadro seguinte, piscando a
 * cada ponto por onde o mouse passa.
 */
function Balao({
  x,
  y,
  limite,
  valor,
  dia,
}: {
  x: number;
  y: number;
  limite: number;
  valor: string;
  dia: string;
}) {
  const texto = `${valor} · ${dia}`;
  const largura = texto.length * 6.1 + 18;
  const altura = 22;

  /*
   * ⚠️ Preso dentro do quadro nas duas pontas. Centrado no primeiro ou no último
   * ponto, o balão sairia pela borda e seria cortado pelo próprio SVG.
   */
  const esquerda = Math.min(Math.max(x - largura / 2, 2), limite - largura - 2);

  // Acima do ponto, e embaixo dele quando não há espaço em cima.
  const acima = y - altura - 10 >= 0;
  const topo = acima ? y - altura - 10 : y + 10;

  return (
    <g pointerEvents="none">
      <rect
        x={esquerda}
        y={topo}
        width={largura}
        height={altura}
        rx="6"
        fill="var(--text-primary)"
        opacity="0.92"
      />
      <text
        x={esquerda + largura / 2}
        y={topo + altura / 2 + 4}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill="var(--surface)"
      >
        {texto}
      </text>
    </g>
  );
}

export function GraficoDeLinha({
  titulo,
  pontos,
  rotular,
  vazio,
  rotularEixo,
  altura = 190,
  seletor,
}: {
  titulo: string;
  pontos: PontoDoGrafico[];
  /** Como escrever um valor da série. Dinheiro e contagem se escrevem diferente. */
  rotular: (valor: number) => string;
  /** O que dizer quando a série não existe. A razão muda por série. */
  vazio: React.ReactNode;
  /**
   * O valor escrito no EIXO, que é curto por obrigação.
   *
   * ⚠️ Separado do `rotular` porque os dois respondem a perguntas diferentes. No
   * balão cabe "1.234,56"; no eixo, quatro desses empilhados viram uma parede de
   * dígitos ao lado do desenho. E o gráfico não pode encurtar sozinho: dinheiro
   * chega aqui em centavos, e um "123 mil" automático sobre 123456 centavos
   * diria cem vezes o valor real.
   */
  rotularEixo?: (valor: number) => string;
  altura?: number;
  /**
   * Um controle no canto do título, para trocar o que a série mostra.
   *
   * ⚠️ Recebido de fora em vez de o gráfico saber das métricas. Ele desenha uma
   * série; quais séries existem é assunto de quem tem os dados, e embutir isso
   * aqui amarraria o kit ao Insights.
   */
  seletor?: React.ReactNode;
}) {
  /*
   * ⚠️ O ponto sob o mouse é o único estado deste componente, e por isso ele
   * mora aqui e não na tela. Subindo, cada movimento do mouse repintaria o
   * painel inteiro, com os cartões e a tabela junto.
   */
  const [sobre, setSobre] = useState<number | null>(null);

  /*
   * ⚠️ A largura do viewBox é a largura REAL do quadro, medida, e não um 640
   * fixo.
   *
   * Com `viewBox` de 640 e o elemento em outra largura, o SVG aplica o
   * `preserveAspectRatio` padrão: ele encaixa o desenho dentro do quadro e
   * CENTRALIZA o que sobra. Num cartão mais largo que 640, o gráfico ficava
   * desenhado em 640 no meio, com folga dos dois lados, e o ponteiro do mouse
   * deixava de bater com o ponto embaixo dele — que era o defeito visível.
   * Medindo, a escala é 1 para 1 e as coordenadas do mouse são as do desenho.
   */
  const quadro = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);

  useEffect(() => {
    const alvo = quadro.current;
    if (!alvo) return;

    const observador = new ResizeObserver(([entrada]) => {
      const w = Math.round(entrada.contentRect.width);
      // Piso porque o quadro rola de lado quando o cartão fica estreito demais.
      if (w > 0) setLargura(Math.max(w, 280));
    });

    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  /*
   * ⚠️ `useId` no gradiente, e não um id fixo.
   *
   * Dois gráficos na mesma página com `id="degrade"` fazem o segundo apontar
   * para a definição do primeiro: o SVG resolve id por documento, não por
   * elemento. Com o mesmo tom nos dois isso passa despercebido até o dia em que
   * um deles mudar de cor e o outro mudar junto, sem explicação.
   */
  const idBase = useId();
  const idDegrade = `deg-${idBase}`;

  /*
   * ⚠️ A geometria inteira num `useMemo`. Ela varre a série três vezes, e sem
   * isto refaria tudo a cada render do painel — inclusive nos que só mudam um
   * alerta em cima. Trinta pontos são baratos; a tela toda repintando a cada
   * troca de estado não é.
   */
  const desenho = useMemo(() => {
    if (pontos.length === 0) return null;

    const L = largura;
    const A = altura;
    /*
     * ⚠️ Folga lateral quase zero à direita: a linha vai até a borda do cartão.
     * Os 8 de antes cortavam do desenho a largura de um dia inteiro em cada
     * ponta, numa série de trinta. A base guarda 26 porque ali moram as duas
     * datas, e a esquerda abre espaço só quando há legenda de eixo para escrever.
     */
    const esq = rotularEixo ? 44 : 2;
    const margem = { topo: 18, base: 26, esq, dir: 2 };

    let maximo = -Infinity;
    let minimo = Infinity;
    let iPico = 0;

    for (let i = 0; i < pontos.length; i++) {
      const v = pontos[i].valor;
      if (v > maximo) {
        maximo = v;
        iPico = i;
      }
      if (v < minimo) minimo = v;
    }

    /*
     * ⚠️ O piso da escala é ZERO quando não há negativo, e não o menor valor.
     *
     * Ancorada no mínimo, uma série que oscila entre 900 e 1000 preenche o
     * quadro inteiro e parece ter despencado. A área em degradê depende disso
     * ainda mais: ela mede altura a partir do piso, e um piso flutuante faria a
     * mancha mentir sobre o tamanho do número.
     */
    const teto = Math.max(maximo, 1);
    const piso = Math.min(minimo, 0);
    const amplitude = teto - piso || 1;

    const x = (i: number) =>
      margem.esq + (i * (L - margem.esq - margem.dir)) / Math.max(pontos.length - 1, 1);

    const y = (v: number) =>
      margem.topo + ((teto - v) * (A - margem.topo - margem.base)) / amplitude;

    /*
     * ⚠️ Dia sem dado não vira zero: a linha liga os dias que existem. Zerar
     * afirmaria que a conta rodou e não gastou, que é outra coisa, e o vale
     * falso apareceria como queda.
     *
     * ⚠️ A curva é Catmull-Rom com os controles PRESOS entre os dois pontos que
     * ela liga, e isso não é detalhe de estilo.
     *
     * Uma curva suave solta ultrapassa os próprios pontos numa virada brusca: um
     * dia de gasto zero entre dois dias caros faria a linha descer abaixo de
     * zero, e um pico faria a curva subir acima do maior valor da série. O
     * gráfico passaria a desenhar números que não existiram. Travando o controle
     * no intervalo do trecho, ela fica redonda sem nunca sair do que foi medido.
     */
    const linha = pontos
      .map((p, i) => {
        if (i === 0) return `M ${x(0)} ${y(p.valor)}`;

        const anterior = pontos[i - 1];
        const antesDele = pontos[i - 2] ?? anterior;
        const depoisDele = pontos[i + 1] ?? p;

        const x1 = x(i - 1);
        const y1 = y(anterior.valor);
        const x2 = x(i);
        const y2 = y(p.valor);

        // Um sexto da distância entre os vizinhos é a tensão padrão da
        // Catmull-Rom; acima disso a curva começa a ondular entre os pontos.
        const entre = (v: number) => Math.min(Math.max(v, Math.min(y1, y2)), Math.max(y1, y2));

        const c1x = x1 + (x2 - x(i - 2 < 0 ? 0 : i - 2)) / 6;
        const c1y = entre(y1 + (y2 - y(antesDele.valor)) / 6);
        const c2x = x2 - (x(i + 1 > pontos.length - 1 ? pontos.length - 1 : i + 1) - x1) / 6;
        const c2y = entre(y2 - (y(depoisDele.valor) - y1) / 6);

        return `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
      })
      .join(" ");

    /*
     * A área fecha no piso da escala, e não na base do quadro: com valor
     * negativo, fechar embaixo pintaria a mancha por cima da linha do zero.
     */
    const base = y(piso);
    const area = `${linha} L ${x(pontos.length - 1)} ${base} L ${x(0)} ${base} Z`;

    /*
     * ⚠️ Quatro linhas, e sempre as MESMAS quatro: piso, dois terços do caminho
     * e teto. Escolher "números redondos" mudaria a quantidade de linhas
     * conforme a série, e dois gráficos lado a lado deixariam de ter a mesma
     * grade — que é o que permite comparar a inclinação de um com a do outro.
     */
    const marcas = [0, 1, 2, 3].map((i) => {
      const valor = piso + ((teto - piso) * i) / 3;
      return { valor, y: y(valor) };
    });

    return {
      L,
      A,
      margem,
      marcas,
      linha,
      area,
      x,
      y,
      yZero: y(0),
      temNegativo: piso < 0,
      pico: pontos[iPico],
      iPico,
      xPico: x(iPico),
      yPico: y(pontos[iPico].valor),
    };
  }, [pontos, altura, largura, rotularEixo]);

  /**
   * Qual ponto está sob o cursor.
   *
   * ⚠️ A escala é 1 para 1 porque o viewBox tem a largura medida do quadro. Ela
   * ainda é calculada a partir do retângulo, e não assumida: entre a medida e o
   * render seguinte existe um quadro em que as duas discordam, e é justamente
   * durante o redimensionamento que alguém está com o mouse em cima.
   */
  function aoMover(e: React.MouseEvent<SVGSVGElement>) {
    if (desenho == null || pontos.length === 0) return;

    const caixa = e.currentTarget.getBoundingClientRect();
    if (caixa.width === 0) return;

    const noViewBox = ((e.clientX - caixa.left) / caixa.width) * desenho.L;
    const util = desenho.L - desenho.margem.esq - desenho.margem.dir;
    const passo = util / Math.max(pontos.length - 1, 1);
    const bruto = Math.round((noViewBox - desenho.margem.esq) / passo);

    setSobre(Math.min(Math.max(bruto, 0), pontos.length - 1));
  }

  return (
    <figure
      style={{
        margin: 0,
        padding: 16,
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <figcaption
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          marginBottom: 10,
        }}
      >
        {/*
          ⚠️ Com seletor, o título SOME: ele é o próprio seletor.

          O nome da métrica escrito à esquerda e a mesma palavra dentro do campo
          à direita diziam a mesma coisa duas vezes na mesma linha, e a segunda
          ainda parecia um filtro de outra coisa.
        */}
        {seletor ?? <span>{titulo}</span>}
      </figcaption>

      {desenho == null ? (
        <div
          style={{
            display: "grid",
            placeItems: "center",
            minHeight: altura - 40,
            padding: "0 8px",
            textAlign: "center",
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
          }}
        >
          {vazio}
        </div>
      ) : (
        /* Rola dentro do próprio quadro: a página nunca rola de lado. */
        <div ref={quadro} style={{ overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${desenho.L} ${desenho.A}`}
            width="100%"
            height={desenho.A}
            role="img"
            aria-label={`${titulo} no período`}
            style={{ display: "block", minWidth: 280 }}
            onMouseMove={aoMover}
            onMouseLeave={() => setSobre(null)}
          >
            <defs>
              {/*
                ⚠️ Forte em cima, dissolvendo para baixo. O degradê existe para
                dar peso à linha sem desenhar uma segunda forma: opaco até a
                base viraria uma área sólida, que compete com a própria linha e
                esconde a inclinação, que é o que se veio ver.
              */}
              <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="55%" stopColor="var(--primary)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/*
              ⚠️ A grade vem ANTES da área e da linha, e é quase invisível de
              propósito. Ela existe para o olho estimar altura sem contar
              pixels; com traço forte, vira uma segunda forma disputando com a
              curva, que é o que se veio ver.
            */}
            {desenho.marcas.map((m) => (
              <line
                key={m.y}
                x1={desenho.margem.esq}
                x2={desenho.L - desenho.margem.dir}
                y1={m.y}
                y2={m.y}
                stroke="var(--border)"
                strokeWidth="1"
              />
            ))}

            {rotularEixo &&
              desenho.marcas.map((m) => (
                <text
                  key={`r-${m.y}`}
                  /* Encostado à direita do espaço do eixo: assim os quatro
                     números alinham pela unidade, e não pelo primeiro dígito. */
                  x={desenho.margem.esq - 8}
                  y={m.y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-tertiary)"
                >
                  {rotularEixo(m.valor)}
                </text>
              ))}

            <path d={desenho.area} fill={`url(#${idDegrade})`} stroke="none" />

            {/*
              ⚠️ Linha ZERO sempre que houver negativo. Perder seguidor é normal
              e é a informação mais útil do gráfico; sem a referência do zero,
              uma queda parece só um vale mais baixo.
            */}
            {desenho.temNegativo && (
              <line
                x1={desenho.margem.esq}
                x2={desenho.L - desenho.margem.dir}
                y1={desenho.yZero}
                y2={desenho.yZero}
                stroke="var(--border-strong)"
                strokeWidth="1"
              />
            )}

            <path
              d={desenho.linha}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/*
              ⚠️ Rótulo SELETIVO: só o pico, e ele SOME quando o mouse entra. Um
              número em todo ponto vira ruído e some com a forma; e o do pico
              disputando espaço com o do cursor faria dois valores brigarem pelo
              mesmo lugar quando o cursor passa perto dele.
            */}
            {sobre == null && (
              <>
                <circle cx={desenho.xPico} cy={desenho.yPico} r="3.5" fill="var(--primary)" />
                <text
                  x={desenho.xPico}
                  y={desenho.yPico - 9}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text-secondary)"
                >
                  {rotular(desenho.pico.valor)}
                </text>
              </>
            )}

            {/*
              ⚠️ O valor sob o cursor, com a data. Sem a data, saber quanto foi
              não diz quando foi, e o gráfico continua sendo só uma forma.
            */}
            {sobre != null && pontos[sobre] && (
              <>
                <line
                  x1={desenho.x(sobre)}
                  x2={desenho.x(sobre)}
                  y1={desenho.margem.topo}
                  y2={desenho.A - desenho.margem.base}
                  stroke="var(--border-strong)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={desenho.x(sobre)}
                  cy={desenho.y(pontos[sobre].valor)}
                  r="4"
                  fill="var(--primary)"
                  stroke="var(--surface)"
                  strokeWidth="1.5"
                />
                <Balao
                  x={desenho.x(sobre)}
                  y={desenho.y(pontos[sobre].valor)}
                  limite={desenho.L}
                  valor={rotular(pontos[sobre].valor)}
                  dia={dataBR(pontos[sobre].dia)}
                />
              </>
            )}

            <text
              x={desenho.margem.esq}
              y={desenho.A - 8}
              fontSize="11"
              fill="var(--text-tertiary)"
            >
              {dataBR(pontos[0].dia)}
            </text>
            <text
              x={desenho.L - desenho.margem.dir}
              y={desenho.A - 8}
              textAnchor="end"
              fontSize="11"
              fill="var(--text-tertiary)"
            >
              {dataBR(pontos[pontos.length - 1].dia)}
            </text>
          </svg>
        </div>
      )}
    </figure>
  );
}
