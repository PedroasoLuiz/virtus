"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BotaoDeCabecalho,
  BotaoHistorico,
  Drawer,
} from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import { NovoRecebimentoDrawer } from "../recebimentos/novo-recebimento-drawer";
import { Icon } from "@/components/layout/icones";
import {
  Alert,
  AcoesDaLinha,
  CampoBloqueado,
  EmptyRow,
  Field,
  GrupoDeCampos,
  MarcaDeConciliacao,
  PanelTabs,
  TableArea,
  TableHead,
  Td,
  tdNum,
  Th,
  Tr,
} from "@/components/ui/kit";
import { EditorDeParcelamento } from "@/components/financeiro/editor-de-parcelamento";
import { TicketDrawer } from "../tickets/ticket-drawer";
import {
  oQuePodeNaConta,
  proximaAReceber,
  saldoAReceber,
  totalRecebido,
} from "@/shared/domain/parcelas";
import { ehPessoaFisica } from "@/shared/domain/cadastro-pessoa";
import { formatarDocumento } from "@/shared/domain/documento";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Fatura, Parcela } from "./fatura-tipos";
import { curto, periodo, vencida } from "./fatura-datas";
import { AnexarDocumento, Documentos } from "./fatura-documentos";
import { ItemDoMenu, MenuDeLinha } from "@/components/ui/menu-de-linha";

/**
 * Detalhe da conta a receber.
 *
 * Ordem herdada da tela `faturas_detahes` do FlutterFlow: primeiro quanto ja
 * entrou e quanto falta, depois de quem e a fatura, e so entao o detalhamento.
 *
 * Tickets e parcelas ficam em abas. No lugar da lista de servicos vem a de
 * TICKETS: no modelo novo o servico vive no ticket, e a conta a receber e
 * composta por valor de um ou mais deles. Clicar num ticket abre o drawer dele
 * — o detalhe do servico esta la, nao aqui.
 *
 * Os campos aparecem como campo de texto bloqueado, com cadeado, e nao como
 * texto solto: a tela ainda nao edita nada, e o cadeado explica por que.
 */

export function FaturaDrawer({
  faturaId,
  emitidoPor,
  onClose,
  nivel,
}: {
  faturaId: number | null;
  /** Quem assina o rodape dos documentos. Vazio quando a tela nao sabe. */
  emitidoPor?: string;
  onClose: () => void;
  /**
   * O andar em que ele abre. Padrao 1, o da tela de listagem.
   *
   * ⚠️ Existe porque o extrato abre este mesmo drawer POR CIMA dele: a coluna
   * "Registro" leva da linha do banco ate o titulo sem sair da conferencia. No
   * andar 1 os dois ficariam empilhados no mesmo z, e fechar um fecharia a
   * leitura do outro junto.
   */
  nivel?: 1 | 2 | 3;
}) {
  // `key` remonta a cada fatura: o estado nasce vazio sozinho, sem limpar a mao
  // dentro de um efeito, e sem mostrar o registro anterior enquanto carrega.
  return faturaId == null ? null : (
    <Conteudo
      key={faturaId}
      faturaId={faturaId}
      emitidoPor={emitidoPor ?? ""}
      onClose={onClose}
      nivel={nivel}
    />
  );
}

