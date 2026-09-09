"use client";

import Link from "next/link";
import { Alert, PageHeader, PageLayout, Panel } from "@/components/ui/kit";
import { GraficoDoCaixa } from "./grafico-do-caixa";
import { formatar, formatarSemSimbolo, subtrair, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR } from "@/shared/utils/datas";
import type { ProjecaoDeCaixa } from "@/modules/fluxo-caixa/fluxo-caixa.types";
import type { ParcelaDoRelatorio, Relatorio } from "@/modules/relatorios/relatorios.types";

/**
 * A visao geral.
 *
 * ⚠️ Ela responde QUATRO perguntas, nesta ordem, e nada mais: quanto tenho,
 * quanto entra, quanto sai, e o que sobra. E a leitura de quem abre o sistema de
 * manha — e por isso os quatro numeros vem antes de qualquer desenho.
 *
 * ⚠️ Tudo aqui e ATALHO. Cada bloco leva a tela que responde aquilo por inteiro:
 * o saldo vai para as contas, o que entra para os titulos a receber, o que sai
 * para os a pagar. Painel que so mostra obriga a pessoa a achar o caminho de
 * novo pelo menu, e ela ja estava olhando para o numero.
 *
 * ⚠️ O VENCIDO tem tratamento proprio, em vermelho, e nao vira mais um cartao.
 * Ele nao e uma quinta medida: e um pedaco das outras duas que precisa de
 * resposta hoje, e escondido dentro do total ele so apareceria no dia em que
 * alguem fosse conferir parcela por parcela.
 */
