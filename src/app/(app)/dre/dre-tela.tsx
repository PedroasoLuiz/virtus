"use client";

import { useState } from "react";
import {
  Alert,
  EmptyRow,
  PageHeader,
  PageLayout,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
  selectStyle,
  tdNum,
} from "@/components/ui/kit";
import { CartaoDeIndicador } from "@/components/ui/cartao-de-indicador";
import { GraficoDeLinha } from "@/components/ui/grafico-de-linha";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { acumuladoPorMes, somaDoMes } from "@/shared/domain/dre";
import type { Dre, LinhaDaDre } from "@/modules/dre/dre.types";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";

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

/** Os cinco anos que a base cobre, do corrente para tras. */
function anosDisponiveis(ate: number): number[] {
  return Array.from({ length: 5 }, (_, i) => ate - i);
}

/**
 * Zero na grade e um traco, e nao "0,00".
 *
 * ⚠️ Uma matriz de 14 colunas cheia de zeros vira uma parede de digitos onde o
 * olho nao acha o que aconteceu. O traco diz "nao houve" sem ocupar leitura.
 */
function celula(v: Centavos): string {
  return v === 0 ? "—" : formatarSemSimbolo(v);
}

/** O sinal manda na cor: sobra em verde, falta em vermelho. */
function corDoResultado(v: Centavos): string {
  if (v > 0) return "var(--success-text)";
  if (v < 0) return "var(--danger-text)";
  return "var(--text-tertiary)";
}

type Medida = "Resultado" | "Receitas" | "Despesas";

