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
  selectStyle,
} from "@/components/ui/kit";
import { CartaoDeIndicador } from "@/components/ui/cartao-de-indicador";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { ehDataISO, paraFormatoBR } from "@/shared/utils/datas";
import type {
  LadoDoRelatorio,
  Relatorio,
} from "@/modules/relatorios/relatorios.types";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-09-01" -> "Setembro de 2026". */
function mesPorExtenso(iso: string): string {
  const nome = MESES[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${iso.slice(0, 4)}`;
}

export function RelatoriosTela({
  inicial,
  empresa,
  emitidoPor,
}: {
  inicial: Relatorio;
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
}) {
  const [relatorio, setRelatorio] = useState(inicial);
  const [lado, setLado] = useState<LadoDoRelatorio>(inicial.lado);
  const [de, setDe] = useState<string>(inicial.de);
  const [ate, setAte] = useState<string>(inicial.ate);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /*
   * ⚠️ Considerar o cartão é ESCOLHA, e o padrão é não considerar.
   *
   * Somá-lo sem pedir mudaria o total de um relatório que a pessoa já conhece.
   * Quem quer o compromisso completo marca, e o cartão aparece em tabela própria
   * — resumido por ciclo, porque a fatura é um compromisso só.
   */
  const [comCartao, setComCartao] = useState(false);

  async function buscar(novo: {
    lado?: LadoDoRelatorio;
    de?: string;
    ate?: string;
    cartao?: boolean;
  }) {
    const alvo = {
      lado: novo.lado ?? lado,
      de: novo.de ?? de,
      ate: novo.ate ?? ate,
      cartao: novo.cartao ?? comCartao,
    };

    if (novo.lado) setLado(novo.lado);
    if (novo.de !== undefined) setDe(novo.de);
    if (novo.ate !== undefined) setAte(novo.ate);
    if (novo.cartao !== undefined) setComCartao(novo.cartao);

    // Data pela metade nao vira consulta: enquanto se digita "2026-0", o valor
    // ja chega aqui e voltaria 422 a cada tecla.
    if (!ehDataISO(alvo.de) || !ehDataISO(alvo.ate)) return;

    setCarregando(true);
    setErro(null);

    try {
      const r = await fetch(
        `/api/v1/relatorios/parcelas?lado=${alvo.lado}&de=${alvo.de}&ate=${alvo.ate}` +
          (alvo.cartao ? "&cartao=true" : ""),
      );
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setErro(dados?.error?.message ?? "Não foi possível carregar o período");
        return;
      }
      setRelatorio(dados.data as Relatorio);
    } finally {
      setCarregando(false);
    }
  }

  /*
   * ⚠️ O gerador entra por `import()` dentro do clique, e nao no topo do
   * arquivo. `jspdf` e `jspdf-autotable` sao a maior dependencia desta tela, e
   * no topo viajariam com o bundle de quem so quer LER o relatorio — que e quase
   * todo mundo, quase sempre. Mesmo caminho da DRE, do extrato e do fluxo.
   */
  async function imprimir() {
    const { imprimirParcelas } = await import("./pdf-parcelas");
    await imprimirParcelas(relatorio, empresa, emitidoPor);
  }

  /* Vazio de verdade: sem parcelas E sem ciclo de cartão para mostrar. */
  const vazio =
    relatorio.meses.length === 0 &&
    (relatorio.cartao?.ciclos.length ?? 0) === 0;
  const recebe = relatorio.lado === "receber";

  return (
    <PageLayout>
      <PageHeader
        title="Relatórios"
        description="O que falta receber e o que falta pagar, por mês de vencimento."
      >
        <select
          style={{
            ...selectStyle,
            width: 150,
            height: "var(--toolbar-input-h)",
          }}
          value={lado}
          disabled={carregando}
          onChange={(e) => void buscar({ lado: e.target.value as LadoDoRelatorio })}
        >
          <option value="receber">Contas a receber</option>
          <option value="pagar">Contas a pagar</option>
        </select>

        <input
          type="date"
          value={de}
          disabled={carregando}
          onChange={(e) => void buscar({ de: e.target.value })}
          style={{ ...inputStyle, width: 145, height: "var(--toolbar-input-h)" }}
        />
        <input
          type="date"
          value={ate}
          disabled={carregando}
          onChange={(e) => void buscar({ ate: e.target.value })}
          style={{ ...inputStyle, width: 145, height: "var(--toolbar-input-h)" }}
        />

        {/*
          ⚠️ O interruptor do cartão só existe do lado que PAGA.

          Cartão de crédito é dívida da empresa; não há equivalente do lado que
          recebe, e um controle desabilitado ali faria procurar o que ele
          significa.
        */}
        {lado === "pagar" && (
          <button
            type="button"
            onClick={() => void buscar({ cartao: !comCartao })}
            disabled={carregando}
            /* `aria-pressed` vinha do `MarcaDeUso`; sem ele o leitor de tela
               anunciaria um botao comum, sem dizer se esta ligado. */
            aria-pressed={comCartao}
            title="Somar as faturas de cartão ainda abertas que vencem no período"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: "var(--toolbar-input-h)",
              padding: "0 10px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              cursor: carregando ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {/*
              ⚠️ A caixinha é DESENHADA aqui, e não o `MarcaDeUso` do kit.

              Aquele componente é um `<button>`, e um botão dentro de outro é
              HTML inválido: o navegador desmonta a árvore e o React acusa erro
              de hidratação. Quem recebe o clique é o botão de fora, que cobre o
              rótulo junto — mirar uma caixa de 15px ao lado de um texto clicável
              seria trabalho que o rótulo absorve.
            */}
            <MarcaDoInterruptor marcado={comCartao} />
            Cartão de crédito
          </button>
        )}

        {/*
          ⚠️ Imprimir vem por ÚLTIMO, indo da esquerda para a direita.

          A ordem é a do trabalho: escolhe-se o lado, o período, e só então se
          leva ao papel o que ficou na tela. Mesma decisão da DRE e do fluxo.
        */}
        <BotaoDeImpressao
          rotulo={vazio ? "Nada a imprimir" : "Imprimir o relatório em PDF"}
          desabilitado={vazio || carregando}
          onClick={() => void imprimir()}
        />
      </PageHeader>

      {/*
        ⚠️ Esta tela ROLA como documento, e não como listagem — mesma anatomia da
        DRE e do fluxo. No padrão de listagem quem rola é a `TableArea`; aqui há
        cartões e vários blocos de mês empilhados, e sem um roladouro próprio
        tudo abaixo da dobra some sem barra e sem nada que explique.
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
            label={recebe ? "A receber no período" : "A pagar no período"}
            valor={formatarSemSimbolo(relatorio.total)}
            icone={<Seta sentido={recebe ? "entra" : "sai"} />}
            detalhe={`${relatorio.quantidade} ${relatorio.quantidade === 1 ? "parcela" : "parcelas"}`}
          />
          <CartaoDeIndicador
            label="Já vencido"
            valor={formatarSemSimbolo(relatorio.vencido)}
            icone={<Relogio />}
            tom={relatorio.vencido > 0 ? "atencao" : "normal"}
            detalhe={
              relatorio.vencido > 0
                ? "Venceu e continua em aberto"
                : "Nada em atraso"
            }
          />
          <CartaoDeIndicador
            label="A vencer"
            valor={formatarSemSimbolo(
              (relatorio.total - relatorio.vencido) as Centavos,
            )}
            icone={<Relogio />}
            detalhe="Ainda dentro do prazo"
          />
        </div>

        {vazio && (
          <TableFrame solto>
            <TableArea minWidth={0}>
              <tbody>
                <EmptyRow
                  colSpan={1}
                  message={
                    recebe
                      ? "Nada a receber neste período."
                      : "Nada a pagar neste período."
                  }
                />
              </tbody>
            </TableArea>
          </TableFrame>
        )}

        {/*
          ⚠️ Uma TABELA POR MÊS, e não uma tabela só com linhas de separação.

          O subtotal é o que se veio ler, e como linha no meio de uma grade longa
          ele se perde entre as parcelas. Cada mês fechando a sua própria tabela
          deixa o total onde o olho já está quando termina de ler o bloco.
        */}
        {relatorio.meses.map((m) => (
          <div key={m.mes}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semi)",
                  color: "var(--text-primary)",
                }}
              >
                {mesPorExtenso(m.mes)}
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semi)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatarSemSimbolo(m.total)}
              </span>
            </div>

            <TableFrame solto>
              <TableArea minWidth={720}>
                <TableHead>
                  <Th minWidth={96}>Vencimento</Th>
                  <Th minWidth={70}>Nº</Th>
                  <Th minWidth={64}>Parcela</Th>
                  <Th>{recebe ? "Cliente" : "Fornecedor"}</Th>
                  <Th minWidth={70} align="right">
                    Atraso
                  </Th>
                  <Th minWidth={110} align="right">
                    Em aberto
                  </Th>
                </TableHead>

                <tbody>
                  {m.parcelas.map((p) => (
                    <Tr key={p.parcelaId}>
                      <Td style={NUM}>{paraFormatoBR(p.vencimento)}</Td>
                      <Td style={NUM}>{p.documentoNumero}</Td>
                      <Td style={NUM}>
                        {p.numero}/{p.deQuantas}
                      </Td>
                      <Td>
                        <span style={CORTA}>{p.pessoa}</span>
                        {/*
                          ⚠️ A descrição é LEGENDA do nome, e não coluna própria.
                          Ela é texto livre e comprido; em coluna, empurraria o
                          valor para fora da folha no primeiro título com uma
                          frase inteira.
                        */}
                        {p.descricao && (
                          <span
                            style={{
                              ...CORTA,
                              display: "block",
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {p.descricao}
                          </span>
                        )}
                      </Td>
                      {/*
                        ⚠️ Só o atraso ganha cor, e só quando existe. Pintar toda
                        linha vencida faria um relatório de cobrança inteiro
                        vermelho, e aí a cor deixa de apontar alguma coisa.
                      */}
                      <Td
                        style={{
                          ...NUM,
                          textAlign: "right",
                          color:
                            p.diasDeAtraso > 0
                              ? "var(--danger-text)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {p.diasDeAtraso > 0 ? `${p.diasDeAtraso} d` : "—"}
                      </Td>
                      <Td
                        style={{
                          ...NUM,
                          textAlign: "right",
                          fontWeight: "var(--fw-medium)",
                        }}
                      >
                        {formatarSemSimbolo(p.emAberto)}
                        {/*
                          ⚠️ A parcela paga pela metade mostra de quanto ela era.
                          Sem isso, "250,00" numa parcela de 2.500 parece erro de
                          cadastro — e é justamente o caso que o relatório antigo
                          errava, cobrando o valor cheio.
                        */}
                        {p.jaPago > 0 && (
                          <span
                            style={{
                              display: "block",
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--text-tertiary)",
                              fontWeight: "var(--fw-regular)",
                            }}
                          >
                            de {formatarSemSimbolo(p.valor)}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>
            </TableFrame>
          </div>
        ))}

        {/*
          ⚠️ O cartão vem em TABELA SEPARADA, e não misturado nos meses.

          Ele não é parcela de título: não tem número de documento, não tem
          fornecedor único e não se cobra dele parcela a parcela. Uma linha por
          ciclo, que é como o compromisso existe — a fatura vence inteira, num dia
          só. Misturado, precisaria de colunas vazias em toda linha para caber na
          grade das parcelas.
        */}
        {relatorio.cartao && relatorio.cartao.ciclos.length > 0 && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semi)",
                  color: "var(--text-primary)",
                }}
              >
                Cartão de crédito
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semi)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatarSemSimbolo(relatorio.cartao.total)}
              </span>
            </div>

            <TableFrame solto>
              <TableArea minWidth={600}>
                <TableHead>
                  <Th minWidth={96}>Vencimento</Th>
                  <Th minWidth={110}>Ciclo</Th>
                  <Th>Cartão</Th>
                  <Th minWidth={80} align="right">
                    Compras
                  </Th>
                  <Th minWidth={110} align="right">
                    Total
                  </Th>
                </TableHead>

                <tbody>
                  {relatorio.cartao.ciclos.map((c) => (
                    <Tr key={c.faturaId}>
                      <Td style={NUM}>{paraFormatoBR(c.vencimento)}</Td>
                      <Td style={NUM}>
                        Ciclo {c.competencia.slice(5, 7)}/
                        {c.competencia.slice(0, 4)}
                      </Td>
                      <Td>
                        <span style={CORTA}>{c.cartao}</span>
                      </Td>
                      <Td style={{ ...NUM, textAlign: "right" }}>{c.compras}</Td>
                      <Td
                        style={{
                          ...NUM,
                          textAlign: "right",
                          fontWeight: "var(--fw-medium)",
                        }}
                      >
                        {formatarSemSimbolo(c.total)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>
            </TableFrame>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              Só os ciclos ainda abertos, pelo vencimento da fatura. O ciclo já
              fechado virou conta a pagar e aparece nos meses acima.
            </p>
          </div>
        )}

        {!vazio && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 8,
              borderTop: "1px solid var(--border-strong)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
            }}
          >
            <span>Total do período</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatarSemSimbolo(relatorio.total)}
            </span>
          </div>
        )}

        {!vazio && (
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            Os valores são o saldo que falta, e não o valor combinado da parcela:
            a que já recebeu parte entra apenas pelo restante. Parcelas
            canceladas e títulos cancelados não aparecem.
          </p>
        )}
      </div>
    </PageLayout>
  );
}

/**
 * O botao de imprimir do cabecalho.
 *
 * ⚠️ So o icone, e nao um botao primario com rotulo. Imprimir nao e a acao
 * principal desta tela — a principal e olhar o que falta —, e com rotulo ele
 * ganharia o peso do botao que salva nos outros lugares. Mesma peca da DRE.
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

/**
 * A caixinha do interruptor, desenhada e nao clicavel.
 *
 * ⚠️ Copia o desenho do `MarcaDeUso` do kit — mesma medida, mesma borda, mesmo
 * check — sem ser um botao. O kit nao tem versao passiva dela, e aqui ela vive
 * DENTRO de um botao: usar o componente produziria botao dentro de botao, que e
 * HTML invalido.
 */
function MarcaDoInterruptor({ marcado }: { marcado: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 15,
        height: 15,
        display: "grid",
        placeItems: "center",
        borderRadius: 4,
        border: `1px solid ${marcado ? "var(--primary)" : "var(--border-strong)"}`,
        background: marcado ? "var(--primary)" : "transparent",
        color: "var(--primary-fg)",
        flexShrink: 0,
      }}
    >
      {marcado && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12.5l5.5 5.5L20 6.5" />
        </svg>
      )}
    </span>
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

/** Prazo: o que separa o vencido do que ainda vence. */
function Relogio() {
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
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.6V8l2.2 1.3" />
    </svg>
  );
}

/** O texto que nao pode empurrar a coluna: corta com reticencias. */
const CORTA: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
