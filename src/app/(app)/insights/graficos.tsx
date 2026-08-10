"use client";

import { useState } from "react";
import { selectStyle } from "@/components/ui/kit";
import { GraficoDeLinha } from "@/components/ui/grafico-de-linha";

/** O par de graficos do painel, com escolha de metrica em cada lado. */

/**
 * Duas séries lado a lado, cada uma com a própria escolha de métrica.
 *
 * ⚠️ DOIS gráficos, e nunca um com dois eixos. Escalas diferentes num par de
 * eixos fazem qualquer par parecer correlacionado, e a conclusão errada sai de
 * graça.
 *
 * ⚠️ E a escolha é por gráfico, não uma para os dois. Poder ver investimento ao
 * lado de resultados é o ponto: uma escolha só mostraria a mesma medida duas
 * vezes.
 */
export function ParDeGraficos({
  series,
  esquerda,
  direita,
  vazio,
}: {
  series: Serie[];
  esquerda: string;
  direita: string;
  vazio: React.ReactNode;
}) {
  /*
   * ⚠️ As duas escolhas moram AQUI, e não uma em cada gráfico, porque elas
   * dependem uma da outra: os dois lados nunca podem mostrar a mesma medida.
   * Dois gráficos idênticos lado a lado ocupam o dobro do espaço para dizer a
   * mesma coisa, e ainda sugerem uma comparação que não existe.
   */
  const [par, setPar] = useState<[string, string]>([esquerda, direita]);

  function escolher(lado: 0 | 1, chave: string) {
    setPar(([a, b]) => (lado === 0 ? [chave, b] : [a, chave]));
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginTop: 12,
      }}
    >
      {/*
        ⚠️ Cada lado só OFERECE o que o outro não está mostrando. A medida do
        vizinho sai da lista, em vez de ficar lá para ser escolhida e trocar os
        dois: o menu passa a descrever exatamente o que é possível, e não existe
        mais um clique cujo efeito é mexer no gráfico ao lado.
      */}
      <GraficoComEscolha
        series={series.filter((s) => s.chave !== par[1])}
        escolhida={par[0]}
        aoEscolher={(c) => escolher(0, c)}
        vazio={vazio}
      />
      <GraficoComEscolha
        series={series.filter((s) => s.chave !== par[0])}
        escolhida={par[1]}
        aoEscolher={(c) => escolher(1, c)}
        vazio={vazio}
      />
    </div>
  );
}


export type Serie = {
  chave: string;
  rotulo: string;
  pontos: { dia: string; valor: number }[];
  rotular: (valor: number) => string;
  /** O mesmo valor, curto, para o eixo da esquerda. */
  rotularEixo: (valor: number) => string;
};


function GraficoComEscolha({
  series,
  escolhida,
  aoEscolher,
  vazio,
}: {
  series: Serie[];
  escolhida: string;
  aoEscolher: (chave: string) => void;
  vazio: React.ReactNode;
}) {
  const serie = series.find((s) => s.chave === escolhida) ?? series[0];

  return (
    <GraficoDeLinha
      titulo={serie.rotulo}
      pontos={serie.pontos}
      rotular={serie.rotular}
      rotularEixo={serie.rotularEixo}
      vazio={vazio}
      seletor={
        <select
          value={serie.chave}
          onChange={(e) => aoEscolher(e.target.value)}
          /* Discreto: ele muda o gráfico, não anuncia. */
          style={{ ...selectStyle, height: 26, fontSize: "var(--text-sm)", width: "auto" }}
          aria-label="Métrica do gráfico"
        >
          {series.map((s) => (
            <option key={s.chave} value={s.chave}>
              {s.rotulo}
            </option>
          ))}
        </select>
      }
    />
  );
}