function Conteudo({
  faturaId,
  emitidoPor,
  onClose,
  nivel,
}: {
  faturaId: number;
  emitidoPor: string;
  onClose: () => void;
  nivel?: 1 | 2 | 3;
}) {
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"tickets" | "produtos" | "parcelas">(
    "tickets",
  );
  // Ticket aberto por cima da conta: o drawer empilha, o de tras nao fecha.
  const [ticketAberto, setTicketAberto] = useState<number | null>(null);
  // Guarda QUAL parcela, e nao um booleano: a baixa acontece sobre uma parcela
  // escolhida na linha, e o drawer que abre mostra so ela.
  const [baixando, setBaixando] = useState<number | null>(null);
  const [dividindo, setDividindo] = useState(false);
  const { avisar, confirmar } = useAvisos();

  async function cancelarConta() {
    const r = await fetch(`/api/v1/faturas/${faturaId}/cancelamento`, {
      method: "PUT",
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível cancelar a cobrança",
      );
      return;
    }

    avisar("sucesso", "Cobrança cancelada", "A conta não é mais cobrável.");
    setFatura(dados.data);
  }

  async function excluirConta() {
    const r = await fetch(`/api/v1/faturas/${faturaId}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível excluir a conta",
      );
      return;
    }
    avisar("sucesso", "Conta a receber excluída");
    onClose();
  }

  /**
   * A impressora do cabecalho gera o RESUMO da conta inteira.
   *
   * Nao e o recibo: o recibo comprova UMA parcela paga e vive no menu dela,
   * onde se sabe qual. Este mostra o acordo — de onde vem, quanto e, em quantas
   * vezes, e o que ja entrou.
   */
  async function imprimirConta() {
    if (!fatura) return;
    const { imprimirResumoDaConta } = await import("./pdf-recibo-pagamento");

    await imprimirResumoDaConta(
      {
        numeroConta: fatura.numero,
        situacao: fatura.situacao,
        competencia: periodo(fatura.apuracaoInicio, fatura.apuracaoFim),
        clienteNome: fatura.clienteNome,
        clienteDoc: fatura.clienteDoc,
        total: fatura.total,
        pago,
        desconto: fatura.parcelas.reduce((soma, p) => soma + p.desconto, 0),
        tickets: fatura.tickets.map((t) => ({
          numero: t.numero,
          titulo: t.titulo,
          valor: t.valor,
          data: t.encerradoEm,
        })),
        parcelas: fatura.parcelas.map((p) => ({
          numero: p.numero,
          vencimento: p.vencimento,
          total: p.total,
          desconto: p.desconto,
          pago: p.pago,
        })),
        emitente: fatura.emitente,
      },
      emitidoPor,
    );
  }

  async function desvincularTicket(ticketId: number) {
    const r = await fetch(`/api/v1/faturas/${faturaId}/tickets/${ticketId}`, {
      method: "DELETE",
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível remover o ticket",
      );
      return;
    }

    // Conta apagada: nao ha o que recarregar, e o drawer fecha.
    if (dados?.data?.contaExcluida) {
      avisar("sucesso", "Conta a receber excluída", "Era o único ticket dela.");
      onClose();
      return;
    }
    recarregar();
  }

  /*
   * Recarrega o registro inteiro depois de anexar ou remover documento.
   *
   * O endpoint ja devolve a conta atualizada, mas buscar de novo mantem UM
   * caminho de leitura: com a tela remendando o proprio estado a partir da
   * resposta de cada acao, a divergencia aparece na terceira acao seguida.
   */
  /**
   * Cancela uma parcela: ela foi combinada, mas não vai mais ser cobrada.
   *
   * ⚠️ Espelho do lado que paga. NÃO é apagar nem dar desconto: apagar sumiria
   * com o combinado, e desconto diria que a dívida foi perdoada — o que muda a
   * DRE. Contrato encerrado não perdoa nada, ele deixa de gerar cobrança.
   */
  async function cancelarParcela(parcelaId: number) {
    const r = await fetch(
      `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/cancelamento`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível cancelar");
      return;
    }

    recarregar();
  }

  async function reativarParcela(parcelaId: number) {
    const r = await fetch(
      `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/cancelamento`,
      {
        method: "DELETE",
      },
    );

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível reativar");
      return;
    }

    recarregar();
  }

  const recarregar = useCallback(() => {
    fetch(`/api/v1/faturas/${faturaId}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok)
          throw new Error(
            corpo?.error?.message ?? "Falha ao carregar a fatura",
          );
        setFatura(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error) setErro(e.message);
      });
  }, [faturaId]);

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/faturas/${faturaId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok)
          throw new Error(
            corpo?.error?.message ?? "Falha ao carregar a fatura",
          );
        setFatura(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [faturaId]);

  /*
   * ⚠️ Os tres numeros saem das PARCELAS, e o "em aberto" nunca de uma subtracao.
   *
   * `total - recebido` ignora o desconto: uma conta de 1.500 baixada com 500 de
   * desconto recebeu 1.000 e esta quitada, e a subtracao a mostrava com 500 em
   * aberto para sempre. A parcela e quem carrega a verdade sobre o pagamento.
   */
  /*
   * ⚠️ O que da para fazer nesta conta sai da MESMA regra que o servidor aplica.
   *
   * A tela apaga o que nao pode; o servico recusa de novo. Escrita duas vezes,
   * ela divergiria no primeiro ajuste e a tela passaria a oferecer o que o
   * servidor vai negar.
   */
  const pode = fatura
    ? oQuePodeNaConta({
        cancelada: fatura.cancelada,
        parcelas: fatura.parcelas.map((p) => ({
          id: p.id,
          numero: p.numero,
          // Parcela antiga pode nao ter vencimento; a regra so precisa ordenar,
          // e a string vazia manda para o comeco sem quebrar a comparacao.
          vencimento: (p.vencimento ?? "") as DataISO,
          valor: p.total as Centavos,
          pago: p.pago,
          cancelada: p.cancelada,
        })),
      })
    : null;

  const pago = fatura ? totalRecebido(fatura.parcelas) : 0;
  const emAberto = fatura ? saldoAReceber(fatura.parcelas) : 0;
  const descontado = fatura
    ? fatura.parcelas.reduce((s, p) => s + p.desconto, 0)
    : 0;
  const temBaixa = fatura?.parcelas.some((p) => p.pago) ?? false;

  // A unica que pode receber agora. As de tras dela ficam com o "Dar baixa"
  // desabilitado, dizendo por que.
  const proxima = fatura ? proximaAReceber(fatura.parcelas) : null;
  const parcelaEmBaixa =
    fatura?.parcelas.find((p) => p.id === baixando) ?? null;

  return (
    <Drawer
      open
      nivel={nivel}
      onClose={onClose}
      /*
        ⚠️ O título não carrega mais o número. Ele virou o campo "Código" logo no
        alto da ficha, onde dá para copiar; repetido no título, era o mesmo dado
        duas vezes na mesma tela, e ainda empurrava os botões do cabeçalho.
      */
      title="Conta a receber"
      headerExtra={
        fatura ? (
          <>
            {/* Imprimir a conta inteira, e nao a parcela: o recibo de UMA
                parcela vive no menu dela, onde se sabe qual. */}
            <BotaoDeCabecalho
              rotulo="Imprimir conta"
              onClick={() => void imprimirConta()}
            >
              {/* Tracado na grade de 24, que e o `viewBox` do botao de
                  cabecalho. Desenhado em 16, o icone saia a dois tercos. */}
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2" />
              <rect x="6" y="14" width="12" height="7" rx="1" />
            </BotaoDeCabecalho>

            {/* Cancelar existe porque a falta dele custava caro: sem ele, a
                saída para uma conta que não seria recebida era dar baixa com
                valor zero, o que deixa no extrato um lançamento de R$ 0,00 e
                marca como recebido um dinheiro que nunca entrou. */}
            {!fatura.cancelada && (
              <BotaoDeCabecalho
                rotulo={
                  temBaixa
                    ? "Conta com parcela recebida não é cancelada; estorne o recebimento antes"
                    : "Cancelar cobrança"
                }
                desabilitado={temBaixa}
                onClick={() =>
                  confirmar(
                    `Cancelar a cobrança da conta ${fatura.numero}?`,
                    "Cancelar cobrança",
                    cancelarConta,
                    "A conta para de ser cobrável e sai das listagens do dia a dia. O histórico e os documentos ficam.",
                  )
                }
              >
                {/* Círculo cortado: proibido, e não um X, que aqui significaria
                    fechar o drawer. */}
                <circle cx="12" cy="12" r="9" />
                <path d="M5.6 5.6l12.8 12.8" />
              </BotaoDeCabecalho>
            )}

            <BotaoDeCabecalho
              rotulo={
                temBaixa
                  ? "Conta com baixa não é excluída, é cancelada"
                  : "Excluir conta a receber"
              }
              perigo
              desabilitado={temBaixa}
              onClick={() =>
                confirmar(
                  `Excluir a conta ${fatura.numero}?`,
                  "Excluir",
                  excluirConta,
                  "Parcelas, anexos e o vínculo com os tickets vão junto. O saldo deles volta.",
                )
              }
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
              <path d="M10 11v6M14 11v6" />
            </BotaoDeCabecalho>

            <BotaoHistorico
              criadoEm={fatura.historico.criadoEm}
              criadoPor={fatura.historico.criadoPor}
              editadoEm={fatura.historico.editadoEm}
              editadoPor={fatura.historico.editadoPor}
            />
          </>
        ) : null
      }
    >
      {erro && (
        /*
          O `Alert` do kit, e nao uma caixa escrita aqui. A que existia
          pintava o TEXTO de `--danger-text` sobre `--danger-bg`, e o
          proprio kit avisa que essa combinacao tem menos contraste que o
          preto do resto da pagina. La quem carrega a gravidade e o icone
          e o cartao.
        */
        <Alert variant="danger" title={erro} />
      )}

      {!fatura && !erro && <Esqueleto />}

      {fatura && (
        <>
          {/*
            ⚠️ O ritmo é o do FORMULÁRIO, o mesmo da ficha de pessoa: campos
            colados entre si, título colado no primeiro campo, e o vão grande só
            entre um assunto e outro. Antes havia um `gap: 3` escrito aqui, que
            acertava o vão dos campos por acaso e errava todo o resto.

            ⚠️ Os campos são BLOQUEADOS, com cadeado. A conta não se edita: ela é
            o retrato do que foi combinado nos tickets, e o que muda são as
            parcelas, na aba delas.
          */}
          {/*
            ⚠️ Sem título nem legenda aqui.

            O que está em cima da tabela é a identificação da conta, e ela não
            precisa se apresentar: o drawer já se chama "Conta a receber" e traz o
            número. Cada aba tem o próprio título logo acima da tabela dela, que é
            onde o assunto realmente muda.
          */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--form-gap-campo)",
            }}
          >
            {/*
                ⚠️ O código vem PRIMEIRO, e é campo com cadeado como os outros.

                Ele é o que se dita ao telefone e o que o cliente cita ao pagar:
                escrito só no título do drawer, some quando a pessoa rola a
                tabela, e não dá para copiar.
              */}
            <Field label="Código">
              <CampoBloqueado
                valor={String(fatura.numero)}
                titulo="O número é dado pelo sistema quando a conta nasce."
              />
            </Field>

            <Field label="Cliente">
              <CampoBloqueado valor={fatura.clienteNome ?? "—"} />
            </Field>

            {/*
                ⚠️ O documento aparece LOGO ABAIXO do nome, e não noutra seção.

                Dois clientes com nome parecido são a hora exata em que alguém
                confere o CNPJ, e é a mesma hora em que ele precisa ser copiado
                para o boleto ou para a nota.
              */}
            <Field label={ehPessoaFisica(fatura.clienteDoc) ? "CPF" : "CNPJ"}>
              <CampoBloqueado
                valor={
                  fatura.clienteDoc ? formatarDocumento(fatura.clienteDoc) : "—"
                }
              />
            </Field>

            <Field label="Apuração">
              <CampoBloqueado
                valor={periodo(fatura.apuracaoInicio, fatura.apuracaoFim)}
              />
            </Field>

            <Field label="Situação">
              <CampoBloqueado valor={fatura.situacao} />
            </Field>

            {/*
              ⚠️ Os três valores viraram CAMPO, um por linha, e saíram do rodapé.

              No rodapé eles eram uma linha de números soltos, com rótulo miúdo, e
              o "em aberto" — que é o que decide se ainda há o que cobrar — tinha
              o mesmo peso do resto. Como campo, cada um tem o rótulo à esquerda
              como todo dado da ficha, e dá para copiar o valor.
            */}
            <Field label="Total">
              <CampoBloqueado
                valor={formatarSemSimbolo(fatura.total as Centavos)}
              />
            </Field>

            <Field label="Recebido">
              <CampoBloqueado valor={formatarSemSimbolo(pago as Centavos)} />
            </Field>

            {/*
              ⚠️ O desconto só aparece quando existe, e existe para a conta
              FECHAR: total menos desconto menos recebido é zero numa conta
              quitada. Sem esta linha, quem confere via 1.500 cobrados e 1.000
              recebidos, com nada em aberto, e procurava os 500 sumidos.
            */}
            {descontado > 0 && (
              <Field label="Desconto">
                <CampoBloqueado
                  valor={formatarSemSimbolo(descontado as Centavos)}
                />
              </Field>
            )}

            <Field label="Em aberto">
              <CampoBloqueado
                valor={formatarSemSimbolo(emAberto as Centavos)}
              />
            </Field>

            {fatura.observacoes && (
              <Field label="Observações">
                <CampoBloqueado valor={fatura.observacoes} multilinha />
              </Field>
            )}
          </div>

          {/*
            ⚠️ O vão antes das abas é o dos GRUPOS do formulário (22).

            Sem ele, as abas encostavam no último campo e pareciam pertencer a
            ele; elas começam outro assunto, e o respiro é o que diz isso.
          */}
          <div style={{ marginTop: "var(--form-gap-grupo)" }} />

          <PanelTabs
            tabs={[
              `Tickets (${fatura.tickets.length})`,
              "Produtos",
              `Parcelas (${fatura.parcelas.length})`,
            ]}
            active={
              aba === "tickets"
                ? `Tickets (${fatura.tickets.length})`
                : aba === "produtos"
                  ? "Produtos"
                  : `Parcelas (${fatura.parcelas.length})`
            }
            onChange={(t) =>
              setAba(
                t.startsWith("Tickets")
                  ? "tickets"
                  : t === "Produtos"
                    ? "produtos"
                    : "parcelas",
              )
            }
          />

          {aba === "tickets" ? (
            /*
              ⚠️ O título não repete o nome da aba.

              A aba já se chama Tickets; um título "Tickets" em cima de uma coluna
              "Ticket" é a mesma palavra três vezes na mesma tela, e nenhuma delas
              informa. O título diz o que aquela lista É para esta conta.
            */
            <GrupoDeCampos
              primeiro
              titulo="Serviços prestados"
              legenda="Cada ticket entra com o valor que foi tirado dele, e a soma é o total desta conta. O detalhe do serviço mora dentro do ticket: o menu da linha abre."
            >
              <TableArea minWidth={0}>
                <TableHead>
                  <Th minWidth={70}>Código</Th>
                  <Th minWidth={110}>Encerrado</Th>
                  <Th align="right" minWidth={110}>
                    Valor
                  </Th>
                  <Th> </Th>
                </TableHead>

                <tbody>
                  {fatura.tickets.length === 0 && (
                    <EmptyRow
                      colSpan={4}
                      message="Nenhum ticket vinculado a esta conta."
                    />
                  )}

                  {fatura.tickets.map((t) => (
                    <Tr key={t.ticketId}>
                      <Td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {t.numero}
                      </Td>

                      <Td>
                        {t.encerradoEm ? (
                          paraFormatoBR(t.encerradoEm as DataISO)
                        ) : (
                          <span style={{ color: "var(--text-disabled)" }}>
                            —
                          </span>
                        )}
                      </Td>

                      <Td style={tdNum}>
                        {formatarSemSimbolo(t.valor as Centavos)}
                      </Td>

                      <Td>
                        <AcoesDaLinha>
                          <MenuDeLinha>
                            {(fechar) => (
                              <>
                                <ItemDoMenu
                                  rotulo="Abrir ticket"
                                  icone={<Icon name="ticket" size={14} />}
                                  onClick={() => {
                                    fechar();
                                    setTicketAberto(t.ticketId);
                                  }}
                                />

                                {/* Tirar o ticket devolve o saldo dele; sendo o unico, a
                          conta inteira vai junto. Recusado quando ha baixa: o
                          dinheiro entrou contra ESTE ticket, e soltar o vinculo
                          faria o saldo voltar como se nada tivesse sido cobrado. */}
                                <ItemDoMenu
                                  rotulo="Remover desta conta"
                                  perigo
                                  desabilitado={temBaixa}
                                  motivo={
                                    temBaixa
                                      ? "Conta com parcela baixada"
                                      : undefined
                                  }
                                  onClick={() => {
                                    fechar();
                                    confirmar(
                                      `Remover o ticket ${t.numero} desta conta?`,
                                      "Remover",
                                      () => desvincularTicket(t.ticketId),
                                      fatura.tickets.length === 1
                                        ? "É o único ticket, então a conta a receber será excluída."
                                        : "O saldo dele volta a ficar disponível para cobrar.",
                                    );
                                  }}
                                >
                                  <path d="M12 4L4 12M4 4l8 8" />
                                </ItemDoMenu>
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
          ) : aba === "produtos" ? (
            /*
             * Ainda sem implementacao — a aba existe para nao esquecer.
             *
             * Produto mexe no dinheiro: hoje o total da conta e exatamente a
             * soma do que se tirou dos tickets, e e isso que faz o faturamento
             * parcial fechar. Com produto, o total passa a ser tickets +
             * produtos, e a conferencia de origem precisa de outra regra.
             */
            /*
              ⚠️ A tabela vazia do sistema, e não uma caixa tracejada.

              O tracejado dizia "área em construção", que é linguagem de
              protótipo; a tabela vazia diz a mesma coisa com o desenho que todas
              as outras listas usam quando não têm o que mostrar.
            */
            <GrupoDeCampos
              primeiro
              titulo="Itens vendidos"
              legenda="Peça, material ou licença. Uma conta pode ser só de produto, sem serviço nenhum. Ainda não entram: eles mexem no total, e o total hoje é exatamente o que veio dos tickets."
            >
              <TableArea minWidth={0}>
                <TableHead>
                  <Th>Descrição</Th>
                  <Th align="right" minWidth={90}>
                    Quantidade
                  </Th>
                  <Th align="right" minWidth={110}>
                    Valor
                  </Th>
                </TableHead>

                <tbody>
                  <EmptyRow colSpan={3} message="Nenhum produto nesta conta." />
                </tbody>
              </TableArea>
            </GrupoDeCampos>
          ) : (
            <GrupoDeCampos
              primeiro
              titulo="Pagamento"
              legenda="Cada parcela vence e é recebida por conta própria. A vencida aparece em vermelho, e o menu da linha é onde se dá baixa, prorroga o vencimento ou se emite o recibo."
              /*
                ⚠️ O mais só existe quando a REGRA deixa, e a regra é a mesma que o
                servidor aplica. Aparecendo sempre, ele convidava a um clique que
                voltava com recusa; sumindo, quem passa o mouse no título nem
                descobre que existia.
              */
              onIncluir={
                pode?.parcelas.pode ? () => setDividindo(true) : undefined
              }
              // O rótulo diz o que acontece: a tela abre o cronograma inteiro,
              // e nao acrescenta uma parcela solta.
              rotuloIncluir="Mexer no parcelamento"
            >
              <TableArea minWidth={0}>
                <TableHead>
                  <Th minWidth={54}>#</Th>
                  {/*
                  ⚠️ Conciliado é sobre o EXTRATO, não sobre a baixa.

                  Dar baixa é dizer "recebi"; conciliar é ter conferido que o
                  dinheiro apareceu na conta. Sem esta coluna, as duas viravam a
                  mesma coisa na leitura, e quem fecha o mês não tinha como ver o
                  que ainda falta bater.

                  ⚠️ Fica ANTES do vencimento, junto do número: as duas primeiras
                  colunas respondem "em que pé está esta parcela", e o resto é o
                  conteúdo dela.
                */}
                  <Th minWidth={90}>Conciliado</Th>
                  <Th minWidth={110}>Vencimento</Th>
                  <Th align="right" minWidth={120}>
                    Valor
                  </Th>
                  <Th minWidth={90}>Documentos</Th>
                  <Th> </Th>
                </TableHead>

                <tbody>
                  {fatura.parcelas.length === 0 && (
                    <EmptyRow colSpan={6} message="Nenhuma parcela gerada." />
                  )}

                  {fatura.parcelas.map((p) => (
                    <Tr
                      key={p.id}
                      /*
                      ⚠️ Vencida pinta a LINHA toda. A data sozinha em vermelho se
                      perde no meio da tabela, e atraso é o único estado aqui que
                      pede ação hoje.
                    */
                      /*
                        ⚠️ A cancelada fica APAGADA, e não escondida: ela conta a
                        história do contrato — doze combinadas, quatro cobradas.
                      */
                      style={
                        p.cancelada
                          ? { color: "var(--text-disabled)" }
                          : vencida(p)
                            ? {
                                background: "var(--danger-bg)",
                                color: "var(--danger-text)",
                              }
                            : undefined
                      }
                    >
                      <Td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <Bolinha parcela={p} />
                          {p.numero}
                        </span>
                      </Td>

                      <Td>
                        <MarcaDeConciliado parcela={p} />
                      </Td>

                      <Td>
                        {p.vencimento ? (
                          curto(p.vencimento)
                        ) : (
                          <span style={{ color: "var(--text-disabled)" }}>
                            —
                          </span>
                        )}
                      </Td>

                      <Td style={tdNum}>
                        {formatarSemSimbolo(p.total as Centavos)}

                        {/* Mesma anatomia do desconto logo abaixo: o valor em
                          cima, e o que aconteceu com ele numa segunda linha. */}
                        {p.cancelada && (
                          <div
                            title={
                              p.motivoDoCancelamento ??
                              "Não vai ser cobrada: continua na conta como histórico"
                            }
                            style={{
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--text-disabled)",
                            }}
                          >
                            cancelada
                          </div>
                        )}

                        {/* Desconto dado na baixa: sem mostrar aqui, a soma das
                          parcelas não fecha com o total e parece erro de conta. */}
                        {p.desconto > 0 && (
                          <div
                            title={`Desconto de ${formatarSemSimbolo(p.desconto as Centavos)}`}
                            style={{
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--credito)",
                            }}
                          >
                            −{formatarSemSimbolo(p.desconto as Centavos)}
                          </div>
                        )}
                      </Td>

                      <Td>
                        <Documentos
                          faturaId={fatura.id}
                          parcelaId={p.id}
                          boleto={p.boleto}
                          nfs={p.nfs}
                          comprovante={p.comprovante}
                          bloqueado={
                            p.pagamentoId != null ||
                            fatura.situacao === "CANCELADA"
                          }
                          aoMudar={recarregar}
                        />
                      </Td>

                      <Td>
                        <AcoesDaLinha>
                          <MenuDeLinha>
                            {(fechar) => (
                              <AcoesDaParcela
                                aoBaixar={() => setBaixando(p.id)}
                                aoEditarParcelamento={() => setDividindo(true)}
                                fatura={fatura}
                                emitidoPor={emitidoPor}
                                parcela={p}
                                proxima={proxima}
                                bloqueado={
                                  p.pagamentoId != null ||
                                  fatura.situacao === "CANCELADA"
                                }
                                aoMudar={recarregar}
                                fechar={fechar}
                                aoCancelar={() =>
                                  confirmar(
                                    `Cancelar a parcela ${p.numero}?`,
                                    "Cancelar parcela",
                                    () => void cancelarParcela(p.id),
                                    "Ela deixa de ser cobrada e continua na conta, marcada como cancelada.",
                                  )
                                }
                                aoReativar={() => void reativarParcela(p.id)}
                              />
                            )}
                          </MenuDeLinha>
                        </AcoesDaLinha>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>
            </GrupoDeCampos>
          )}
        </>
      )}

      {/*
       * Receber abre o MESMO drawer da tela de recebimentos, so que ja com o
       * cliente escolhido e esta parcela preenchida.
       *
       * Antes havia uma tela de baixa propria aqui. Duas telas para o mesmo fato
       * sao dois lugares para manter corretos, e elas divergem: a de recebimento
       * ja sabia repartir um pagamento entre contas, e a daqui nunca saberia,
       * porque so enxerga uma conta.
       *
       * A lista de clientes tem um item so de proposito: o pagador esta decidido
       * pela conta que se esta olhando.
       */}
      {fatura && parcelaEmBaixa && fatura.clienteId != null && (
        <NovoRecebimentoDrawer
          clientes={[
            { id: fatura.clienteId, nome: fatura.clienteNome ?? "Cliente" },
          ]}
          clienteInicial={fatura.clienteId}
          parcelaInicial={parcelaEmBaixa.id}
          onClose={() => setBaixando(null)}
          aoCriar={() => {
            setBaixando(null);
            recarregar();
          }}
        />
      )}

      {dividindo && fatura && pode && (
        <EditorDeParcelamento
          url={`/api/v1/faturas/${fatura.id}/parcelas`}
          numero={String(fatura.numero)}
          contraparte={fatura.clienteNome}
          rotuloContraparte="Cliente"
          tituloDaConta="Conta a receber"
          total={fatura.total}
          parcelas={fatura.parcelas}
          pode={pode}
          onClose={() => setDividindo(false)}
          aoSalvar={() => {
            setDividindo(false);
            recarregar();
          }}
        />
      )}

      <TicketDrawer
        ticketId={ticketAberto}
        somenteLeitura
        onClose={() => setTicketAberto(null)}
      />
    </Drawer>
  );
}

/**
 * O parcelamento inteiro numa tabela editavel.
 *
 * ⚠️ Uma GRADE, e nao tres campos que dividem uma parcela ao meio. Quem vendeu
 * 10.000 e combinou 2.000 num dia, 1.200 no outro e o resto depois precisa
 * digitar o cronograma; chegar nele por divisoes sucessivas era trabalho manual
 * para descrever uma coisa so.
 *
 * ⚠️ A regra de ouro esta a vista: a soma tem de bater com o total da conta. O
 * rodape mostra a diferenca enquanto ela existe e o salvar fica travado — o
 * servidor confere de novo, mas ninguem deveria descobrir isso pela recusa.
 *
 * ⚠️ Da para digitar VALOR ou PORCENTAGEM, e os dois sao a mesma coisa vista de
 * dois jeitos. Combinado "trinta por cento na entrada", ninguem quer fazer a
 * conta de cabeca; combinado "dois mil na entrada", ninguem quer descobrir que
 * isso da 20%.
 *
 * ⚠️ Parcela paga aparece e nao se edita. Ela conta para o total — sem mostra-la,
 * a soma da tabela nunca bateria com a conta e a tela pareceria errada.
 */

/**
 * O corpo da conferencia: menor que a linha, e do mesmo peso nas duas colunas.
 *
 * ⚠️ SEM `padding` aqui. O recuo das celulas mora no CSS, e estilo em linha vence
 * seletor: cravando um valor proprio, a soma saia alguns pixels fora da coluna
 * que ela soma — que e justamente a unica coisa que ela precisa fazer certo.
 */

/** Quanto esta parcela representa da conta. So leitura: o valor e quem manda. */
/**
 * Um mes depois, sem estourar o fim do mes.
 *
 * ⚠️ Somar 30 dias faria uma parcela de janeiro cair em 31/01 e a seguinte em
 * 02/03. Somando MES, o dia combinado se mantem, e dia 31 em mes de 30 recua para
 * o ultimo dia — que e o que qualquer boleto faz.
 */

/**
 * A marca de conciliado de uma parcela.
 *
 * ⚠️ Três estados, e não dois. "Ainda não recebida" não é o mesmo que "recebida e
 * não conferida": a primeira não tem o que conciliar, e um X vermelho nela
 * acusaria uma pendência que não existe. Sem baixa, a célula fica vazia.
 *
 * ⚠️ Verde para conferido, âmbar para "recebi mas não bateu". O âmbar é o único
 * estado que pede ação de alguém, e é o que quem fecha o mês vai procurar.
 */
function MarcaDeConciliado({ parcela }: { parcela: Parcela }) {
  /*
   * ⚠️ A MESMA marca do lado que paga (`MarcaDeConciliacao` do kit), e não um
   * desenho próprio.
   *
   * Aqui havia um par inteiro só desta tela: check em `--credito` e um círculo
   * de atenção em `--warning-text`. Era o mesmo fato — "isto já bateu com o
   * extrato" — pintado de duas cores diferentes em duas telas do mesmo sistema,
   * e quem trabalha nos dois lados aprendia duas vezes.
   *
   * ⚠️ O traço continua sendo só de quem NÃO recebeu: ali não há conferência
   * pendente, porque não há dinheiro a conferir.
   */
  if (parcela.cancelada)
    return <MarcaDeConciliacao conciliado={false} cancelada />;

  if (!parcela.pago) {
    return <span style={{ color: "var(--text-disabled)" }}>—</span>;
  }

  return <MarcaDeConciliacao conciliado={parcela.conciliado} />;
}

/**
 * O corpo do drawer enquanto a conta não chegou.
 *
 * ⚠️ Barras cinzas do tamanho do que vem depois, e não um "Carregando…". A conta
 * abre em cima da lista, e um texto solto no meio do vazio faz a tela parecer
 * quebrada por um instante; as barras já desenham o formato que vai aparecer.
 */
function Esqueleto() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[70, 90, 55, 100, 80].map((largura, i) => (
        <div
          key={i}
          className="sk"
          style={{
            height: 14,
            width: `${largura}%`,
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-3)",
          }}
        />
      ))}
    </div>
  );
}

