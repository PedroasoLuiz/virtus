"use client";

import { useState } from "react";
import { formatar, formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import type { MesProjetado } from "@/modules/fluxo-caixa/fluxo-caixa.types";

/**
 * Entradas e saidas dos proximos meses.
 *
 * ⚠️ Barras para CIMA e para BAIXO de uma linha zero, e nao duas barras lado a
 * lado nem uma curva de saldo.
 *
 * A curva de saldo acumulado que estava aqui antes dizia uma coisa abstrata — o
 * numero que a conta teria no fim de cada mes — e escondia a que se decide em
 * cima: quanto entra e quanto sai. Com as duas de lados opostos, o mes que
 * aperta se le sem contar numero nenhum: a barra de baixo passa a de cima.
 *
 * ⚠️ E o desenho tambem e o que torna o grafico legivel para quem nao distingue
 * verde de vermelho. `--credito` e `--debito` sao os dois tons que o sistema
 * inteiro usa para dinheiro que entra e que sai, e trocar por um par mais seguro
 * aqui faria o painel discordar de todas as tabelas da casa. A saida foi tirar a
 * cor do papel de separar: quem separa e a POSICAO — acima ou abaixo da linha —,
 * e a cor so reforca o que o lado ja disse.
 */
export function GraficoDoCaixa({ meses }: { meses: MesProjetado[] }) {
  const [sobre, setSobre] = useState<number | null>(null);

  if (meses.length === 0) {
    return (
      <p style={{ margin: "28px 0", fontSize: "var(--text-md)", color: "var(--text-tertiary)" }}>
        Sem parcelas em aberto: não há o que projetar.
      </p>
    );
  }

  /*
   * ⚠️ UMA escala para os dois lados, e nao uma para cima e outra para baixo.
   *
   * Com escalas independentes, um mes de mil de entrada e cem de saida
   * desenharia as duas barras do mesmo tamanho — e a comparacao, que e o unico
   * motivo de o grafico existir, mentiria.
   */
  const teto = Math.max(...meses.flatMap((m) => [m.entrada, m.saida]), 1);

  const ALTURA = 108;
  const escala = (v: number) => Math.round((v / teto) * ALTURA);

  return (
    <div>
      {/*
        A legenda existe sempre que ha duas series. Ela e o que garante que a
        identidade nao dependa da cor: quem nao ve a diferenca de tom le "acima"
        e "abaixo" aqui e no desenho.
      */}
      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        <Chave cor="var(--credito)" texto="Entradas" />
        <Chave cor="var(--debito)" texto="Saídas" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))`,
          gap: 4,
          position: "relative",
        }}
        onMouseLeave={() => setSobre(null)}
      >
        {/*
          A linha do zero, atras das barras. Ela e o unico traco de grade: com
          linhas horizontais a cada valor, o desenho vira papel milimetrado para
          seis pares de barras que ja se comparam entre si.
        */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: ALTURA + 8,
            height: 1,
            background: "var(--border-strong)",
          }}
        />

        {meses.map((m, i) => {
          const aceso = sobre === i;

          return (
            <div
              key={m.mes}
              onMouseEnter={() => setSobre(i)}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                /* O alvo do mouse e a COLUNA inteira, e nao a barra: uma barra de
                   seis pixels de altura num mes fraco seria impossivel de mirar,
                   e e justamente o mes fraco que se quer conferir. */
                padding: "0 2px",
                borderRadius: "var(--radius-sm)",
                background: aceso ? "var(--surface-3)" : "transparent",
                cursor: "default",
              }}
            >
              {/* Metade de cima: o que entra, crescendo a partir da linha. */}
              <span
                style={{
                  height: ALTURA,
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                <Barra altura={escala(m.entrada)} cor="var(--credito)" para="cima" />
              </span>

              {/* Os 8 pixels que separam as duas barras da linha do zero: sem
                  eles, as duas se encostam e o par le como uma barra so. */}
              <span style={{ height: 17 }} />

              <span
                style={{
                  height: ALTURA,
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                }}
              >
                <Barra altura={escala(m.saida)} cor="var(--debito)" para="baixo" />
              </span>

              <span
                style={{
                  marginTop: 8,
                  fontSize: "var(--text-sm)",
                  color: m.vencido ? "var(--danger-text)" : "var(--text-tertiary)",
                  fontWeight: aceso ? "var(--fw-semi)" : "var(--fw-regular)",
                  whiteSpace: "nowrap",
                }}
              >
                {mesCurto(m.mes)}
              </span>

              {aceso && <Balao mes={m} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Uma barra.
 *
 * ⚠️ Canto arredondado SO na ponta do dado, e nunca na base. Arredondada dos
 * dois lados, ela se solta da linha do zero e passa a flutuar — e a base e
 * justamente o ponto de onde a medida parte.
 *
 * ⚠️ Altura minima de 2px quando ha valor. Um mes com cem reais contra um teto
 * de cem mil desenharia zero pixel, e "nao ha nada" e diferente de "ha pouco".
 */
function Barra({ altura, cor, para }: { altura: number; cor: string; para: "cima" | "baixo" }) {
  if (altura <= 0) return null;

  return (
    <span
      style={{
        width: "72%",
        maxWidth: 34,
        height: Math.max(altura, 2),
        background: cor,
        borderRadius:
          para === "cima" ? "var(--radius-xs) var(--radius-xs) 0 0" : "0 0 var(--radius-xs) var(--radius-xs)",
      }}
    />
  );
}

/** O mês sob o cursor, com os três números que ele carrega. */
function Balao({ mes }: { mes: MesProjetado }) {
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        bottom: "calc(100% - 4px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 5,
        minWidth: 148,
        padding: "8px 10px",
        borderRadius: "var(--radius-md)",
        /* Sem borda: a sombra ja separa o balao do desenho atras dele. */
        background: "var(--surface)",
        boxShadow: "var(--shadow-md)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-primary)",
          marginBottom: 6,
          whiteSpace: "nowrap",
        }}
      >
        {mesPorExtenso(mes.mes)}
        {mes.vencido && (
          <span style={{ color: "var(--danger-text)", fontWeight: "var(--fw-regular)" }}>
            {" "}
            · vencido
          </span>
        )}
      </div>

      <LinhaDoBalao rotulo="Entradas" valor={mes.entrada} cor="var(--credito)" />
      <LinhaDoBalao rotulo="Saídas" valor={mes.saida} cor="var(--debito)" />
      <LinhaDoBalao
        rotulo="Resultado"
        valor={mes.resultado}
        cor={mes.resultado < 0 ? "var(--debito)" : "var(--text-primary)"}
        forte
      />
    </div>
  );
}

function LinhaDoBalao({
  rotulo,
  valor,
  cor,
  forte,
}: {
  rotulo: string;
  valor: Centavos;
  cor: string;
  forte?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        fontSize: "var(--text-sm)",
        marginTop: forte ? 5 : 2,
        paddingTop: forte ? 5 : 0,
        borderTop: forte ? "1px solid var(--border)" : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {/* O rotulo fica em tinta de texto, e nao na cor da serie: cor de texto e
          cor de dado sao duas linguagens, e misturadas nenhuma das duas se le. */}
      <span style={{ color: "var(--text-tertiary)" }}>{rotulo}</span>
      <span style={{ color: cor, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
        {formatarSemSimbolo(valor)}
      </span>
    </div>
  );
}

function Chave({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden
        style={{ width: 9, height: 9, borderRadius: 3, background: cor, flexShrink: 0 }}
      />
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{texto}</span>
    </span>
  );
}

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-09-01" -> "set". O ano só aparece no balão, onde há espaço. */
function mesCurto(iso: string): string {
  return MESES[Number(iso.slice(5, 7)) - 1] ?? "";
}

function mesPorExtenso(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}

/** Exportado para o painel escrever o total do periodo ao lado do titulo. */
export function totalDe(meses: MesProjetado[], campo: "entrada" | "saida"): string {
  return formatar(meses.reduce((t, m) => t + m[campo], 0) as Centavos);
}
