"use client";

import { formatar, formatarSemSimbolo, somar, ZERO, type Centavos } from "@/shared/utils/money";
import type { IndicadoresDeRecebimento } from "@/modules/recebimentos/recebimentos.types";

/**
 * Os cartoes do topo da listagem de baixas.
 *
 * ⚠️ SEM moldura. O cartao se recorta pelo contraste com o cinza da area de
 * trabalho, do mesmo jeito que o cartao da tabela — e uma linha por cima disso
 * so pesaria. O que da relevo e uma sombra de um pixel, nao um contorno.
 *
 * ⚠️ Anatomia unica para os tres: chip do icone, rotulo, numero, pilula de
 * variacao e a lista do detalhe. Tres desenhos diferentes numa faixa de tres
 * cartoes fazem o olho aprender tres vezes o mesmo gesto de leitura.
 */
export function IndicadoresDeBaixa({ dados }: { dados: IndicadoresDeRecebimento }) {
  const meses = dados.meses;
  const atual = meses.at(-1);
  const anterior = meses.at(-2);

  const totalDaJanela = meses.reduce<Centavos>((s, m) => somar(s, m.valor), ZERO);
  const totalPorForma = dados.porForma.reduce<Centavos>((s, f) => somar(s, f.valor), ZERO);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12,
      }}
    >
      <Cartao
        label="Recebido este mês"
        valor={formatar(atual?.valor ?? ZERO)}
        icone={<IconeEntrada />}
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

      <Cartao
        label="Como o dinheiro entrou"
        valor={formatar(totalDaJanela)}
        icone={<IconeFormas />}
        detalhe={`${meses.length} ${meses.length === 1 ? "mês" : "meses"}`}
        linhas={dados.porForma.slice(0, 3).map((f) => ({
          rotulo: f.tipo,
          valor: percentual(f.valor, totalPorForma),
        }))}
      />

      <Cartao
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
    </div>
  );
}

// ── O cartão ────────────────────────────────────────────────────────────────

type Linha = { rotulo: string; valor: string; direcao?: "sobe" | "desce" | null };

function Cartao({
  label,
  valor,
  icone,
  linhas,
  variacao: variacaoPct,
  detalhe,
  tom = "normal",
}: {
  label: string;
  valor: string;
  icone: React.ReactNode;
  linhas: Linha[];
  /** Percentual contra o periodo anterior. `null` quando nao ha com que comparar. */
  variacao?: number | null;
  /** Substitui a pilula quando nao ha variacao a mostrar. */
  detalhe?: string;
  tom?: "normal" | "atencao";
}) {
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 16,
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        // Sombra de um pixel no lugar da borda: ela levanta o cartao do fundo
        // sem desenhar uma linha que competiria com as divisorias da tabela.
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {/*
        ⚠️ `center`, e nao `flex-start`.

        Alinhado pelo topo, o chip encostava no rotulo e o numero ficava sobrando
        embaixo dele: o icone parecia pertencer a linha pequena, e nao ao valor
        que ele ilustra. Centrado, ele se apoia no bloco inteiro — que e o que
        ele representa.
      */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: "var(--radius-md)",
            /* Fundo tingido da propria cor, e nao um cinza: o chip pertence ao
               numero que ele acompanha. */
            background:
              tom === "atencao"
                ? "color-mix(in srgb, var(--warning-solido) 16%, transparent)"
                : "color-mix(in srgb, var(--primary) 10%, transparent)",
            color: tom === "atencao" ? "var(--warning-text)" : "var(--primary)",
          }}
        >
          {icone}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/*
            ⚠️ Rotulo em caixa normal, e nao o `.rotulo` do sistema.

            A versao em caixa alta e a pauta do cabecalho de TABELA: ali ela
            separa o nome da coluna do dado. Aqui o rotulo esta em cima de um
            numero de trinta pixels, e a caixa alta o transforma num segundo
            titulo disputando a leitura em vez de introduzir o primeiro.
          */}
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>
          <div
            style={{
              marginTop: 2,
              /* ⚠️ `2xl` e nao `3xl`: em 22px o valor com "R$" e milhar nao
                 cabia na largura minima do cartao e quebrava em duas linhas,
                 desalinhando o chip que o acompanha. */
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--fw-semi)",
              letterSpacing: "var(--tracking-tight)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: "var(--lh-tight)",
            }}
          >
            {valor}
          </div>
        </div>

        {variacaoPct != null ? (
          <Pilula variacao={variacaoPct} />
        ) : detalhe ? (
          <span
            style={{
              flexShrink: 0,
              padding: "3px 8px",
              borderRadius: "var(--radius-full)",
              background: "var(--surface-3)",
              color: "var(--text-tertiary)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-medium)",
              whiteSpace: "nowrap",
            }}
          >
            {detalhe}
          </span>
        ) : null}
      </div>

      {linhas.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {linhas.map((l) => (
            <div
              key={l.rotulo}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
            >
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-tertiary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {l.rotulo}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  flexShrink: 0,
                  fontSize: "var(--text-sm)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {l.direcao && <Seta para={l.direcao} />}
                {l.valor}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/**
 * A variacao contra o periodo anterior.
 *
 * ⚠️ Verde e vermelho aqui dizem SUBIU e DESCEU, e nao certo e errado. Numa
 * lista de dinheiro que entrou as duas coisas coincidem; e por isso que a
 * pilula so aparece onde a leitura e essa.
 */
function Pilula({ variacao }: { variacao: number }) {
  const sobe = variacao >= 0;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
        padding: "3px 8px",
        borderRadius: "var(--radius-full)",
        background: sobe
          ? "color-mix(in srgb, var(--success) 14%, transparent)"
          : "color-mix(in srgb, var(--danger) 12%, transparent)",
        color: sobe ? "var(--success-text)" : "var(--danger-text)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semi)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <Seta para={sobe ? "sobe" : "desce"} />
      {`${Math.abs(variacao).toFixed(1).replace(".", ",")}%`}
    </span>
  );
}

/** Triangulinho cheio. Cheio porque em 8px um contorno vira um borrao. */
function Seta({ para }: { para: "sobe" | "desce" }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="currentColor"
      style={{
        flexShrink: 0,
        color: para === "sobe" ? "var(--success)" : "var(--danger)",
      }}
    >
      {para === "sobe" ? <path d="M4 0l4 8H0z" /> : <path d="M4 8L0 0h8z" />}
    </svg>
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

function direcao(valor: Centavos, anterior: Centavos | undefined): "sobe" | "desce" | null {
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