function AcoesDaParcela({
  aoBaixar,
  aoEditarParcelamento,
  fatura,
  emitidoPor,
  parcela,
  proxima,
  bloqueado,
  aoMudar,
  fechar,
  aoCancelar,
  aoReativar,
}: {
  aoBaixar: () => void;
  aoEditarParcelamento: () => void;
  fatura: Fatura;
  emitidoPor: string;
  parcela: Fatura["parcelas"][number];
  /** A parcela da vez. Nula quando a conta nao tem mais nada em aberto. */
  proxima: Fatura["parcelas"][number] | null;
  bloqueado: boolean;
  aoMudar: () => void;
  /** Abre o formulario de vencimento, que vive fora deste menu. */
  fechar: () => void;
  aoCancelar: () => void;
  aoReativar: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const faturaId = fatura.id;
  const temDocumento = Boolean(parcela.nfs || parcela.boleto);

  /*
   * O recibo nasce SO de parcela baixada.
   *
   * Recibo comprova; um "recibo" de algo em aberto seria um documento
   * afirmando o que nao aconteceu.
   */
  async function recibo() {
    const { imprimirReciboDePagamento } =
      await import("./pdf-recibo-pagamento");

    await imprimirReciboDePagamento(
      {
        numeroConta: fatura.numero,
        parcela: parcela.numero,
        totalParcelas: fatura.parcelas.length,
        valor: parcela.total,
        vencimento: parcela.vencimento,
        pagoEm: parcela.pagoEm,
        clienteNome: fatura.clienteNome,
        clienteDoc: fatura.clienteDoc,
        tickets: fatura.tickets.map((t) => ({
          numero: t.numero,
          titulo: t.titulo,
          valor: t.valor,
          data: t.encerradoEm,
        })),
        // As que sobram depois desta. Quem assina quer saber o que falta.
        emAberto: fatura.parcelas
          .filter((x) => !x.pago && x.id !== parcela.id)
          .map((x) => ({
            numero: x.numero,
            vencimento: x.vencimento,
            total: x.total,
          })),
        totalConta: fatura.total,
        pagoConta: fatura.parcelas
          .filter((x) => x.pago)
          .reduce((soma, x) => soma + x.total, 0),
        descontoConta: fatura.parcelas.reduce(
          (soma, x) => soma + x.desconto,
          0,
        ),
        emitente: fatura.emitente,
      },
      emitidoPor,
    );
  }

  async function enviar() {
    const r = await fetch(
      `/api/v1/faturas/${faturaId}/parcelas/${parcela.id}/enviar`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar");
      return;
    }
    avisar("sucesso", "E-mail enviado", `Para ${dados.data.para}.`);
  }

  async function enviarWhatsapp() {
    const r = await fetch(
      `/api/v1/faturas/${faturaId}/parcelas/${parcela.id}/whatsapp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar");
      return;
    }
    avisar("sucesso", "WhatsApp enviado", `Para ${dados.data.para}.`);
  }

  return (
    <>
      {!bloqueado && !parcela.nfs && (
        <AnexarDocumento
          tipo="nfs"
          rotulo="Anexar nota fiscal"
          faturaId={faturaId}
          parcelaId={parcela.id}
          aoMudar={() => {
            fechar();
            aoMudar();
          }}
        >
          <path d="M9 1.8H4.2a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V5.8z" />
          <path d="M9 1.8v4h4" />
          <path d="M5.8 9.2h4.4M5.8 11.4h3" />
        </AnexarDocumento>
      )}

      {!bloqueado && !parcela.boleto && (
        <AnexarDocumento
          tipo="boleto"
          rotulo="Anexar boleto"
          faturaId={faturaId}
          parcelaId={parcela.id}
          aoMudar={() => {
            fechar();
            aoMudar();
          }}
        >
          <path d="M2.4 2.6v10.8M5 2.6v10.8M7.4 2.6v10.8M10.4 2.6v10.8M13.6 2.6v10.8" />
        </AnexarDocumento>
      )}

      {/* So depois da baixa: comprovante e a prova de que o dinheiro entrou, e
          anexar um antes de existir recebimento cria uma parcela em aberto com
          prova de pagamento — a contradicao que o conferente do extrato leva
          meia hora para desfazer. */}
      {parcela.pago &&
        !parcela.comprovante &&
        fatura.situacao !== "CANCELADA" && (
          <AnexarDocumento
            tipo="comprovante"
            rotulo="Anexar comprovante"
            faturaId={faturaId}
            parcelaId={parcela.id}
            aoMudar={() => {
              fechar();
              aoMudar();
            }}
          >
            {/* Cedula com o visto: o papel recortado ja e o recibo, e a folha com
              dobra ja e a nota. Comprovante e dinheiro que ENTROU. */}
            <rect x="1.6" y="4" width="12.8" height="8" rx="1" />
            <circle cx="8" cy="8" r="1.8" />
            <path d="M11.4 12.6l1.6 1.6 2.6-2.8" />
          </AnexarDocumento>
        )}

      {/* Dar baixa mora aqui, e nao no rodape: quem recebe olha a LINHA da
          parcela que venceu, e o botao no rodape obrigava a achar de novo, na
          tela seguinte, qual delas era.

          Aparece em todas as parcelas abertas, mas so a da vez responde. O item
          desabilitado com motivo ensina a regra; escondido, a acao simplesmente
          sumiria de uma linha e estaria em outra, sem dizer por que. */}
      {!parcela.pago && fatura.situacao !== "CANCELADA" && (
        <ItemDoMenu
          rotulo="Receber"
          desabilitado={proxima?.id !== parcela.id}
          motivo={
            proxima && proxima.id !== parcela.id
              ? `A parcela ${proxima.numero} vence antes e ainda está em aberto`
              : undefined
          }
          onClick={() => {
            fechar();
            aoBaixar();
          }}
        >
          <path d="M8 2.4v8.2M4.8 7.4L8 10.6l3.2-3.2" />
          <path d="M2.6 13.4h10.8" />
        </ItemDoMenu>
      )}

      {/*
        ⚠️ Editar abre o CRONOGRAMA inteiro, e nao um formulario daquela parcela.
        Mudar vencimento, dividir o saldo e acrescentar parcela sao o mesmo
        gesto, e cada um mexe no valor das outras — o total esta fixo. Uma tela
        por parcela nao teria como manter a soma fechando.

        Ele existia so no `+` do titulo do grupo, e passava despercebido: quem
        quer mexer numa parcela abre o menu DELA. Agora esta nos dois lugares, e
        os dois levam a mesma tela.
      */}
      {/*
        ⚠️ Cancelar mora no menu DA LINHA, e não num "encerrar a partir de tal
        data": aquele decidiria por várias parcelas a partir de um corte que a
        tela não mostra antes de gravar. Mesma decisão do lado que paga.
      */}
      <ItemDoMenu
        rotulo={parcela.cancelada ? "Reativar parcela" : "Cancelar parcela"}
        desabilitado={parcela.pago || fatura.situacao === "CANCELADA"}
        motivo={
          parcela.pago
            ? "Parcela recebida não se cancela: estorne o recebimento antes"
            : fatura.situacao === "CANCELADA"
              ? "Esta conta está cancelada"
              : undefined
        }
        onClick={() => {
          fechar();
          if (parcela.cancelada) aoReativar();
          else aoCancelar();
        }}
      >
        {parcela.cancelada ? (
          <>
            {/* Seta que volta: o que foi cancelado torna a valer. */}
            <path d="M3 8a5 5 0 1 1 1.6 3.7" />
            <path d="M3 4.6V8h3.4" />
          </>
        ) : (
          <>
            {/* Círculo com um corte: existe, e deixou de valer. */}
            <circle cx="8" cy="8" r="6" />
            <path d="M4.4 11.6L11.6 4.4" />
          </>
        )}
      </ItemDoMenu>

      {fatura.situacao !== "CANCELADA" && (
        <ItemDoMenu
          rotulo="Editar parcelamento"
          onClick={() => {
            fechar();
            aoEditarParcelamento();
          }}
        >
          <rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.4" />
          <path d="M2.4 6.4h11.2M5.4 2.2v2.4M10.6 2.2v2.4" />
        </ItemDoMenu>
      )}

      <ItemDoMenu
        rotulo="Recibo de pagamento"
        desabilitado={!parcela.pago}
        motivo={!parcela.pago ? "Só depois da baixa" : undefined}
        onClick={() => {
          fechar();
          void recibo();
        }}
      >
        <path d="M3.4 1.8h9.2v12.4l-2.3-1.4-2.3 1.4-2.3-1.4-2.3 1.4z" />
        <path d="M5.8 5.4h4.4M5.8 8h3" />
      </ItemDoMenu>

      <ItemDoMenu
        rotulo="Enviar por e-mail"
        desabilitado={bloqueado || !temDocumento}
        motivo={
          bloqueado
            ? "Parcela conciliada ou conta cancelada"
            : !temDocumento
              ? "Anexe a nota fiscal ou o boleto antes de enviar"
              : undefined
        }
        onClick={() => {
          fechar();
          confirmar(
            "Enviar esta parcela ao cliente?",
            "Enviar",
            enviar,
            "O e-mail leva o link da cobrança.",
          );
        }}
      >
        <path d="M8.6 12.6H2.4a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1h11.2a1 1 0 0 1 1 1v3.2" />
        <path d="M1.6 4.6L8 8.8l6.4-4.2" />
        <path d="M10.4 12.2h4.2M12.8 10.4l1.8 1.8-1.8 1.8" />
      </ItemDoMenu>

      {/* Sem exigir nota nem boleto, ao contrário do e-mail: o que vai aqui é o
          LINK da cobrança, e a página pública se vira com o que houver. O
          e-mail exige documento porque é ele quem anuncia documento. */}
      <ItemDoMenu
        rotulo="Enviar por WhatsApp"
        desabilitado={bloqueado}
        motivo={bloqueado ? "Parcela conciliada ou conta cancelada" : undefined}
        onClick={() => {
          fechar();
          confirmar(
            "Enviar esta cobrança pelo WhatsApp?",
            "Enviar",
            enviarWhatsapp,
            "Vai o modelo aprovado, com valor, vencimento e o link da cobrança.",
          );
        }}
      >
        <path d="M2.6 13.4l.8-2.8a5.4 5.4 0 1 1 2 2z" />
        <path d="M6 6.4c.3 1.6 1.7 3 3.3 3.3" />
      </ItemDoMenu>
    </>
  );
}

/**
 * A situacao da parcela, em cor.
 *
 * O rotulo gastava uma coluna inteira para dizer o que a cor diz de relance, e
 * "ABERTA" repetido quinze vezes nao informa nada.
 */
function Bolinha({
  parcela,
}: {
  parcela: {
    pago: boolean;
    cancelada?: boolean;
    vencimento: string | null;
    pagamentoId: number | null;
  };
}) {
  /*
   * Conciliada e diferente de paga: paga e "o cliente pagou", conciliada e
   * "bateu com o extrato" — `fkPagamento` preenchido. So a conciliada trava a
   * edicao, porque ela ja entrou na contabilidade.
   */
  const estado = parcela.pagamentoId
    ? "Conciliada"
    : parcela.pago
      ? "Paga"
      : parcela.cancelada
        ? "Cancelada"
        : vencida(parcela)
          ? "Vencida"
          : "Em aberto";

  return (
    <span
      aria-label={estado}
      title={estado}
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-block",
        background: parcela.pagamentoId
          ? "var(--primary)"
          : parcela.pago
            ? "var(--success)"
            : vencida(parcela)
              ? "var(--danger)"
              : "var(--text-disabled)",
        // Conciliada ganha anel: a cor sozinha ja distingue de "paga", mas o
        // anel diz que aquela linha esta FECHADA, e nao so quitada.
        boxShadow: parcela.pagamentoId
          ? "0 0 0 2px var(--primary-subtle)"
          : undefined,
      }}
    />
  );
}
