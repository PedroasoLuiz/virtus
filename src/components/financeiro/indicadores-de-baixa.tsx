"use client";

import {
  CartaoDeIndicador,
  FaixaDeCartoes,
  type LinhaDeIndicador,
} from "@/components/ui/cartao-de-indicador";
import { formatar, formatarSemSimbolo, somar, ZERO, type Centavos } from "@/shared/utils/money";

/**
 * O contrato que os dois lados cumprem.
 *
 * ⚠️ Declarado AQUI e nao importado de um dos modulos. Ele descreve o que o
 * cartao precisa desenhar, e os tipos de recebimento e de conta a pagar o
 * satisfazem por estrutura. Amarrado a um dos dois, o outro passaria a importar
 * o modulo alheio para exibir o proprio numero.
 */
export type DadosDeBaixa = {
  /** Do mais antigo para o mais recente. O ultimo e o mes corrente. */
  meses: { mes: string; valor: Centavos; qtd: number }[];
  aConciliar: { valor: Centavos; qtd: number };
  totalDeBaixas: number;
  porForma: { tipo: string; valor: Centavos }[];
};

/**
 * Os cartoes do topo da listagem de baixas, dos DOIS lados.
 *
 * O que entrou e o que saiu se medem igual: quanto no mes, por qual forma, e
 * quanto ainda falta conferir no extrato. Só o rotulo e o icone do primeiro
 * cartao mudam, e e isso que `sentido` decide.
 *
 * ⚠️ O cartao em si e do KIT (`ui/cartao-de-indicador`), e nao daqui. Ele saiu
 * desta tela quando o Insights precisou do mesmo gesto: uma segunda copia teria
 * divergido em respiro, peso e cor do chip, e duas telas do mesmo sistema
 * pediriam ao olho para aprender duas anatomias para ler o mesmo tipo de numero.
 */
export function IndicadoresDeBaixa({
  dados,
  sentido = "entrada",
}: {
  dados: DadosDeBaixa;
  sentido?: "entrada" | "saida";
}) {
  const saida = sentido === "saida";
  const meses = dados.meses;
  const atual = meses.at(-1);
  const anterior = meses.at(-2);

  const totalDaJanela = meses.reduce<Centavos>((s, m) => somar(s, m.valor), ZERO);
  const totalPorForma = dados.porForma.reduce<Centavos>((s, f) => somar(s, f.valor), ZERO);

  return (
    <FaixaDeCartoes>
      <CartaoDeIndicador
        label={saida ? "Pago este mês" : "Recebido este mês"}
        valor={formatar(atual?.valor ?? ZERO)}
        icone={saida ? <IconeSaida /> : <IconeEntrada />}
        variacao={variacao(atual?.valor ?? ZERO, anterior?.valor ?? ZERO)}
        /*
         * Os tres meses anteriores, do mais recente para tras. E a serie que um
         * grafico desenharia, escrita: com quatro pontos, a linha diria menos que
         * os proprios numeros, e aqui cada um pode ser lido e comparado.
         */
        linhas={meses
          .slice(0, -1)
          .reverse()
          .slice(0, 3)
          .map((m, i, todos) => ({
            rotulo: rotuloDoMes(m.mes),
            valor: formatarSemSimbolo(m.valor),
            // Compara com o mes de tras, que na lista invertida vem depois.
            direcao: direcao(m.valor, todos[i + 1]?.valor),
          }))}
      />

      <CartaoDeIndicador
        label={saida ? "Como o dinheiro saiu" : "Como o dinheiro entrou"}
        valor={formatar(totalDaJanela)}
        icone={<IconeFormas />}
        detalhe={`${meses.length} ${meses.length === 1 ? "mês" : "meses"}`}
        linhas={dados.porForma.slice(0, 3).map((f) => ({
          rotulo: f.tipo,
          valor: percentual(f.valor, totalPorForma),
        }))}
      />

      <CartaoDeIndicador
        label="A conciliar"
        valor={formatar(dados.aConciliar.valor)}
        icone={<IconeRelogio />}
        tom="atencao"
        detalhe={
          dados.aConciliar.qtd === 1 ? "1 baixa" : `${dados.aConciliar.qtd} baixas`
        }
        /*
         * ⚠️ Tudo aqui e do HISTORICO INTEIRO, e nao da janela do grafico.
         *
         * O cartao mostrava "77" em cima e "de 46" embaixo: o de cima contava
         * toda a base e o de baixo so os ultimos seis meses, e nada na tela
         * dizia isso. Conferir e trabalho acumulado — baixa de marco sem conferir
         * continua pendente hoje —, entao a janela certa e sempre tudo.
         */
        linhas={[
          {
            rotulo: "Já conferidas",
            valor: `${Math.max(0, dados.totalDeBaixas - dados.aConciliar.qtd)} de ${dados.totalDeBaixas}`,
          },
          {
            rotulo: "Conferido do total",
            valor: percentual(
              (dados.totalDeBaixas - dados.aConciliar.qtd) as Centavos,
              dados.totalDeBaixas as Centavos,
            ),
          },
        ]}
      />
    </FaixaDeCartoes>
  );
}

// ── Contas de apresentação ──────────────────────────────────────────────────

/**
 * De quanto o mes cresceu sobre o anterior.
 *
 * ⚠️ Devolve `null` quando a base e zero, e nao "infinito" nem "100%". Sair de
 * zero para qualquer coisa nao tem percentual: a conta divide por zero, e
 * escrever 100% ali seria inventar uma comparacao que nao existe.
 */
function variacao(agora: Centavos, antes: Centavos): number | null {
  if (antes <= 0) return null;
  return ((agora - antes) / antes) * 100;
}

function direcao(valor: Centavos, anterior: Centavos | undefined): LinhaDeIndicador["direcao"] {
  if (anterior == null || valor === anterior) return null;
  return valor > anterior ? "sobe" : "desce";
}

function percentual(parte: Centavos, todo: Centavos): string {
  if (todo <= 0) return "0%";
  return `${Math.round((parte / todo) * 100)}%`;
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "2026-07" vira "jul/26". O ano abreviado evita a virada de ano sem nome. */
function rotuloDoMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? mes}/${ano.slice(2)}`;
}

// ── Ícones (grade de 20) ────────────────────────────────────────────────────

/** Seta entrando numa bandeja: dinheiro que chegou. */
function IconeEntrada() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v8" />
      <path d="M6.6 7.8L10 11.2l3.4-3.4" />
      <path d="M3.5 12.5v2.2a1.8 1.8 0 001.8 1.8h9.4a1.8 1.8 0 001.8-1.8v-2.2" />
    </svg>
  );
}

/** Seta saindo de uma bandeja: dinheiro que foi embora. */
function IconeSaida() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 11V3" />
      <path d="M6.6 6.4L10 3l3.4 3.4" />
      <path d="M3.5 12.5v2.2a1.8 1.8 0 001.8 1.8h9.4a1.8 1.8 0 001.8-1.8v-2.2" />
    </svg>
  );
}

/** Tres barras de alturas diferentes: a repartição por forma. */
function IconeFormas() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M5 16V9" />
      <path d="M10 16V4" />
      <path d="M15 16v-4.5" />
    </svg>
  );
}

/** Relógio: o que ainda espera conferência. */
function IconeRelogio() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 5.8V10l2.8 2" />
    </svg>
  );
}
