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
  inputStyle,
} from "@/components/ui/kit";
import { CartaoDeIndicador } from "@/components/ui/cartao-de-indicador";
import { GraficoDeLinha } from "@/components/ui/grafico-de-linha";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { ehDataISO } from "@/shared/utils/datas";
import type { ProjecaoDeCaixa } from "@/modules/fluxo-caixa/fluxo-caixa.types";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import { OpcoesDoPdf } from "./opcoes-do-pdf";

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

/** "2026-09-01" -> "set/2026". */
function mesBR(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}

/**
 * Zero na grade e um traco, e nao "0,00".
 *
 * ⚠️ Mesma decisao da DRE: uma coluna cheia de zeros vira uma parede de digitos
 * onde o olho nao acha o que aconteceu. O traco diz "nao ha" sem ocupar leitura.
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

export function FluxoTela({
  inicial,
  empresa,
  emitidoPor,
}: {
  inicial: ProjecaoDeCaixa;
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
}) {
  const [projecao, setProjecao] = useState(inicial);
  const [ate, setAte] = useState<string>(inicial.ate);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /* Quem escolhe o recorte do papel é o drawer; a tela não muda com ele. */
  const [escolhendo, setEscolhendo] = useState(false);

  async function recarregar(nova: string) {
    setAte(nova);
    // Data pela metade nao vira consulta: enquanto se digita "2027-0", o valor
    // ja chega aqui e voltaria 422 a cada tecla.
    if (!ehDataISO(nova)) return;

    setCarregando(true);
    setErro(null);

    try {
      const r = await fetch(`/api/v1/relatorios/fluxo-caixa?ate=${nova}`);
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setErro(dados?.error?.message ?? "Não foi possível carregar a projeção");
        return;
      }
      setProjecao(dados.data as ProjecaoDeCaixa);
    } finally {
      setCarregando(false);
    }
  }

  /*
   * ⚠️ O gerador entra por `import()` dentro do clique, e nao no topo do
   * arquivo. `jspdf` e `jspdf-autotable` sao a maior dependencia desta tela, e
   * no topo eles viajariam com o bundle de quem so quer LER a projecao — que e
   * quase todo mundo, quase sempre. Mesmo caminho da DRE, do recibo e do extrato.
   */
  async function imprimir(recortada: ProjecaoDeCaixa) {
    const { imprimirFluxo } = await import("./pdf-fluxo");
    await imprimirFluxo(recortada, empresa, emitidoPor);
  }

  const meses = projecao.meses;
  const vazia = meses.length === 0;

  /*
    ⚠️ Os totais somam SÓ o que ainda não venceu.

    O vencido está na tabela por decisão do Pedro, mas somá-lo aqui faria os
    cartões prometerem uma entrada de 18.810 que está parada desde dezembro. O
    bloco de vencidos tem os números dele, logo abaixo.
  */
  const aVencer = meses.filter((m) => !m.vencido);
  const vencidos = meses.filter((m) => m.vencido);

  const soma = (lista: typeof meses, campo: "entrada" | "saida") =>
    lista.reduce((t, m) => t + m[campo], 0) as Centavos;

  const entradaPrevista = soma(aVencer, "entrada");
  /*
   * Quanto do previsto e multa e juros de atraso.
   *
   * ⚠️ Esta DENTRO das entradas, e nao ao lado. Somar os dois contaria o
   * acrescimo duas vezes — foi o que a coluna do cartao ensinou.
   */
  const acrescimoTotal = meses.reduce(
    (t, m) => t + m.entradaAcrescimo,
    0,
  ) as Centavos;
  const saidaPrevista = soma(aVencer, "saida");
  const saldoFinal = (meses.at(-1)?.saldo ?? projecao.saldoHoje) as Centavos;

  const serie = meses.map((m) => ({ dia: m.mes, valor: m.saldo }));

  /* O menor saldo da curva: é ele que diz se o caixa fura, e quando. */
  const fura = meses.filter((m) => !m.vencido).find((m) => m.saldo < 0);

  return (
    <PageLayout>
      <PageHeader
        title="Fluxo de caixa"
        description="O saldo de hoje e o previsto a cada mês, pelo vencimento do que está em aberto."
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Projetar até
          <input
            type="date"
            value={ate}
            disabled={carregando}
            onChange={(e) => void recarregar(e.target.value)}
            style={{
              ...inputStyle,
              width: 150,
              height: "var(--toolbar-input-h)",
            }}
          />
        </label>

        {/*
          ⚠️ Imprimir vem DEPOIS da data, indo da esquerda para a direita.

          A ordem e a do trabalho: primeiro se escolhe o horizonte, depois se
          leva ao papel o que ficou na tela. Mesma decisao da DRE.
        */}
        <BotaoDeImpressao
          rotulo={
            vazia
              ? "Nada a imprimir"
              : "Imprimir a projeção de caixa em PDF"
          }
          desabilitado={vazia || carregando}
          /*
            ⚠️ Abre as OPÇÕES, e não o PDF direto.

            Antes de gerar dá para escolher as contas e se o vencido entra — e o
            papel sai de uma consulta nova com esse recorte, sem mexer no que
            está na tela.
          */
          onClick={() => setEscolhendo(true)}
        />
      </PageHeader>

      {/*
        ⚠️ Esta tela ROLA como documento, e não como listagem — mesma anatomia da
        DRE. `PageLayout` é `overflow: hidden` de propósito: no padrão de
        listagem quem rola é a `TableArea`. Aqui há cartões, gráfico e tabela
        empilhados, e sem um roladouro próprio tudo abaixo da dobra some sem
        barra e sem nada que explique.
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

        {/*
          ⚠️ O aviso de caixa negativo vem ANTES de tudo, e só existe quando
          acontece. É a única pergunta que esta tela responde e que não pode
          esperar a pessoa achar a linha vermelha no meio de vinte meses.
        */}
        {fura && (
          <Alert variant="warning">
            O caixa fica negativo em <strong>{mesBR(fura.mes)}</strong>:{" "}
            {formatarSemSimbolo(fura.saldo)}.
          </Alert>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <CartaoDeIndicador
            label="Saldo hoje"
            valor={formatarSemSimbolo(projecao.saldoHoje)}
            icone={<Cofre />}
            detalhe={`${projecao.contas.length} ${projecao.contas.length === 1 ? "conta" : "contas"}`}
          />
          <CartaoDeIndicador
            label="A receber"
            valor={formatarSemSimbolo(entradaPrevista)}
            icone={<Seta sentido="entra" />}
            detalhe="Do mês corrente em diante"
          />
          <CartaoDeIndicador
            label="A pagar"
            valor={formatarSemSimbolo(saidaPrevista)}
            icone={<Seta sentido="sai" />}
            detalhe="Títulos e cartão em aberto"
          />
          <CartaoDeIndicador
            label={`Saldo em ${meses.length > 0 ? mesBR(meses[meses.length - 1].mes) : "—"}`}
            valor={formatarSemSimbolo(saldoFinal)}
            icone={<Seta sentido={saldoFinal < 0 ? "sai" : "entra"} />}
            tom={saldoFinal < 0 ? "atencao" : "normal"}
            detalhe={saldoFinal < 0 ? "A projeção fecha no vermelho" : undefined}
          />
        </div>

        <GraficoDeLinha
          titulo="Saldo projetado"
          pontos={serie}
          rotular={(v) => formatarSemSimbolo(v as Centavos)}
          rotularEixo={(v) => formatarSemSimbolo(v as Centavos)}
          rotularPonto={(dia) => mesBR(dia)}
          vazio="Nada em aberto para projetar."
        />

        {/*
          ⚠️ As contas ficam ABAIXO do gráfico, e não no topo.

          Elas explicam de onde vem o ponto de partida da curva — é informação de
          apoio, e quem abre esta tela quer a curva. No topo, quatro contas
          empurravam o gráfico para fora da dobra.
        */}
        <TableFrame solto>
          <TableArea minWidth={0}>
            <TableHead>
              <Th>Conta</Th>
              <Th align="right" minWidth={120}>
                Saldo hoje
              </Th>
            </TableHead>
            <tbody>
              {projecao.contas.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    {c.apelido ?? `Conta ${c.id}`}
                    {c.conta && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {c.banco ? `${c.banco} · ` : ""}
                        {c.conta}
                      </span>
                    )}
                  </Td>
                  <Td style={{ textAlign: "right", ...NUM }}>
                    {formatarSemSimbolo(c.saldo)}
                  </Td>
                </Tr>
              ))}
              <Tr>
                <Td style={{ fontWeight: "var(--fw-semi)" }}>Total</Td>
                <Td
                  style={{
                    textAlign: "right",
                    fontWeight: "var(--fw-semi)",
                    ...NUM,
                  }}
                >
                  {formatarSemSimbolo(projecao.saldoHoje)}
                </Td>
              </Tr>
            </tbody>
          </TableArea>
        </TableFrame>

        <TableFrame solto>
          <TableArea minWidth={640}>
            <TableHead>
              <Th minWidth={110}>Mês</Th>
              <Th align="right" minWidth={120}>
                Entradas
              </Th>
              <Th align="right" minWidth={120}>
                Saídas
              </Th>
              <Th align="right" minWidth={120}>
                Resultado
              </Th>
              <Th align="right" minWidth={130}>
                Saldo projetado
              </Th>
            </TableHead>

            <tbody>
              {vazia && (
                <EmptyRow colSpan={5} message="Nada em aberto para projetar." />
              )}

              {meses.map((m) => (
                <Tr key={m.mes}>
                  <Td style={NUM}>
                    {mesBR(m.mes)}
                    {/*
                      ⚠️ O mês já vencido é MARCADO, e não escondido.

                      Ele está aqui porque o Pedro pediu a série como o legado
                      fazia. Mas o saldo projetado da linha parte do saldo de
                      HOJE e soma meses que já passaram — ele não é "o saldo era
                      este". Sem a marca, essa coluna mentiria em silêncio.
                    */}
                    {m.vencido && (
                      <span
                        title="Venceu e continua em aberto. O saldo projetado desta linha não é histórico: ele parte do saldo de hoje."
                        style={{
                          marginLeft: 6,
                          padding: "1px 6px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface-3)",
                          color: "var(--text-tertiary)",
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        vencido
                      </span>
                    )}
                  </Td>
                  <Td style={{ textAlign: "right", ...NUM }}>
                    {celula(m.entrada)}
                  </Td>
                  <Td style={{ textAlign: "right", ...NUM }}>
                    {celula(m.saida)}
                  </Td>
                  <Td
                    style={{
                      textAlign: "right",
                      color: corDoResultado(m.resultado),
                      ...NUM,
                    }}
                  >
                    {celula(m.resultado)}
                  </Td>
                  <Td
                    style={{
                      textAlign: "right",
                      fontWeight: "var(--fw-medium)",
                      /* Só o negativo ganha cor: um saldo saudável não precisa
                         gritar, e vinte linhas verdes apagariam a que importa. */
                      color:
                        m.saldo < 0 ? "var(--danger-text)" : "var(--text-primary)",
                      ...NUM,
                    }}
                  >
                    {formatarSemSimbolo(m.saldo)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>
        </TableFrame>

        {/*
          ⚠️ O cartão vira OBSERVAÇÃO, e não coluna.

          Ele tinha ganhado uma coluna "do qual cartão" para poder ser conferido,
          e ela produziu justamente o erro de leitura que devia evitar: ao lado de
          "Saídas", o número lia como uma segunda saída, e a conta da diferença
          parava de fechar aos olhos de quem olhava. O cartão está dentro de
          Saídas, e uma frase diz isso melhor que uma coluna.
        */}
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          As saídas já consideram as faturas de cartão de crédito ainda abertas,
          cada uma no mês em que vence. A fatura já fechada entra como conta a
          pagar.
        </p>

        {/*
          ⚠️ As parcelas entram pelo que FALTA, e não pelo valor de face.

          A parcela paga pela metade continua aberta pela outra metade, e era o
          face que a projeção somava: a Federal aparecia com 13.500 quando a
          própria conta a receber dizia 7.550,66. É esta linha que explica a
          diferença entre o valor combinado e o que ainda entra.
        */}
        {acrescimoTotal > 0 && (
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            As entradas dos meses vencidos incluem{" "}
            <strong>{formatarSemSimbolo(acrescimoTotal)}</strong> de multa e
            juros calculados até hoje, pela política de cobrança de cada cliente.
            As parcelas entram pelo saldo que falta receber, e não pelo valor
            combinado.
          </p>
        )}

        {vencidos.length > 0 && (
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            Os meses marcados como vencidos somam{" "}
            <strong>{formatarSemSimbolo(soma(vencidos, "entrada"))}</strong> a
            receber e{" "}
            <strong>{formatarSemSimbolo(soma(vencidos, "saida"))}</strong> a
            pagar, tudo com vencimento passado e ainda em aberto. Neles o saldo
            projetado parte do saldo de hoje, e por isso não é o saldo daquele
            mês. Eles não entram nos cartões acima.
          </p>
        )}
      </div>

      {escolhendo && (
        <OpcoesDoPdf
          contas={projecao.contas}
          ate={ate}
          aoGerar={imprimir}
          onClose={() => setEscolhendo(false)}
        />
      )}
    </PageLayout>
  );
}

/**
 * O botao de imprimir do cabecalho.
 *
 * ⚠️ So o icone, e nao um botao primario com rotulo. Imprimir nao e a acao
 * principal desta tela — a principal e olhar a curva —, e com rotulo ele ganharia
 * o peso do botao que salva nos outros lugares. Mesma peca da DRE.
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

/** A seta do indicador: para cima entra, para baixo sai. */
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

/** O que ja esta na conta: um cofre, e nao uma seta — dinheiro parado. */
function Cofre() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="8" cy="8" r="2.2" />
      <path d="M4.5 13v1M11.5 13v1" />
    </svg>
  );
}

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