export function Painel({
  caixa,
  aReceber,
  aPagar,
}: {
  caixa: ProjecaoDeCaixa | null;
  aReceber: Relatorio | null;
  aPagar: Relatorio | null;
}) {
  const entra = aReceber?.total ?? (0 as Centavos);
  const sai = aPagar?.total ?? (0 as Centavos);
  const sobra = subtrair(entra, sai);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Visão geral" />

        {/*
          ⚠️ Esta tela ROLA como documento, e nao como listagem. `PageLayout` e
          `Panel` sao `overflow: hidden` de proposito: no padrao de listagem quem
          rola e a tabela. Aqui ha blocos empilhados, e sem um roladouro proprio
          o que passa da dobra some sem barra e sem nada que explique.

          ⚠️ O vao entre os blocos e o MESMO da pagina (`--vao-da-pagina`). Um
          espacamento so na tela inteira, do menu ao ultimo cartao: com um numero
          para a margem e outro para o miolo, o olho ve duas gradezas e nao sabe
          qual e a regra.
        */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            margin: "0 var(--vao-da-pagina) var(--vao-da-pagina)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--vao-da-pagina)",
          }}
        >
          {!caixa && !aReceber && !aPagar && (
            <Alert variant="warning">
              Não consegui carregar os números agora. Recarregue a página; se continuar, o problema
              é do servidor e não do seu cadastro.
            </Alert>
          )}

          {/* ── Os quatro números ────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              /* Quatro em tela larga, dois em tela media, um no celular — sem
                 media query: o `auto-fit` faz a conta sozinho. */
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "var(--vao-da-pagina)",
            }}
          >
            <Numero
              rotulo="Saldo em contas"
              valor={caixa ? formatar(caixa.saldoHoje) : null}
              apoio={
                caixa
                  ? `${caixa.contas.length} ${caixa.contas.length === 1 ? "conta" : "contas"}`
                  : undefined
              }
              tom={caixa && caixa.saldoHoje < 0 ? "ruim" : "neutro"}
              href="/contas"
            />

            <Numero
              rotulo="A receber no mês"
              valor={aReceber ? formatar(aReceber.total) : null}
              apoio={
                aReceber
                  ? `${aReceber.quantidade} ${aReceber.quantidade === 1 ? "parcela" : "parcelas"}`
                  : undefined
              }
              alerta={
                aReceber && aReceber.vencido > 0
                  ? `${formatar(aReceber.vencido)} vencido`
                  : undefined
              }
              tom="bom"
              href="/faturas"
            />

            <Numero
              rotulo="A pagar no mês"
              valor={aPagar ? formatar(aPagar.total) : null}
              /* ⚠️ A fatura de cartao e CONTADA no apoio, e nao so somada no
                 total. `quantidade` conta parcelas; com o cartao dentro do
                 numero e fora da contagem, "14 parcelas" nao explicava de onde
                 vinham os cinco mil a mais. */
              apoio={aPagar ? contagemAPagar(aPagar) : undefined}
              alerta={
                aPagar && aPagar.vencido > 0 ? `${formatar(aPagar.vencido)} vencido` : undefined
              }
              tom="ruim"
              href="/contas-pagar"
            />

            <Numero
              rotulo="Sobra prevista"
              valor={aReceber && aPagar ? formatar(sobra) : null}
              apoio="No mês, se tudo for liquidado"
              tom={sobra < 0 ? "ruim" : "bom"}
              href="/relatorios"
            />
          </div>

          {/*
            ── O que entra e o que sai, mes a mes ────────────────────────────

            ⚠️ Largura INTEIRA, e nao dividindo a linha com a lista de contas.
            Sao seis pares de barras: espremidos em dois tercos da tela, o par de
            cada mes fica com dez pixels de largura e a comparacao — que e a
            unica razao do desenho existir — deixa de ser possivel.
          */}
          <Cartao>
            <Titulo texto="Entradas e saídas · próximos meses" href="/relatorios" />
            <GraficoDoCaixa meses={caixa?.meses ?? []} />
          </Cartao>

          {/* ── As contas e os dois lados do que vence ───────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
              gap: "var(--vao-da-pagina)",
              alignItems: "start",
            }}
          >
            <Cartao>
              <Titulo texto="Contas" href="/contas" />

              {caixa && caixa.contas.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {caixa.contas.map((c) => (
                    <Linha
                      key={c.id}
                      principal={c.apelido ?? `Conta ${c.id}`}
                      apoio={[c.banco, c.conta].filter(Boolean).join(" · ") || undefined}
                      valor={formatarSemSimbolo(c.saldo)}
                      negativo={c.saldo < 0}
                    />
                  ))}

                  {/* O total fecha a lista: sem ele, a soma dos saldos era uma
                      conta de cabeça em cima de quatro linhas. */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                      fontSize: "var(--text-md)",
                      fontWeight: "var(--fw-semi)",
                    }}
                  >
                    <span>Total</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatarSemSimbolo(caixa.saldoHoje)}
                    </span>
                  </div>
                </div>
              ) : (
                <Vazio texto="Nenhuma conta bancária cadastrada." />
              )}
            </Cartao>

            <Cartao>
              <Titulo texto="A receber — próximos" href="/faturas" />
              <Vencimentos parcelas={proximas(aReceber)} vazio="Nada a receber neste mês." />
            </Cartao>

            <Cartao>
              <Titulo texto="A pagar — próximos" href="/contas-pagar" />
              <Vencimentos parcelas={proximas(aPagar)} vazio="Nada a pagar neste mês." />
            </Cartao>
          </div>
        </div>
      </Panel>
    </PageLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   As peças
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * O cartão branco. Sem borda e sem sombra.
 *
 * ⚠️ A sombra ficou reservada ao que se CLICA — os discos da barra, a pílula do
 * topo, o cartão da empresa. Um bloco de leitura com elevação prometeria um
 * gesto que ele não tem, e a tela inteira passaria a flutuar.
 */
function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        minWidth: 0,
      }}
    >
      {children}
    </section>
  );
}

/**
 * Um dos quatro números do topo.
 *
 * ⚠️ O cartão INTEIRO é o link, e não um "ver mais" no canto. O número é o que a
 * pessoa está olhando; obrigá-la a mirar um texto de nove pixels ao lado dele
 * seria cobrar precisão por um destino que o cartão todo já anuncia.
 */