export function DreTela({
  inicial,
  empresa,
  emitidoPor,
}: {
  inicial: Dre;
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
}) {
  const [dre, setDre] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [medida, setMedida] = useState<Medida>("Resultado");

  /*
   * ⚠️ O gerador entra por `import()` dentro do clique, e nao no topo do
   * arquivo. `jspdf` e `jspdf-autotable` sao a maior dependencia desta tela, e
   * no topo eles viajariam com o bundle de quem so quer LER a DRE — que e quase
   * todo mundo, quase sempre. Mesmo caminho do recibo e do extrato.
   */
  async function imprimir() {
    const { imprimirDre } = await import("./pdf-dre");
    await imprimirDre(dre, empresa, emitidoPor);
  }

  async function trocarAno(ano: number) {
    setCarregando(true);
    setErro(null);

    try {
      const r = await fetch(`/api/v1/relatorios/dre?ano=${ano}`);
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setErro(dados?.error?.message ?? "Não foi possível carregar o ano");
        return;
      }
      setDre(dados.data as Dre);
    } finally {
      setCarregando(false);
    }
  }

  const serie = MESES.map((_, i) => ({
    dia: `${dre.ano}-${String(i + 1).padStart(2, "0")}-01`,
    valor:
      medida === "Resultado"
        ? dre.resumo.meses[i]
        : medida === "Receitas"
          ? somaDoMes(dre.receitas, i)
          : somaDoMes(dre.despesas, i),
  }));

  const vazia = dre.receitas.length === 0 && dre.despesas.length === 0;
  const acumulado = acumuladoPorMes(
    dre.resumo.meses,
    dre.resumo.acumuladoAnterior,
  );

  return (
    <PageLayout>
      <PageHeader
        title="DRE"
        description="Receitas e despesas por centro de custo, mês a mês."
      >
        <select
          style={{
            ...selectStyle,
            width: 110,
            height: "var(--toolbar-input-h)",
          }}
          value={dre.ano}
          disabled={carregando}
          onChange={(e) => trocarAno(Number(e.target.value))}
        >
          {anosDisponiveis(inicial.ano).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {/*
          ⚠️ Imprimir vem DEPOIS do ano, indo da esquerda para a direita.

          A ordem e a do trabalho: primeiro se escolhe o exercicio, depois se
          leva ao papel o que ficou na tela. Invertido, o botao de papel seria a
          primeira coisa numa tela que se abre para consultar.
        */}
        <BotaoDeImpressao
          rotulo={
            vazia
              ? "Nada a imprimir neste ano"
              : `Imprimir a DRE de ${dre.ano} em PDF`
          }
          desabilitado={vazia || carregando}
          onClick={() => void imprimir()}
        />
      </PageHeader>

      {/*
        ⚠️ Esta tela ROLA como documento, e nao como listagem.
        `PageLayout` e `Panel` sao `overflow: hidden` de proposito: no padrao de
        listagem quem rola e a `TableArea`, e a pagina nunca se mexe. Aqui ha
        cartoes, grafico e tabela empilhados, e sem um roladouro proprio tudo
        abaixo da dobra some sem barra e sem nada que explique.
      */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "0 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {erro && <Alert variant="warning">{erro}</Alert>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <CartaoDeIndicador
            label="Receitas"
            valor={formatarSemSimbolo(dre.resumo.receitas)}
            icone={<Seta sentido="entra" />}
          />
          <CartaoDeIndicador
            label="Despesas"
            valor={formatarSemSimbolo(dre.resumo.despesas)}
            icone={<Seta sentido="sai" />}
          />
          <CartaoDeIndicador
            label="Resultado"
            valor={formatarSemSimbolo(dre.resumo.lucro)}
            icone={<Seta sentido={dre.resumo.lucro < 0 ? "sai" : "entra"} />}
            tom={dre.resumo.lucro < 0 ? "atencao" : "normal"}
            detalhe={
              dre.resumo.lucro < 0 ? "O ano fecha no vermelho" : undefined
            }
          />
        </div>

        <GraficoDeLinha
          titulo={`${medida} por mês`}
          pontos={serie}
          rotular={(v) => formatarSemSimbolo(v as Centavos)}
          rotularEixo={(v) => formatarSemSimbolo(v as Centavos)}
          rotularPonto={(dia) => `${dia.slice(5, 7)}/${dia.slice(0, 4)}`}
          vazio="Nenhum lançamento neste ano."
          seletor={
            <select
              style={{ ...selectStyle, width: 130 }}
              value={medida}
              onChange={(e) => setMedida(e.target.value as Medida)}
            >
              <option value="Resultado">Resultado</option>
              <option value="Receitas">Receitas</option>
              <option value="Despesas">Despesas</option>
            </select>
          }
        />

        {/*
        ⚠️ `minWidth` obriga a tabela a rolar DE LADO dentro da area, em vez de
        espremer catorze colunas ate o numero quebrar em duas linhas. Na vertical
        ela cresce inteira: quem rola e a coluna, e uma segunda barra aqui dentro
        dividiria a altura com o grafico e as duas ficariam curtas demais.

        `solto` porque o recuo ja vem da coluna; com a margem propria, so a
        tabela andaria mais 16 para dentro e sairia do prumo dos cartoes.
      */}
        <div style={{ display: "flex", paddingBottom: 4 }}>
          <TableFrame solto>
            <TableArea minWidth={1180}>
              <TableHead>
                <Th minWidth={220}>Centro de custo</Th>
                {MESES.map((m) => (
                  <Th key={m} align="right" minWidth={72}>
                    {m}
                  </Th>
                ))}
                <Th align="right" minWidth={96}>
                  Ano
                </Th>
              </TableHead>

              <tbody>
                {vazia && (
                  <EmptyRow
                    colSpan={14}
                    message="Nenhum lançamento neste ano."
                  />
                )}

                {!vazia && (
                  <>
                    <Secao titulo="Receitas" />
                    {dre.receitas.map((l) => (
                      <LinhaDeCentro key={`r-${l.categoria}`} linha={l} />
                    ))}
                    <Soma
                      rotulo="Total de receitas"
                      meses={MESES.map((_, i) => somaDoMes(dre.receitas, i))}
                      total={dre.resumo.receitas}
                    />

                    <Secao titulo="Despesas" />
                    {dre.despesas.map((l) => (
                      <LinhaDeCentro key={`d-${l.categoria}`} linha={l} />
                    ))}
                    <Soma
                      rotulo="Total de despesas"
                      meses={MESES.map((_, i) => somaDoMes(dre.despesas, i))}
                      total={dre.resumo.despesas}
                    />

                    {/*
                    ⚠️ O resultado é a única linha colorida da tabela, e a cor sai
                    do SINAL. Pintar receita de verde e despesa de vermelho aqui
                    faria a grade inteira competir com a linha que interessa.
                  */}
                    <Soma
                      rotulo="Resultado"
                      meses={dre.resumo.meses}
                      total={dre.resumo.lucro}
                      colorirPeloSinal
                    />

                    {/*
                      ⚠️ O acumulado é informação SECUNDÁRIA, e por isso vem
                      abaixo, menor e em cinza. Ele responde outra pergunta — não
                      "quanto foi este mês", e sim "quanto sobrou até aqui" —, e
                      com o mesmo peso as duas linhas disputariam a leitura sem
                      dizer que medem coisas diferentes.

                      ⚠️ Janeiro já nasce somado ao fechamento do ano anterior. A
                      última coluna mostra esse ponto de partida em vez de
                      repetir dezembro, que seria o mesmo número da coluna ao
                      lado.
                    */}
                    <Acumulado
                      valores={acumulado}
                      anterior={dre.resumo.acumuladoAnterior}
                      ano={dre.ano}
                    />
                  </>
                )}
              </tbody>
            </TableArea>
          </TableFrame>
        </div>
      </div>
    </PageLayout>
  );
}

/** O cabeçalho de um bloco, dentro da própria tabela. */
function Secao({ titulo }: { titulo: string }) {
  return (
    <Tr>
      <Td
        colSpan={14}
        style={{
          background: "var(--surface-2)",
          fontWeight: 600,
          fontSize: "var(--text-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-secondary)",
        }}
      >
        {titulo}
      </Td>
    </Tr>
  );
}

function LinhaDeCentro({ linha }: { linha: LinhaDaDre }) {
  return (
    <Tr>
      <Td>{linha.categoria}</Td>
      {linha.meses.map((v, i) => (
        <Td key={i} style={tdNum}>
          {celula(v)}
        </Td>
      ))}
      <Td style={{ ...tdNum, fontWeight: 600 }}>{celula(linha.total)}</Td>
    </Tr>
  );
}

function Soma({
  rotulo,
  meses,
  total,
  colorirPeloSinal,
}: {
  rotulo: string;
  meses: Centavos[];
  total: Centavos;
  colorirPeloSinal?: boolean;
}) {
  const cor = colorirPeloSinal ? corDoResultado(total) : undefined;

  return (
    <Tr>
      <Td style={{ fontWeight: 600 }}>{rotulo}</Td>
      {meses.map((v, i) => (
        <Td
          key={i}
          style={{
            ...tdNum,
            fontWeight: 600,
            color: colorirPeloSinal ? corDoResultado(v) : undefined,
          }}
        >
          {celula(v)}
        </Td>
      ))}
      <Td style={{ ...tdNum, fontWeight: 700, color: cor }}>{celula(total)}</Td>
    </Tr>
  );
}

function Acumulado({
  valores,
  anterior,
  ano,
}: {
  valores: Centavos[];
  anterior: Centavos;
  ano: number;
}) {
  const secundario: React.CSSProperties = {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  };

  return (
    <Tr>
      {/*
        ⚠️ De onde a soma PARTE, escrito por extenso e junto do rótulo.

        O número morava sozinho na última coluna, como "de 13.369,56", e ali não
        dizia de que ano era nem do que se tratava. No rótulo ele lê como a frase
        que é, e a coluna do fim volta a mostrar o acumulado de dezembro, como
        todas as outras linhas da grade.
      */}
      <Td style={secundario}>
        Acumulado
        <span style={{ color: "var(--text-disabled)" }}>
          {` · parte de ${formatarSemSimbolo(anterior)}, fechamento de ${ano - 1}`}
        </span>
      </Td>
      {/*
        ⚠️ Cinza mesmo quando negativo: vermelho é da linha de RESULTADO, e com
        as duas pintadas some a diferença entre o mês e o que sobrou até ele.
      */}
      {valores.map((v, i) => (
        <Td key={i} style={{ ...tdNum, ...secundario }}>
          {formatarSemSimbolo(v)}
        </Td>
      ))}
      <Td style={{ ...tdNum, ...secundario }}>
        {formatarSemSimbolo(valores[valores.length - 1] ?? anterior)}
      </Td>
    </Tr>
  );
}

/**
 * O botão de imprimir da barra da página.
 *
 * ⚠️ Não é o `BotaoDeCabecalho` dos drawers: aquele tem 28 de altura, feita para
 * a barra de título de uma janela, e ao lado de um seletor da barra ficaria mais
 * baixo que o vizinho. Aqui a altura é a da barra (`--toolbar-input-h`), a mesma
 * do `ViewButton` e do `FilterButton`.
 *
 * Mora nesta tela, e não no kit, porque é o primeiro do tipo numa página. Quando
 * a segunda precisar imprimir, ele sobe — e aí com o nome que as duas usarem.
 */
function BotaoDeImpressao({
  rotulo,
  desabilitado,
  onClick,
}: {
  rotulo: string;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      title={rotulo}
      aria-label={rotulo}
      style={{
        height: "var(--toolbar-input-h)",
        width: "var(--toolbar-input-h)",
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        color: "var(--text-secondary)",
        cursor: desabilitado ? "not-allowed" : "pointer",
        opacity: desabilitado ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      {/* Impressora: papel saindo por cima, corpo no meio, bandeja embaixo. */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 8V4h10v4" />
        <path d="M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
        <path d="M7 14h10v6H7z" />
      </svg>
    </button>
  );
}

/** Entrada e saída, no chip do cartão. */
function Seta({ sentido }: { sentido: "entra" | "sai" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: sentido === "sai" ? "rotate(180deg)" : undefined }}
    >
      <path d="M8 13V3M4.5 6.5L8 3l3.5 3.5" />
    </svg>
  );
}
