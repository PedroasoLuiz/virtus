"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { ItemDoMenu, MenuDeLinha } from "@/components/ui/menu-de-linha";
import {
  AcoesDaLinha,
  CampoBloqueado,
  EmptyRow,
  Field,
  GrupoDeCampos,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  tdNum,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { competenciaBR } from "@/shared/domain/cartao";
import type { CartaoDaBaixa, FaturaDeCartao } from "@/modules/contas-pagar/contas-pagar.types";
import { CompraDrawer } from "./compra-drawer";

/**
 * Respiro vertical da célula.
 *
 * ⚠️ Só na vertical: o recuo lateral é do CSS, e estilo em linha vence seletor —
 * cravar `padding` aqui mataria a regra que tira a margem da primeira e da
 * última célula. A linha tem duas alturas de texto, e sem folga a descrição
 * encostava na régua de baixo.
 */
const CELULA: React.CSSProperties = { paddingTop: 9, paddingBottom: 9 };

/** "012 · Marketing digital" quando há código; só o nome quando não há. */
function comCodigo(codigo: string | null, descricao: string): string {
  return codigo ? `${codigo} · ${descricao}` : descricao;
}

type Lancamento = {
  id: number;
  descricao: string;
  dataCompra: string | null;
  numeroParcela: number;
  valor: number;
  cancelada: boolean;
  centroCustoCodigo: string | null;
  centroCustoNome: string | null;
  fornecedorNome: string | null;
};

/**
 * As compras de um ciclo.
 *
 * ⚠️ Cada linha é uma DESPESA, com o centro de custo dela — não é o rateio de um
 * título. É por isso que a DRE lê daqui, pela competência do ciclo.
 *
 * ⚠️ Lançar mora AQUI, e não num botão geral do cartão. Quem está olhando a
 * fatura de junho e clica em lançar já disse em que ciclo aquilo entra; um botão
 * no topo obrigaria a confiar na data para acertar a fatura, e a compra podia
 * nascer numa tela e aparecer em outra.
 */
export function ComprasDoCiclo({
  cartao,
  fatura,
  onClose,
  aoMudar,
}: {
  cartao: CartaoDaBaixa;
  fatura: FaturaDeCartao;
  onClose: () => void;
  aoMudar: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const [linhas, setLinhas] = useState<Lancamento[] | null>(null);
  const [comprando, setComprando] = useState(false);

  const aberta = fatura.status !== "FECHADA";

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/v1/contas-pagar/faturas/${fatura.id}/lancamentos`);
    if (!r.ok) return;
    const corpo = await r.json();
    setLinhas((corpo.data ?? []) as Lancamento[]);
  }, [fatura.id]);

  /*
   * ⚠️ O fetch mora DENTRO do efeito, e o setState so acontece no `then`.
   *
   * Chamar `carregar()` daqui e setState sincrono dentro do efeito — cascata de
   * render, e a regra do projeto barra. O `carregar` continua existindo para as
   * recargas depois de mexer numa linha, que sao gesto e nao montagem.
   */
  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/contas-pagar/faturas/${fatura.id}/lancamentos`, {
      signal: controle.signal,
    })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        setLinhas((corpo.data ?? []) as Lancamento[]);
      })
      .catch(() => {
        setLinhas([]);
      });

    return () => controle.abort();
  }, [fatura.id]);

  async function alternarCancelamento(l: Lancamento) {
    const r = await fetch(
      `/api/v1/contas-pagar/faturas/${fatura.id}/lancamentos/${l.id}/cancelamento`,
      { method: l.cancelada ? "DELETE" : "POST" },
    );

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("erro", "Não foi possível mudar a compra", dados?.error?.message);
      return;
    }

    await carregar();
    aoMudar();
    avisar("sucesso", l.cancelada ? "Compra reativada" : "Compra cancelada");
  }

  async function remover(l: Lancamento) {
    const r = await fetch(
      `/api/v1/contas-pagar/faturas/${fatura.id}/lancamentos/${l.id}`,
      { method: "DELETE" },
    );

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("erro", "Não foi possível remover a compra", dados?.error?.message);
      return;
    }

    await carregar();
    aoMudar();
    avisar("sucesso", "Compra removida do ciclo");
  }

  /* A cancelada nao entra na soma — ela ficou para explicar, e nao para cobrar. */
  const soma = (linhas ?? []).reduce((s, l) => s + (l.cancelada ? 0 : l.valor), 0);

  return (
    <Drawer
      open
      nivel={2}
      onClose={onClose}
      title="Lançamentos do ciclo"
    >
      {/*
        ⚠️ Os campos vêm SEM título e SEM legenda, e por isso sem `GrupoDeCampos`.

        Um título ali só teria o que dizer repetindo o que os próprios rótulos já
        dizem — "Qual cartão" acima de um campo chamado "Cartão" é a mesma
        palavra duas vezes, e a legenda seria texto de enfeite antes do primeiro
        dado da tela. O título que a tela precisa é o do ciclo, e ele é da
        tabela.

        ⚠️ O respiro embaixo é o de GRUPO, e não o de campo.

        Sem ele, "Ciclo 07/2026" nascia colado no total e os dois liam como um
        bloco só — o título parecia legenda do número acima em vez de começo da
        tabela abaixo.
      */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--form-gap-campo)",
          marginBottom: "var(--form-gap-grupo)",
        }}
      >
        {/*
          ⚠️ Cartão e total são CAMPOS, e o total saiu do rodapé da tabela.

          O cartão estava no subtítulo do drawer, onde é legenda e não dado; e a
          soma no pé da tabela obrigava a rolar até o fim para saber quanto o
          ciclo cobra — que é a primeira pergunta de quem abre.
        */}
        <Field label="Cartão">
          <CampoBloqueado
            valor={`${cartao.apelido ?? `Cartão ${cartao.id}`}${
              cartao.ultimosDigitos ? ` · •••• ${cartao.ultimosDigitos}` : ""
            }`}
          />
        </Field>

        <Field label="Total do ciclo">
          <CampoBloqueado
            valor={formatarSemSimbolo(soma as Centavos)}
            titulo="A soma das compras deste ciclo. É o que a fatura vai cobrar."
          />
        </Field>
      </section>

      {/*
        ⚠️ O ciclo é o TÍTULO da tabela, e o "+" fica colado nele.

        "O que entrou neste ciclo" descrevia a tabela sem dizer QUAL ciclo — a
        única informação que não podia faltar numa tela aberta a partir de uma
        lista de doze competências iguais. E o incluir colado no título é o
        padrão do sistema: no rodapé de uma tabela que rola, ele desce junto com
        a última linha.
      */}
      <GrupoDeCampos
        primeiro
        titulo={`Ciclo ${competenciaBR(fatura.competencia)}`}
        legenda={
          aberta
            ? "Cada linha é uma despesa própria, com o centro de custo dela. A soma é o que a fatura vai cobrar."
            : "Ciclo fechado: ele já virou conta a pagar, e as compras não mudam mais."
        }
        onIncluir={aberta ? () => setComprando(true) : undefined}
        rotuloIncluir="Lançar compra"
      >
        <TableArea minWidth={0}>
          <TableHead>
            {/* ⚠️ A DATA primeiro: a lista se lê na ordem em que as compras
                aconteceram, e é por ela que se acha uma no meio de trinta. */}
            <Th minWidth={90}>Compra</Th>
            <Th>Fornecedor</Th>
            <Th minWidth={150}>Centro de custo</Th>
            <Th align="right" minWidth={100}>
              Valor
            </Th>
            <Th> </Th>
          </TableHead>

          <tbody>
            {linhas == null && <EmptyRow colSpan={5} message="Carregando…" />}

            {linhas != null && linhas.length === 0 && (
              <EmptyRow
                colSpan={5}
                message="Nenhuma compra neste ciclo ainda."
              />
            )}

            {(linhas ?? []).map((l) => (
              <Tr key={l.id} dimmed={l.cancelada}>
                <Td style={CELULA}>
                  {l.dataCompra ? paraFormatoBR(l.dataCompra as DataISO) : "—"}
                </Td>

                {/*
                  ⚠️ O FORNECEDOR lidera, e a descrição desce em cinza menor.

                  Era o contrário, e ficava errado: a descrição é o complemento
                  ("GIMBALL 2/10"), e quem se procura numa fatura é o
                  estabelecimento — é o nome que aparece no app do banco.

                  Riscada, e não apagada: a linha cancelada continua contando o
                  que foi combinado, e só deixou de cobrar.
                */}
                <Td style={CELULA}>
                  <div
                    style={{
                      fontWeight: "var(--fw-medium)",
                      color: "var(--text-primary)",
                      textDecoration: l.cancelada ? "line-through" : undefined,
                    }}
                  >
                    {l.fornecedorNome ?? "—"}
                  </div>
                  {l.descricao && (
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-tertiary)",
                        textDecoration: l.cancelada ? "line-through" : undefined,
                      }}
                    >
                      {l.descricao}
                    </div>
                  )}
                </Td>

                <Td style={CELULA}>
                  {l.centroCustoNome ? (
                    comCodigo(l.centroCustoCodigo, l.centroCustoNome)
                  ) : (
                    <span style={{ color: "var(--text-disabled)" }}>Sem centro</span>
                  )}
                </Td>
                <Td
                  style={{
                    ...tdNum,
                    ...CELULA,
                    ...(l.cancelada ? { textDecoration: "line-through" } : {}),
                  }}
                >
                  {formatarSemSimbolo(l.valor as Centavos)}
                </Td>
                <Td style={CELULA}>
                  {aberta && (
                    <AcoesDaLinha>
                      <MenuDeLinha>
                        {(fecharMenu) => (
                          <>
                            {/*
                              ⚠️ CANCELAR e REMOVER são coisas diferentes, e as
                              duas ficam.

                              Remover é para o que foi lançado errado — digitou
                              duas vezes, errou o cartão. Cancelar é para o que
                              aconteceu e foi desfeito: estorno da loja, compra
                              negada. A cancelada fica riscada e para de somar, e
                              é ela que explica em dezembro por que a fatura de
                              maio deu menos que a soma das notas daquele mês.
                            */}
                            <ItemDoMenu
                              rotulo={l.cancelada ? "Reativar compra" : "Cancelar compra"}
                              icone={
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                >
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M5.6 5.6l12.8 12.8" />
                                </svg>
                              }
                              onClick={() => {
                                fecharMenu();
                                void alternarCancelamento(l);
                              }}
                            />

                            <ItemDoMenu
                              rotulo="Remover do ciclo"
                              perigo
                              icone={
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M2.5 4h11" />
                                  <path d="M5.5 4V2.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V4" />
                                  <path d="M12.3 4l-.7 9a.8.8 0 0 1-.8.8H5.2a.8.8 0 0 1-.8-.8L3.7 4" />
                                </svg>
                              }
                              onClick={() => {
                                fecharMenu();
                                confirmar(
                                  "Remover esta compra do ciclo?",
                                  "Remover",
                                  () => remover(l),
                                  "Ela some de vez. Se a compra aconteceu e foi desfeita, cancele em vez de remover — assim o registro fica.",
                                );
                              }}
                            />
                          </>
                        )}
                      </MenuDeLinha>
                    </AcoesDaLinha>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableArea>

      </GrupoDeCampos>

      {comprando && (
        <CompraDrawer
          cartao={cartao}
          /* ⚠️ A compra cai NESTE ciclo, e não no que a data escolheria. */
          competenciaInicial={fatura.competencia}
          onClose={() => setComprando(false)}
          aoLancar={() => {
            setComprando(false);
            void carregar();
            aoMudar();
          }}
        />
      )}
    </Drawer>
  );
}