function Numero({
  rotulo,
  valor,
  apoio,
  alerta,
  tom,
  href,
}: {
  rotulo: string;
  /** Nulo quando a consulta daquele número falhou. */
  valor: string | null;
  apoio?: string;
  /** O vencido, em vermelho. Ausente quando não há atraso. */
  alerta?: string;
  tom: "bom" | "ruim" | "neutro";
  href: string;
}) {
  const cor =
    tom === "bom" ? "var(--credito)" : tom === "ruim" ? "var(--debito)" : "var(--text-primary)";

  return (
    <Link
      href={href}
      style={{
        display: "block",
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        textDecoration: "none",
        minWidth: 0,
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "var(--surface)")}
    >
      <div className="rotulo" style={{ marginBottom: 10 }}>
        {rotulo}
      </div>

      <div
        style={{
          fontSize: "var(--text-3xl)",
          fontWeight: "var(--fw-semi)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: "var(--lh-tight)",
          fontVariantNumeric: "tabular-nums",
          color: valor ? cor : "var(--text-disabled)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {valor ?? "—"}
      </div>

      {/*
        ⚠️ A linha de baixo tem altura FIXA, mesmo vazia.

        Os quatro cartões ficam lado a lado: com um deles sem apoio e outro com
        vencido, o número de um subia dois pixels em relação ao vizinho — e uma
        fileira de números desalinhados é o tipo de coisa que se vê sem
        conseguir nomear.
      */}
      <div style={{ marginTop: 6, minHeight: 16, display: "flex", alignItems: "center", gap: 8 }}>
        {alerta ? (
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
              color: "var(--danger-text)",
              whiteSpace: "nowrap",
            }}
          >
            {alerta}
          </span>
        ) : (
          apoio && (
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {apoio}
            </span>
          )
        )}
      </div>
    </Link>
  );
}

/** O título de um cartão, com o caminho para a tela que o responde por inteiro. */
function Titulo({ texto, href }: { texto: string; href: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <span className="rotulo">{texto}</span>
      <Link
        href={href}
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--primary)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Ver tudo
      </Link>
    </div>
  );
}

/** Uma linha de lista: nome à esquerda, valor à direita. */
function Linha({
  principal,
  apoio,
  valor,
  negativo,
  destaque,
}: {
  principal: string;
  apoio?: string;
  valor: string;
  negativo?: boolean;
  /** O apoio em vermelho: é o atraso. */
  destaque?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "7px 0",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-base)",
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {principal}
        </span>
        {apoio && (
          <span
            style={{
              display: "block",
              fontSize: "var(--text-sm)",
              color: destaque ? "var(--danger-text)" : "var(--text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {apoio}
          </span>
        )}
      </span>

      <span
        style={{
          flexShrink: 0,
          fontSize: "var(--text-md)",
          fontWeight: "var(--fw-medium)",
          fontVariantNumeric: "tabular-nums",
          color: negativo ? "var(--debito)" : "var(--text-primary)",
        }}
      >
        {valor}
      </span>
    </div>
  );
}

/**
 * As parcelas que vencem primeiro.
 *
 * ⚠️ CINCO, e não a lista inteira. O painel diz o que exige atenção hoje; a
 * lista completa é a tela ao lado, a um clique no "ver tudo". Vinte linhas aqui
 * empurrariam o resto do painel para debaixo da dobra.
 */
function Vencimentos({ parcelas, vazio }: { parcelas: ParcelaDoRelatorio[]; vazio: string }) {
  if (parcelas.length === 0) return <Vazio texto={vazio} />;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {parcelas.map((p) => (
        <Linha
          key={p.parcelaId}
          principal={p.pessoa}
          apoio={
            p.diasDeAtraso > 0
              ? `Venceu há ${p.diasDeAtraso} ${p.diasDeAtraso === 1 ? "dia" : "dias"}`
              : `Vence em ${paraFormatoBR(p.vencimento)}`
          }
          destaque={p.diasDeAtraso > 0}
          valor={formatarSemSimbolo(p.emAberto)}
        />
      ))}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p
      style={{
        margin: "12px 0",
        fontSize: "var(--text-md)",
        color: "var(--text-tertiary)",
      }}
    >
      {texto}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Contas
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * As cinco parcelas mais urgentes do relatório.
 *
 * ⚠️ A ordem é a do VENCIMENTO, e o relatório vem agrupado por mês. Achatar os
 * meses e reordenar é o que faz "a mais atrasada primeiro" valer para o período
 * inteiro, e não só dentro de cada mês.
 */
function proximas(r: Relatorio | null): ParcelaDoRelatorio[] {
  if (!r) return [];

  return r.meses
    .flatMap((m) => m.parcelas)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .slice(0, 5);
}

/** "14 parcelas · 1 fatura de cartão" — o que forma o total a pagar. */
function contagemAPagar(r: Relatorio): string {
  const partes = [`${r.quantidade} ${r.quantidade === 1 ? "parcela" : "parcelas"}`];
  const ciclos = r.cartao?.ciclos.length ?? 0;

  if (ciclos > 0) {
    partes.push(`${ciclos} ${ciclos === 1 ? "fatura de cartão" : "faturas de cartão"}`);
  }
  return partes.join(" · ");
}
