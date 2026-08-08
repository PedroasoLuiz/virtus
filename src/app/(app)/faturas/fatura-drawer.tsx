"use client";

import { useCallback, useEffect, useState } from "react";
import { BotaoDeCabecalho, BotaoHistorico, Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import { NovoRecebimentoDrawer } from "../recebimentos/novo-recebimento-drawer";
import { Icon } from "@/components/layout/icones";
import {
  AcoesDaLinha,
  Button,
  CampoBloqueado,
  EmptyRow,
  Field,
  GrupoDeCampos,
  inputStyle,
  PanelTabs,
  TableArea,
  TableHead,
  Td,
  tdNum,
  Th,
  Tr,
} from "@/components/ui/kit";
import { TicketDrawer } from "../tickets/ticket-drawer";
import { proximaAReceber, saldoAReceber, totalRecebido } from "@/shared/domain/parcelas";
import { ehPessoaFisica } from "@/shared/domain/cadastro-pessoa";
import { formatarDocumento } from "@/shared/domain/documento";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Fatura, Parcela } from "./fatura-tipos";
import { curto, periodo, vencida } from "./fatura-datas";
import { AnexarDocumento, Documentos } from "./fatura-documentos";
import { ItemDoMenu, MenuDeLinha } from "./fatura-menu";

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
}: {
  faturaId: number | null;
  /** Quem assina o rodape dos documentos. Vazio quando a tela nao sabe. */
  emitidoPor?: string;
  onClose: () => void;
}) {
  // `key` remonta a cada fatura: o estado nasce vazio sozinho, sem limpar a mao
  // dentro de um efeito, e sem mostrar o registro anterior enquanto carrega.
  return faturaId == null ? null : (
    <Conteudo key={faturaId} faturaId={faturaId} emitidoPor={emitidoPor ?? ""} onClose={onClose} />
  );
}

