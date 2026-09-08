"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  AcoesDaLinha,
  SeletorBuscavel,
  CampoBloqueado,
  EmptyRow,
  Field,
  Formulario,
  GrupoDeCampos,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { competenciaBR } from "@/shared/domain/cartao";
import type { CartaoDaBaixa, FaturaDeCartao } from "@/modules/contas-pagar/contas-pagar.types";
import { ComprasDoCiclo } from "./compras-do-ciclo";
import { CompraDrawer } from "./compra-drawer";
import { ItemDoMenu, MenuDeLinha } from "@/components/ui/menu-de-linha";
import { competenciaDaCompra } from "@/shared/domain/cartao";
import { hoje } from "@/shared/utils/datas";

/**
 * As faturas de um cartão, ciclo a ciclo.
 *
 * ⚠️ Drawer, e não outra página. É a mesma relação do extrato com a conta
 * bancária: a fatura não existe sozinha, ela é de um cartão. Como página, o
 * primeiro campo seria "escolha o cartão" — a pergunta que a linha já respondeu.
 */


/**
 * Respiro vertical da célula. Só na vertical: o lateral é do CSS, e estilo em
 * linha vence seletor. A linha do ciclo tem duas alturas de texto quando a
 * fatura já fechou, e sem folga a segunda encostava na régua de baixo.
 */
const CELULA: React.CSSProperties = { paddingTop: 9, paddingBottom: 9 };

const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

export function FaturasDrawer({
  cartao,
  onClose,
}: {
  cartao: CartaoDaBaixa | null;
  onClose: () => void;
}) {
  // `key` remonta a cada cartão: o estado nasce vazio sozinho, e sem mostrar as
  // faturas do cartão anterior enquanto carrega.
  return cartao == null ? null : <Conteudo key={cartao.id} cartao={cartao} onClose={onClose} />;
}

