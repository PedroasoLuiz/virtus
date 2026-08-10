"use client";

import { DicaFlutuante, IconeInfo } from "@/components/ui/kit";

/**
 * O cartão de indicador do sistema.
 *
 * ⚠️ Nasceu nos indicadores de baixa e virou kit quando o Insights precisou do
 * mesmo gesto. Uma segunda cópia teria divergido em respiro, peso e cor do chip,
 * e duas telas do mesmo sistema pediriam ao olho para aprender duas anatomias
 * para ler o mesmo tipo de número.
 *
 * ⚠️ SEM moldura. O cartão se recorta pelo contraste com o cinza da área de
 * trabalho, do mesmo jeito que o cartão da tabela, e uma linha por cima disso só
 * pesaria. O que dá relevo é uma sombra de um pixel, não um contorno.
 *
 * ⚠️ Anatomia única: chip do ícone, rótulo, número, pílula de variação e a lista
 * do detalhe. Três desenhos diferentes numa faixa de três cartões fazem o olho
 * aprender três vezes o mesmo gesto de leitura.
 */

export type LinhaDeIndicador = {
  rotulo: string;
  valor: string;
  direcao?: "sobe" | "desce" | null;
  /** Mesma razão do `ajuda` do cartão: as linhas também carregam jargão. */
  ajuda?: string;
};

export type TomDoIndicador = "normal" | "atencao";

export function CartaoDeIndicador({
  label,
  valor,
  icone,
  linhas = [],
  variacao,
  detalhe,
  tom = "normal",
  ajuda,
}: {
  label: string;
  valor: string;
  icone: React.ReactNode;
  linhas?: LinhaDeIndicador[];
  /** Percentual contra o período anterior. `null` quando não há com que comparar. */
  variacao?: number | null;
  /** Substitui a pílula quando não há variação a mostrar. */
  detalhe?: string;
  tom?: TomDoIndicador;
  /**
   * O que a medida significa, ao passar o mouse no "i".
   *
   * ⚠️ Existe porque CTR, CPC e "resultado" são jargão de quem opera anúncio, e
   * a tela é apresentada a quem paga por eles. Escrever a definição por extenso
   * no rótulo engordaria o cartão e cansaria quem já sabe; escondida atrás do
   * ícone, ela serve quem precisa e some para quem não precisa.
   */
  ajuda?: string;
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
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              minWidth: 0,
            }}
          >
            <span
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {label}
            </span>

            {ajuda && (
              <DicaFlutuante texto={ajuda}>
                <IconeInfo />
              </DicaFlutuante>
            )}
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

        {variacao != null ? (
          <Pilula variacao={variacao} />
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
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  minWidth: 0,
                  fontSize: "var(--text-sm)",
                  color: "var(--text-tertiary)",
                }}
              >
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {l.rotulo}
                </span>
                {l.ajuda && (
                  <DicaFlutuante texto={l.ajuda}>
                    <IconeInfo />
                  </DicaFlutuante>
                )}
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

/** A faixa que os cartões ocupam. Existe aqui para o vão ser um só no sistema. */
export function FaixaDeCartoes({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A variação contra o período anterior.
 *
 * ⚠️ Verde e vermelho aqui dizem SUBIU e DESCEU, e não certo e errado. Numa
 * lista de dinheiro que entrou as duas coisas coincidem; numa de despesa, não:
 * gastar mais não é "verde". A pílula fica assim mesmo nos dois lados, porque
 * inverter a cor de um deles faria a mesma seta significar coisas opostas em
 * duas telas irmãs, e ninguém lembraria em qual está.
 */
export function Pilula({ variacao }: { variacao: number }) {
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

/** Triangulinho cheio. Cheio porque em 8px um contorno vira um borrão. */
export function Seta({ para }: { para: "sobe" | "desce" }) {
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