function Conteudo({
  faturaId,
  emitidoPor,
  onClose,
}: {
  faturaId: number;
  emitidoPor: string;
  onClose: () => void;
}) {
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"tickets" | "produtos" | "parcelas">("tickets");
  // Ticket aberto por cima da conta: o drawer empilha, o de tras nao fecha.
  const [ticketAberto, setTicketAberto] = useState<number | null>(null);
  // Guarda QUAL parcela, e nao um booleano: a baixa acontece sobre uma parcela
  // escolhida na linha, e o drawer que abre mostra so ela.
  const [baixando, setBaixando] = useState<number | null>(null);
  /*
   * A parcela cujo vencimento esta sendo mudado. Mora aqui e nao no menu de
   * acoes porque o menu se fecha no clique: o formulario precisa sobreviver a
   * ele.
   */
  const [prorrogando, setProrrogando] = useState<Fatura["parcelas"][number] | null>(null);
  const { avisar, confirmar } = useAvisos();

  async function cancelarConta() {
    const r = await fetch(`/api/v1/faturas/${faturaId}/cancelamento`, { method: "PUT" });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível cancelar a cobrança");
      return;
    }

    avisar("sucesso", "Cobrança cancelada", "A conta não é mais cobrável.");
    setFatura(dados.data);
  }

  async function excluirConta() {
    const r = await fetch(`/api/v1/faturas/${faturaId}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível excluir a conta");
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
      avisar("atencao", dados?.error?.message ?? "Não foi possível remover o ticket");
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
  const recarregar = useCallback(() => {
    fetch(`/api/v1/faturas/${faturaId}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar a fatura");
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
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar a fatura");
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
  const pago = fatura ? totalRecebido(fatura.parcelas) : 0;
  const emAberto = fatura ? saldoAReceber(fatura.parcelas) : 0;
  const descontado = fatura ? fatura.parcelas.reduce((s, p) => s + p.desconto, 0) : 0;
  const temBaixa = fatura?.parcelas.some((p) => p.pago) ?? false;

  // A unica que pode receber agora. As de tras dela ficam com o "Dar baixa"
  // desabilitado, dizendo por que.
  const proxima = fatura ? proximaAReceber(fatura.parcelas) : null;
  const parcelaEmBaixa = fatura?.parcelas.find((p) => p.id === baixando) ?? null;

  return (
    <Drawer
      open
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
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger-text)",
            fontSize: "var(--text-base)",
          }}
        >
          {erro}
        </div>
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
                  valor={fatura.clienteDoc ? formatarDocumento(fatura.clienteDoc) : "—"}
                />
              </Field>

              <Field label="Apuração">
                <CampoBloqueado valor={periodo(fatura.apuracaoInicio, fatura.apuracaoFim)} />
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
              <CampoBloqueado valor={formatarSemSimbolo(fatura.total as Centavos)} />
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
                <CampoBloqueado valor={formatarSemSimbolo(descontado as Centavos)} />
              </Field>
            )}

            <Field label="Em aberto">
              <CampoBloqueado valor={formatarSemSimbolo(emAberto as Centavos)} />
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
              setAba(t.startsWith("Tickets") ? "tickets" : t === "Produtos" ? "produtos" : "parcelas")
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
              titulo="De onde vem o valor"
              legenda="O total desta conta é a soma do que foi tirado de cada ticket. O detalhe do serviço mora dentro dele: o menu da linha abre."
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
                  <EmptyRow colSpan={4} message="Nenhum ticket vinculado a esta conta." />
                )}

                {fatura.tickets.map((t) => (
                  <Tr key={t.ticketId}>
                    <Td style={{ fontVariantNumeric: "tabular-nums" }}>{t.numero}</Td>

                    <Td>
                      {t.encerradoEm ? (
                        paraFormatoBR(t.encerradoEm as DataISO)
                      ) : (
                        <span style={{ color: "var(--text-disabled)" }}>—</span>
                      )}
                    </Td>

                    <Td style={tdNum}>{formatarSemSimbolo(t.valor as Centavos)}</Td>

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
                        motivo={temBaixa ? "Conta com parcela baixada" : undefined}
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
              titulo="O que foi entregue junto"
              legenda="Peça, material ou licença cobrados ao lado do serviço. Ainda não entram na conta: eles mexem no total, e o total hoje é exatamente o que veio dos tickets."
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
              titulo="Quando o dinheiro entra"
              legenda="Cada parcela vence e é recebida por conta própria. A vencida aparece em vermelho, e o menu da linha é onde se dá baixa, prorroga o vencimento ou se emite o recibo."
            >
              <TableArea minWidth={0}>
              <TableHead>
                <Th minWidth={54}>#</Th>
                <Th minWidth={110}>Vencimento</Th>
                <Th align="right" minWidth={120}>
                  Valor
                </Th>
                <Th minWidth={90}>Documentos</Th>
                {/*
                  ⚠️ Conciliado é sobre o EXTRATO, não sobre a baixa.

                  Dar baixa é dizer "recebi"; conciliar é ter conferido que o
                  dinheiro apareceu na conta. Sem esta coluna, as duas viravam a
                  mesma coisa na leitura, e quem fecha o mês não tinha como ver o
                  que ainda falta bater.
                */}
                <Th align="center" minWidth={90}>
                  Conciliado
                </Th>
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
                    style={
                      vencida(p)
                        ? { background: "var(--danger-bg)", color: "var(--danger-text)" }
                        : undefined
                    }
                  >
                    <Td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <Bolinha parcela={p} />
                        {p.numero}
                      </span>
                    </Td>

                    <Td>
                      {p.vencimento ? (
                        curto(p.vencimento)
                      ) : (
                        <span style={{ color: "var(--text-disabled)" }}>—</span>
                      )}
                    </Td>

                    <Td style={tdNum}>
                      {formatarSemSimbolo(p.total as Centavos)}

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
                        bloqueado={p.pagamentoId != null || fatura.situacao === "CANCELADA"}
                        aoMudar={recarregar}
                      />
                    </Td>

                    <Td style={{ textAlign: "center" }}>
                      <MarcaDeConciliado parcela={p} />
                    </Td>

                    <Td>
                      <AcoesDaLinha>
                        <MenuDeLinha>
                          {(fechar) => (
                            <AcoesDaParcela
                              aoBaixar={() => setBaixando(p.id)}
                              fatura={fatura}
                              emitidoPor={emitidoPor}
                              parcela={p}
                              proxima={proxima}
                              bloqueado={
                                p.pagamentoId != null || fatura.situacao === "CANCELADA"
                              }
                              aoMudar={recarregar}
                              aoProrrogar={() => setProrrogando(p)}
                              fechar={fechar}
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
          clientes={[{ id: fatura.clienteId, nome: fatura.clienteNome ?? "Cliente" }]}
          clienteInicial={fatura.clienteId}
          parcelaInicial={parcelaEmBaixa.id}
          onClose={() => setBaixando(null)}
          aoCriar={() => {
            setBaixando(null);
            recarregar();
          }}
        />
      )}

      {prorrogando && (
        <NovoVencimento
          faturaId={fatura!.id}
          parcela={prorrogando}
          onClose={() => setProrrogando(null)}
          aoSalvar={() => {
            setProrrogando(null);
            recarregar();
          }}
        />
      )}

      <TicketDrawer ticketId={ticketAberto} somenteLeitura onClose={() => setTicketAberto(null)} />
    </Drawer>
  );
}

/**
 * Muda so a data de uma parcela.
 *
 * Drawer proprio e nao edicao na linha: a mudanca sai imediatamente para o
 * banco e mexe numa cobranca que pode ja estar com o cliente. Um campo que
 * salva ao perder o foco tornaria isso um acidente de clique.
 */
function NovoVencimento({
  faturaId,
  parcela,
  onClose,
  aoSalvar,
}: {
  faturaId: number;
  parcela: Fatura["parcelas"][number];
  onClose: () => void;
  aoSalvar: () => void;
}) {
  const { avisar } = useAvisos();
  const [data, setData] = useState(parcela.vencimento ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!data || salvando) return;

    setSalvando(true);

    const r = await fetch(`/api/v1/faturas/${faturaId}/parcelas/${parcela.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vencimento: data }),
    });

    setSalvando(false);
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", corpo?.error?.message ?? "Não foi possível alterar o vencimento");
      return;
    }

    avisar("sucesso", "Vencimento alterado.");
    aoSalvar();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Vencimento da parcela ${parcela.numero}`}
      subtitle={parcela.vencimento ? `Hoje vence em ${curto(parcela.vencimento)}` : undefined}
      width={420}
      acoes={
        <Button size="xs" variant="primary" onClick={() => void salvar()} disabled={!data || salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      <Field
        label="Novo vencimento"
        hint="Só a data muda. Valor, número da parcela e os documentos anexados ficam como estão."
      >
        <input
          type="date"
          style={inputStyle}
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </Field>
    </Drawer>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

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
  if (!parcela.pago) {
    return <span style={{ color: "var(--text-disabled)" }}>—</span>;
  }

  const ok = parcela.conciliado;

  return (
    <span
      title={
        ok
          ? "A baixa desta parcela já bateu com o extrato da conta."
          : "Recebida, mas ainda não conferida no extrato."
      }
      style={{
        display: "inline-grid",
        placeItems: "center",
        color: ok ? "var(--credito)" : "var(--warning-text)",
      }}
    >
      {ok ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 12.5l5.5 5.5L20 6.5" />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.6v5M12 15.9v.2" />
        </svg>
      )}
    </span>
  );
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
  fatura,
  emitidoPor,
  parcela,
  proxima,
  bloqueado,
  aoMudar,
  aoProrrogar,
  fechar,
}: {
  aoBaixar: () => void;
  fatura: Fatura;
  emitidoPor: string;
  parcela: Fatura["parcelas"][number];
  /** A parcela da vez. Nula quando a conta nao tem mais nada em aberto. */
  proxima: Fatura["parcelas"][number] | null;
  bloqueado: boolean;
  aoMudar: () => void;
  /** Abre o formulario de vencimento, que vive fora deste menu. */
  aoProrrogar: () => void;
  fechar: () => void;
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
    const { imprimirReciboDePagamento } = await import("./pdf-recibo-pagamento");

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
          .map((x) => ({ numero: x.numero, vencimento: x.vencimento, total: x.total })),
        totalConta: fatura.total,
        pagoConta: fatura.parcelas.filter((x) => x.pago).reduce((soma, x) => soma + x.total, 0),
        descontoConta: fatura.parcelas.reduce((soma, x) => soma + x.desconto, 0),
        emitente: fatura.emitente,
      },
      emitidoPor,
    );
  }

  async function enviar() {
    const r = await fetch(`/api/v1/faturas/${faturaId}/parcelas/${parcela.id}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar");
      return;
    }
    avisar("sucesso", "E-mail enviado", `Para ${dados.data.para}.`);
  }

  async function enviarWhatsapp() {
    const r = await fetch(`/api/v1/faturas/${faturaId}/parcelas/${parcela.id}/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
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
      {parcela.pago && !parcela.comprovante && fatura.situacao !== "CANCELADA" && (
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

      {/* Prorrogar e o ajuste mais comum depois que a conta ja saiu, e ate
          agora so dava para refazer o parcelamento inteiro, o que derrubava
          nota, boleto e o link ja enviado ao cliente. */}
      <ItemDoMenu
        rotulo="Alterar vencimento"
        desabilitado={bloqueado || parcela.pago}
        motivo={
          bloqueado
            ? "Parcela conciliada ou conta cancelada"
            : parcela.pago
              ? "Parcela já baixada"
              : undefined
        }
        onClick={() => {
          fechar();
          aoProrrogar();
        }}
      >
        <path d="M3.4 3.6h9.2a1 1 0 0 1 1 1v8.2a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1z" />
        <path d="M2.4 6.8h11.2M5.4 2.2v2.6M10.6 2.2v2.6" />
        <path d="M6 10.4h4M8 8.4v4" />
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
  parcela: { pago: boolean; vencimento: string | null; pagamentoId: number | null };
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
        boxShadow: parcela.pagamentoId ? "0 0 0 2px var(--primary-subtle)" : undefined,
      }}
    />
  );
}