function Conteudo({ cartao, onClose }: { cartao: CartaoDaBaixa; onClose: () => void }) {
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();
  const [faturas, setFaturas] = useState<FaturaDeCartao[] | null>(null);
  const [ciclo, setCiclo] = useState<FaturaDeCartao | null>(null);
  const [comprando, setComprando] = useState(false);

  const [fornecedor, setFornecedor] = useState<{ id: number; nome: string } | null>(
    cartao.fornecedorId != null
      ? { id: cartao.fornecedorId, nome: cartao.fornecedorNome ?? "Fornecedor" }
      : null,
  );

  const buscarFornecedor = useCallback(async (termo: string) => {
    const p = new URLSearchParams({
      page: "1",
      perPage: "15",
      papel: "fornecedor",
      ativo: "true",
    });
    if (termo.trim()) p.set("busca", termo.trim());

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return [];

    const corpo = await r.json();
    return (
      (corpo.data ?? []) as { id: number; razao: string; nomeFantasia: string | null }[]
    ).map((c) => ({ id: c.id, nome: c.nomeFantasia?.trim() || c.razao }));
  }, []);

  /* Grava na hora: é um campo de escolha, e não um formulário com salvar. */
  async function salvarFornecedor(escolha: { id: number; nome: string } | null) {
    const anterior = fornecedor;
    setFornecedor(escolha);

    const r = await fetch(`/api/v1/contas-pagar/cartoes/${cartao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fornecedorId: escolha?.id ?? null }),
    });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("erro", "Não foi possível salvar o fornecedor", dados?.error?.message);
      setFornecedor(anterior);
      return;
    }

    router.refresh();
  }

  /*
   * O ciclo em que uma compra de HOJE cairia — o "corrente".
   *
   * ⚠️ Sai da mesma funcao que decide a competencia de uma compra, e nao de
   * `new Date().getMonth()`. Cartao que fecha dia 12: no dia 13 o ciclo corrente
   * ja e o do mes seguinte, e destacar o mes do calendario apontaria para uma
   * fatura que nao recebe mais nada.
   */
  const corrente = competenciaDaCompra(cartao.diaFechamento, hoje());

  /*
   * Limite disponivel = limite menos o que os ciclos ABERTOS ja comprometem.
   *
   * ⚠️ So os abertos. O ciclo fechado ja virou conta a pagar: ele deixou de
   * ocupar o cartao e passou a ser divida no banco, e conta-lo aqui mostraria o
   * mesmo dinheiro preso duas vezes.
   */
  const comprometido = (faturas ?? [])
    .filter((f) => f.status !== "FECHADA")
    .reduce((soma, f) => soma + f.total, 0);

  const disponivel = Math.max(0, cartao.limite - comprometido);

  async function carregar() {
    const r = await fetch("/api/v1/contas-pagar/faturas");
    if (!r.ok) return;
    const corpo = await r.json();
    setFaturas((corpo.data as FaturaDeCartao[]).filter((f) => f.cartaoId === cartao.id));
  }

  useEffect(() => {
    const controle = new AbortController();

    fetch("/api/v1/contas-pagar/faturas", { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        // O filtro é aqui e não na query: a lista inteira é curta, e uma rota
        // por cartão seria mais uma para manter pelo mesmo dado.
        setFaturas((corpo.data as FaturaDeCartao[]).filter((f) => f.cartaoId === cartao.id));
      })
      .catch(() => {
        setFaturas([]);
      });

    return () => controle.abort();
  }, [cartao.id]);

  async function reabrir(f: FaturaDeCartao) {
    const r = await fetch(`/api/v1/contas-pagar/faturas/${f.id}/fechamento`, {
      method: "DELETE",
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("erro", "Não foi possível reabrir a fatura", dados?.error?.message);
      return;
    }

    await carregar();
    // A conta a pagar que ela tinha gerado deixou de existir.
    router.refresh();
    avisar(
      "sucesso",
      `Fatura de ${competenciaBR(f.competencia)} reaberta`,
      "A conta a pagar dela foi apagada, e o ciclo volta a receber compras.",
    );
  }

  async function fechar(f: FaturaDeCartao) {
    const r = await fetch(`/api/v1/contas-pagar/faturas/${f.id}/fechamento`, { method: "POST" });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("erro", "Não foi possível fechar a fatura", dados?.error?.message);
      return;
    }

    avisar(
      "sucesso",
      `Conta ${dados.data.numero} gerada`,
      `A fatura virou conta a pagar de ${formatarSemSimbolo(dados.data.total)}.`,
    );
    await carregar();
    router.refresh();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Lançamentos do cartão"
    >
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="Qual cartão"
          legenda="O ciclo é dele: compra feita depois do fechamento entra na fatura seguinte."
        >
          <Field label="Cartão">
            <CampoBloqueado
              valor={`${cartao.apelido ?? `Cartão ${cartao.id}`}${
                cartao.ultimosDigitos ? ` · •••• ${cartao.ultimosDigitos}` : ""
              }`}
            />
          </Field>

          {/*
            ⚠️ O FORNECEDOR, e não o banco.

            É ele que vira o credor da conta a pagar quando o ciclo fecha, e sem
            ele o fechamento recusa. Antes o sistema inventava um cliente com o
            nome do banco — e a conta nascia no nome de um "133 Cresol" sem CNPJ
            e sem histórico, duplicando o fornecedor de verdade se ele já
            estivesse cadastrado. O banco no cartão é informação secundária.
          */}
          <Field label="Fornecedor da fatura" required>
            <SeletorBuscavel
              valor={fornecedor?.id ?? null}
              rotulo={fornecedor?.nome ?? null}
              aoEscolher={(o) => void salvarFornecedor(o)}
              buscar={buscarFornecedor}
              placeholder="Quem recebe o pagamento"
            />
          </Field>

          <Field label="Ciclo">
            <CampoBloqueado
              valor={`Fecha dia ${cartao.diaFechamento}, vence dia ${cartao.diaVencimento}`}
            />
          </Field>

          {/*
            ⚠️ Duas linhas, e nao os dois numeros na mesma.
            "1.200,00 de 5.000,00" obriga a ler uma frase para achar dois
            valores; em campos separados cada um tem rotulo e se le de relance.

            E o disponivel vem PRIMEIRO: e a pergunta de quem vai comprar. O
            limite total e referencia, nao decisao.
          */}
          <Field label="Limite disponível">
            <CampoBloqueado
              valor={
                cartao.limite > 0
                  ? formatarSemSimbolo(disponivel as Centavos)
                  : "Limite não cadastrado"
              }
              titulo="O limite menos o que os ciclos ainda abertos comprometem. Ciclo fechado já virou conta a pagar."
            />
          </Field>

          <Field label="Limite do cartão">
            <CampoBloqueado
              valor={
                cartao.limite > 0
                  ? formatarSemSimbolo(cartao.limite as Centavos)
                  : "—"
              }
            />
          </Field>
        </GrupoDeCampos>

        {/*
          ⚠️ O "+" aqui existe para o cartão SEM NENHUM ciclo.

          Lançar mora dentro do ciclo, que é onde se sabe em qual fatura a compra
          entra — mas no cartão novo não há ciclo nenhum para abrir, e sem esta
          porta a tela ficava sem saída: uma tabela vazia e nada para clicar.
          Daqui o ciclo sai da DATA da compra, pela regra do cartão, e nasce
          sozinho.
        */}
        <GrupoDeCampos
          titulo="Os ciclos"
          legenda="Fechar gera a conta a pagar da fatura. Ela é liquidação, e não despesa nova: o custo já foi lançado em cada compra."
          onIncluir={() => setComprando(true)}
          rotuloIncluir="Lançar compra"
        >
          <TableArea minWidth={0}>
            <TableHead>
              {/*
                ⚠️ A situacao vem PRIMEIRO e ocupa o minimo: so o icone.
                Ela e o estado da linha, e estado se le antes do conteudo — do
                mesmo jeito que a caixa de selecao mora na esquerda. Com pastilha
                escrita, "ABERTA" repetido em doze linhas gastava 90 pixels para
                dizer o que um relogio diz.
              */}
              {/*
                ⚠️ Larguras apertadas de propósito: a tabela vive num drawer, e
                a coluna de ações é a última — sobrando um pixel, é o "…" que sai
                da tela, e some justamente o que abre tudo.
              */}
              <Th minWidth={26}> </Th>
              <Th minWidth={82}>Competência</Th>
              <Th minWidth={88}>Vencimento</Th>
              <Th minWidth={60}>Compras</Th>
              <Th minWidth={88}>Valor</Th>
              <Th minWidth={36}> </Th>
            </TableHead>

            <tbody>
              {faturas == null && <EmptyRow colSpan={6} message="Carregando…" />}

              {faturas != null && faturas.length === 0 && (
                <EmptyRow
                  colSpan={6}
                  message="Nenhuma fatura ainda. Elas nascem na primeira baixa feita neste cartão."
                />
              )}

              {(faturas ?? []).map((f, i) => (
                <Tr
                  key={f.id}
                  delay={i * 12}
                  /* Clicar no ciclo abre as compras dele: e a pergunta que a
                     linha levanta — "o que tem dentro desses R$ 2.110?". */
                  onClick={() => setCiclo(f)}
                  /*
                    ⚠️ O ciclo CORRENTE em destaque.
                    Numa lista de doze competencias iguais, achar "a de agora"
                    exigia conferir mes por mes contra o calendario.
                  */
                  style={
                    f.competencia === corrente
                      ? { background: "var(--surface-2)" }
                      : undefined
                  }
                >
                  <Td style={CELULA}>
                    <span
                      title={f.status === "FECHADA" ? "Fechada" : "Aberta"}
                      aria-label={f.status === "FECHADA" ? "Fechada" : "Aberta"}
                      style={{
                        display: "grid",
                        placeItems: "center",
                        color:
                          f.status === "FECHADA"
                            ? "var(--success-text)"
                            : "var(--text-tertiary)",
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {f.status === "FECHADA" ? (
                          /* Check: o ciclo virou conta a pagar. */
                          <path d="M4.5 12.5l5 5 10-11" />
                        ) : (
                          /* Relógio: ainda corre, ainda recebe compra. */
                          <>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3.2 1.9" />
                          </>
                        )}
                      </svg>
                    </span>
                  </Td>

                  <Td style={{ ...NUM, ...CELULA }}>
                    <span
                      style={{
                        fontWeight:
                          f.competencia === corrente ? "var(--fw-semi)" : undefined,
                      }}
                    >
                      {competenciaBR(f.competencia)}
                    </span>
                    {f.competencia === corrente && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                          letterSpacing: "var(--tracking-wide)",
                        }}
                      >
                        ATUAL
                      </span>
                    )}

                    {/* ⚠️ Para onde a fatura foi, embaixo da competência e não
                        na coluna de ações: lá ela empurrava o "…" para fora da
                        tela. Sem isto, quem fechou não descobre o destino. */}
                    {f.status === "FECHADA" && f.contaPagarId && (
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        Conta {f.contaPagarNumero ?? f.contaPagarId}
                      </div>
                    )}
                  </Td>
                  <Td style={{ ...NUM, ...CELULA }}>
                    {f.vencimento ? paraFormatoBR(f.vencimento as DataISO) : "—"}
                  </Td>
                  <Td style={{ ...NUM, ...CELULA }}>{f.qtdLancamentos}</Td>
                  <Td style={{ ...NUM, ...CELULA }}>{formatarSemSimbolo(f.total as Centavos)}</Td>
                  <Td style={CELULA}>
                    {/*
                      ⚠️ Fechada mostra a CONTA que gerou, e não some com a ação.
                      Some, e quem fechou não descobre para onde a fatura foi.
                    */}
                    {/*
                      ⚠️ MENU de "…", e não um botão azul por linha.

                      "Fechar fatura" escrito em cada ciclo enchia a coluna de
                      botões primários — doze chamadas de ação numa lista que se
                      lê para conferir. No menu cada item tem rótulo, e o que não
                      pode aparece desabilitado com o motivo.

                      ⚠️ Fechada mostra a CONTA que gerou, e não some com tudo:
                      some, e quem fechou não descobre para onde a fatura foi.
                    */}
                    <AcoesDaLinha>
                      <MenuDeLinha>
                        {(fecharMenu) => (
                          <>
                            <ItemDoMenu
                              rotulo="Ver compras do ciclo"
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
                                  <path d="M3.4 2.4h9.2v11.2l-1.5-1-1.5 1-1.6-1-1.5 1-1.6-1-1.5 1z" />
                                  <path d="M5.8 6h4.4M5.8 8.6h3" />
                                </svg>
                              }
                              onClick={() => {
                                fecharMenu();
                                setCiclo(f);
                              }}
                            />

                            <ItemDoMenu
                              rotulo="Reabrir fatura"
                              /*
                                ⚠️ Barrado quando a conta do fechamento JÁ FOI
                                PAGA, e não só quando a fatura está aberta.

                                Reabrir apaga a conta a pagar que o fechamento
                                gerou. Com parcela paga isso apagaria junto o
                                registro de um dinheiro que saiu do banco — o
                                servidor já recusava, mas só depois de a pessoa
                                confirmar um diálogo que prometia o que não ia
                                acontecer. O motivo aparece antes do clique.
                              */
                              desabilitado={f.status !== "FECHADA" || f.contaPaga}
                              motivo={
                                f.status !== "FECHADA"
                                  ? "Esta fatura ainda está aberta"
                                  : f.contaPaga
                                    ? "A conta a pagar desta fatura já tem pagamento: reabrir apagaria o dinheiro que saiu"
                                    : undefined
                              }
                              icone={
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  {/* Seta de volta: desfaz o fechamento. */}
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              }
                              onClick={() => {
                                fecharMenu();
                                confirmar(
                                  `Reabrir a fatura de ${competenciaBR(f.competencia)}?`,
                                  "Reabrir",
                                  () => reabrir(f),
                                  "A conta a pagar gerada no fechamento será APAGADA, e o ciclo volta a receber compras. Só funciona enquanto ela não tiver pagamento.",
                                );
                              }}
                            />

                            <ItemDoMenu
                              rotulo="Fechar fatura"
                              desabilitado={f.status === "FECHADA" || f.qtdLancamentos === 0}
                              motivo={
                                f.status === "FECHADA"
                                  ? "Esta fatura já foi fechada"
                                  : f.qtdLancamentos === 0
                                    ? "Ciclo sem compras: não há o que fechar"
                                    : undefined
                              }
                              icone={
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M4.5 8.5l2.5 2.5 5-5.5" />
                                </svg>
                              }
                              onClick={() => {
                                fecharMenu();
                                /* Pede confirmação com o VALOR no texto: fechar
                                   gera dívida e não se desfaz pela tela, e o
                                   número é o que a pessoa reconhece antes de
                                   dizer sim. */
                                confirmar(
                                  `Fechar a fatura de ${competenciaBR(f.competencia)} e gerar a conta a pagar de ${formatarSemSimbolo(f.total as Centavos)}?`,
                                  "Fechar fatura",
                                  () => fechar(f),
                                  "Ela vira conta a pagar sem centro de custo: o custo já contou em cada compra. Depois de fechada não recebe mais lançamento.",
                                );
                              }}
                            />
                          </>
                        )}
                      </MenuDeLinha>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>
        </GrupoDeCampos>
      </Formulario>

      {comprando && (
        <CompraDrawer
          cartao={cartao}
          /* Sem `competenciaInicial`: o ciclo sai da data, e pode nascer agora. */
          onClose={() => setComprando(false)}
          aoLancar={() => {
            setComprando(false);
            void carregar();
            router.refresh();
          }}
        />
      )}

      {ciclo && (
        <ComprasDoCiclo
          cartao={cartao}
          fatura={ciclo}
          onClose={() => setCiclo(null)}
          aoMudar={() => {
            // O total do ciclo mudou, e uma parcela pode ter criado um ciclo
            // novo mais adiante.
            void carregar();
            router.refresh();
          }}
        />
      )}
    </Drawer>
  );
}
