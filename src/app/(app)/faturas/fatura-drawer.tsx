"use client";

import { useCallback, useEffect, useState } from "react";
import { BotaoDeCabecalho, BotaoHistorico, Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import { BaixaDrawer } from "./baixa-drawer";
import { Icon } from "@/components/layout/icones";
import {
  CampoBloqueado,
  Field,
  PanelTabs,
} from "@/components/ui/kit";
import { TicketDrawer } from "../tickets/ticket-drawer";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";

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


type Parcela = {
  id: number;
  numero: number;
  vencimento: string | null;
  valor: number;
  acrescimo: number;
  desconto: number;
  total: number;
  pago: boolean;
  /** Preenchido quando a baixa foi conciliada. E o que trava a edicao. */
  pagamentoId: number | null;
  /** Data da baixa. E o fato que o recibo comprova — nao e o vencimento. */
  pagoEm: string | null;
  /** Quanto ja entrou nesta parcela, de um pagamento ou de varios. */
  recebido: number;
  nfs: string | null;
  boleto: string | null;
  comprovante: string | null;
};

type TicketDaFatura = {
  ticketId: number;
  numero: number;
  valor: number;
  titulo: string;
  status: string;
  clienteNome: string | null;
  encerradoEm: string | null;
};

type Fatura = {
  id: number;
  numero: number;
  clienteNome: string | null;
  apuracaoInicio: string | null;
  apuracaoFim: string | null;
  situacao: string;
  total: number;
  observacoes: string | null;
  rodape: string | null;
  parcelas: Parcela[];
  tickets: TicketDaFatura[];
  clienteDoc: string | null;
  emitente: {
    razaoSocial: string | null;
    endereco: string | null;
    cnpj: string | null;
    logo: string | null;
  };
  historico: {
    criadoEm: string | null;
    criadoPor: string | null;
    editadoEm: string | null;
    editadoPor: string | null;
  };
};

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
  const [baixando, setBaixando] = useState(false);
  const { avisar, confirmar } = useAvisos();

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

  // O recebido vem das parcelas baixadas, nao de um campo do cabecalho: e a
  // parcela que carrega a verdade sobre o pagamento.
  const pago = fatura ? fatura.parcelas.filter((p) => p.pago).reduce((s, p) => s + p.total, 0) : 0;
  const temBaixa = fatura?.parcelas.some((p) => p.pago) ?? false;

  return (
    <Drawer
      open
      onClose={onClose}
      title={fatura ? `Conta a receber ${fatura.numero}` : "Conta a receber"}
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
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Os totais vivem no rodape, na linha do botao: e o ultimo lugar em
              que a pessoa olha antes de agir, e no topo eles empurravam para
              baixo os campos que se le primeiro. */}
          {fatura && <Totais total={fatura.total} pago={pago} />}

          <span style={{ flex: 1 }} />
        </div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 18 }}>
            <Field label="Cliente">
              <CampoBloqueado valor={fatura.clienteNome ?? "—"} />
            </Field>

            <Field label="Apuração">
              <CampoBloqueado valor={periodo(fatura.apuracaoInicio, fatura.apuracaoFim)} />
            </Field>

            <Field label="Situação">
              <CampoBloqueado valor={fatura.situacao} />
            </Field>

            {fatura.observacoes && (
              <Field label="Observações">
                <CampoBloqueado valor={fatura.observacoes} multilinha />
              </Field>
            )}
          </div>

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
            <Tabela
              cabecalho={["Ticket", "Encerrado", "Valor", "Ações"]}
              vazio="Nenhum ticket vinculado a esta conta."
              linhas={fatura.tickets.map((t) => [
                <span key="t" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t.numero}
                </span>,
                t.encerradoEm ? paraFormatoBR(t.encerradoEm as DataISO) : "—",
                formatarSemSimbolo(t.valor as Centavos),
                <MenuDeLinha key="a">
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
                </MenuDeLinha>,
              ])}
            />
          ) : aba === "produtos" ? (
            /*
             * Ainda sem implementacao — a aba existe para nao esquecer.
             *
             * Produto mexe no dinheiro: hoje o total da conta e exatamente a
             * soma do que se tirou dos tickets, e e isso que faz o faturamento
             * parcial fechar. Com produto, o total passa a ser tickets +
             * produtos, e a conferencia de origem precisa de outra regra.
             */
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                border: "1px dashed var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                color: "var(--text-tertiary)",
                fontSize: "var(--text-base)",
                lineHeight: 1.6,
              }}
            >
              Produtos da conta entram aqui.
              <br />
              <span style={{ fontSize: "var(--text-sm)" }}>
                Ainda não implementado: mexe no total, e o total hoje vem dos tickets.
              </span>
            </div>
          ) : (
            <Tabela
              cabecalho={["#", "Vencimento", "Valor", "Documentos", "Ações"]}
              vazio="Nenhuma parcela gerada."
              realce={(li) => vencida(fatura.parcelas[li])}
              linhas={fatura.parcelas.map((p) => [
                <span key="n" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Bolinha parcela={p} />
                  {p.numero}
                </span>,
                p.vencimento ? curto(p.vencimento) : "—",
                <span key="v" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {formatarSemSimbolo(p.total as Centavos)}
                  {/* Desconto dado na baixa: sem mostrar aqui, a soma das
                      parcelas nao fecha com o total e parece erro de conta. */}
                  {p.desconto > 0 && (
                    <span
                      title={`Desconto de ${formatarSemSimbolo(p.desconto as Centavos)}`}
                      style={{ fontSize: "var(--text-xs)", color: "var(--credito)" }}
                    >
                      −{formatarSemSimbolo(p.desconto as Centavos)}
                    </span>
                  )}
                </span>,
                <Documentos
                  key="d"
                  faturaId={fatura.id}
                  parcelaId={p.id}
                  boleto={p.boleto}
                  nfs={p.nfs}
                  comprovante={p.comprovante}
                  bloqueado={p.pagamentoId != null || fatura.situacao === "CANCELADA"}
                  aoMudar={recarregar}
                />,
                <MenuDeLinha key="a">
                  {(fechar) => (
                    <AcoesDaParcela
                      aoBaixar={() => setBaixando(true)}
                      fatura={fatura}
                      emitidoPor={emitidoPor}
                      parcela={p}
                      bloqueado={p.pagamentoId != null || fatura.situacao === "CANCELADA"}
                      aoMudar={recarregar}
                      fechar={fechar}
                    />
                  )}
                </MenuDeLinha>,
              ])}
            />
          )}
        </>
      )}

      {baixando && fatura && (
        <BaixaDrawer
          faturaId={fatura.id}
          numero={fatura.numero}
          parcelas={fatura.parcelas}
          aoBaixar={(nova) => setFatura(nova as Fatura)}
          onClose={() => setBaixando(false)}
        />
      )}

      <TicketDrawer ticketId={ticketAberto} somenteLeitura onClose={() => setTicketAberto(null)} />
    </Drawer>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

function periodo(de: string | null, ate: string | null): string {
  if (!de) return "—";
  const fim = ate ?? de;
  return fim !== de
    ? `${paraFormatoBR(de as DataISO)} a ${paraFormatoBR(fim as DataISO)}`
    : paraFormatoBR(de as DataISO);
}



/**
 * As bandeiras dos documentos ja anexados.
 *
 * Cada uma e um par: o rotulo baixa, o ✕ ao lado remove. Dois alvos dentro da
 * mesma moldura, e nao dois controles soltos — assim o ✕ pertence visivelmente
 * AQUELE documento, e nao a linha inteira.
 *
 * Anexar mora na coluna de acoes: e um gesto de escrita, e misturado as
 * bandeiras fazia a coluna significar "o que existe" e "o que da para fazer" ao
 * mesmo tempo.
 */
function Documentos({
  faturaId,
  parcelaId,
  boleto,
  nfs,
  comprovante,
  bloqueado,
  aoMudar,
}: {
  faturaId: number;
  parcelaId: number;
  boleto: string | null;
  nfs: string | null;
  comprovante: string | null;
  /** Parcela baixada ou conta cancelada: da para baixar, nao para remover. */
  bloqueado: boolean;
  aoMudar: () => void;
}) {
  if (!nfs && !boleto && !comprovante) return <span style={{ color: "var(--text-disabled)" }}>—</span>;

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {nfs && (
        <Bandeira
          rotulo="NF"
          tipo="nfs"
          faturaId={faturaId}
          parcelaId={parcelaId}
          bloqueado={bloqueado}
          aoMudar={aoMudar}
        />
      )}
      {comprovante && (
        <Bandeira
          rotulo="Comprovante"
          tipo="comprovante"
          faturaId={faturaId}
          parcelaId={parcelaId}
          bloqueado={bloqueado}
          aoMudar={aoMudar}
        />
      )}
      {boleto && (
        <Bandeira
          rotulo="Boleto"
          tipo="boleto"
          faturaId={faturaId}
          parcelaId={parcelaId}
          bloqueado={bloqueado}
          aoMudar={aoMudar}
        />
      )}
    </span>
  );
}

function Bandeira({
  rotulo,
  tipo,
  faturaId,
  parcelaId,
  bloqueado,
  aoMudar,
}: {
  rotulo: string;
  tipo: "nfs" | "boleto" | "comprovante";
  faturaId: number;
  parcelaId: number;
  bloqueado: boolean;
  aoMudar: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const url = `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/documento?tipo=${tipo}`;

  async function remover() {
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível remover");
      return;
    }
    aoMudar();
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 19,
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--primary-border)",
        background: "var(--primary-subtle)",
        overflow: "hidden",
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        title={`Baixar ${rotulo}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0 6px",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--fw-medium)",
          color: "var(--primary)",
          textDecoration: "none",
        }}
      >
        {rotulo}
      </a>

      {/* Baixada, da para baixar mas nao para remover: nota e boleto sao o que
          se manda para RECEBER, e trocar depois muda o que o cliente tem em maos
          sobre uma cobranca encerrada. */}
      {!bloqueado && (
      <button
        type="button"
        title={`Remover ${rotulo}`}
        aria-label={`Remover ${rotulo}`}
        onClick={() =>
          confirmar(`Remover ${rotulo} desta parcela?`, "Remover", remover, "O arquivo é apagado.")
        }
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 16,
          height: 19,
          border: "none",
          borderLeft: "1px solid var(--primary-border)",
          background: "transparent",
          padding: 0,
          color: "var(--primary)",
          cursor: "pointer",
          fontSize: 9,
        }}
      >
        ✕
      </button>
      )}
    </span>
  );
}

const MOLDURA_DE_ACAO: React.CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 24,
  height: 24,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  padding: 0,
  cursor: "pointer",
};

/**
 * Total no rodape, com o resto atras de um clique.
 *
 * Total e a pergunta de sempre; pago e saldo so importam quando ha pagamento
 * pela metade. Os tres sempre visiveis faziam a linha do botao competir com o
 * botao.
 */
function Totais({ total, pago }: { total: number; pago: number }) {
  const [aberto, setAberto] = useState(false);
  const saldo = total - pago;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font)",
        }}
      >
        <span className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
          Total
        </span>
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-semi)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-primary)",
          }}
        >
          {formatarSemSimbolo(total as Centavos)}
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: aberto ? "rotate(180deg)" : undefined,
            transition: "transform var(--dur) var(--ease)",
          }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {aberto && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            minWidth: 190,
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-md)",
            zIndex: 5,
          }}
        >
          <Linha rotulo="Recebido" valor={pago} cor="var(--credito)" />
          <Linha rotulo="Em aberto" valor={saldo} />
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "3px 0",
        fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{rotulo}</span>
      <span style={{ fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums", color: cor }}>
        {formatarSemSimbolo(valor as Centavos)}
      </span>
    </div>
  );
}

/**
 * Tabela do drawer. Tudo alinhado a ESQUERDA, inclusive numero.
 *
 * Alinhamento por coluna deixava cada tabela com um desenho: valor a direita
 * aqui, situacao ao centro ali, e o olho refazia o percurso a cada aba. Com uma
 * regra so, a leitura comeca sempre na mesma margem.
 */
function Tabela({
  cabecalho,
  linhas,
  vazio,
  realce,
  aoClicarLinha,
}: {
  cabecalho: string[];
  linhas: React.ReactNode[][];
  vazio: string;
  /** Pinta a linha inteira de vermelho. Hoje: parcela vencida. */
  realce?: (indice: number) => boolean;
  aoClicarLinha?: (indice: number) => void;
}) {
  return (
    /*
     * ⚠️ Sem `overflow: hidden`.
     *
     * Ele arredondava os cantos, mas RECORTAVA o cartao do menu de acoes: na
     * ultima linha o cartao abre para baixo, e sumia inteiro. A aba de tickets,
     * que costuma ter uma linha so, nunca mostrava o menu.
     *
     * Os cantos agora sao arredondados nas proprias celulas das pontas.
     */
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>
            {cabecalho.map((c, ci) => (
              <th
                key={c}
                className="rotulo"
                style={{
                  height: 32,
                  padding: "0 12px",
                  // `th` centraliza por padrao no navegador e `td` nao: sem esta
                  // linha o cabecalho fica deslocado da coluna que ele nomeia.
                  textAlign: "left",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  borderTopLeftRadius: ci === 0 ? "var(--radius-lg)" : undefined,
                  borderTopRightRadius: ci === cabecalho.length - 1 ? "var(--radius-lg)" : undefined,
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td
                colSpan={cabecalho.length}
                style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-tertiary)" }}
              >
                {vazio}
              </td>
            </tr>
          )}
          {linhas.map((celulas, li) => (
            <tr
              key={li}
              onClick={aoClicarLinha ? () => aoClicarLinha(li) : undefined}
              style={{
                borderTop: li === 0 ? undefined : "1px solid var(--border)",
                cursor: aoClicarLinha ? "pointer" : undefined,
                // Vencida pinta a linha toda: a data sozinha em vermelho se
                // perde na tabela, e atraso e o unico estado que pede acao ja.
                background: realce?.(li) ? "var(--danger-bg)" : undefined,
                color: realce?.(li) ? "var(--danger-text)" : undefined,
              }}
              onMouseEnter={(e) => {
                if (aoClicarLinha && !realce?.(li)) {
                  e.currentTarget.style.background = "var(--surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (aoClicarLinha && !realce?.(li)) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {celulas.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    fontVariantNumeric: "tabular-nums",
                    borderBottomLeftRadius:
                      li === linhas.length - 1 && ci === 0 ? "var(--radius-lg)" : undefined,
                    borderBottomRightRadius:
                      li === linhas.length - 1 && ci === celulas.length - 1
                        ? "var(--radius-lg)"
                        : undefined,
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

/**
 * Anexar um documento, como item do menu.
 *
 * E um `<label>` e nao um `<button>`: o `<input type="file">` precisa de um
 * rotulo para ser acionado, e assim o clique no item inteiro abre o seletor.
 */
function AnexarDocumento({
  tipo,
  rotulo,
  faturaId,
  parcelaId,
  aoMudar,
  children,
}: {
  tipo: "nfs" | "boleto" | "comprovante";
  rotulo: string;
  faturaId: number;
  parcelaId: number;
  aoMudar: () => void;
  children: React.ReactNode;
}) {
  const { avisar } = useAvisos();
  const [enviando, setEnviando] = useState(false);
  const [hover, setHover] = useState(false);

  async function subir(arquivo: File) {
    const corpo = new FormData();
    corpo.append("arquivo", arquivo);

    setEnviando(true);
    const r = await fetch(
      `/api/v1/faturas/${faturaId}/parcelas/${parcelaId}/documento?tipo=${tipo}`,
      { method: "POST", body: corpo },
    );
    const dados = await r.json().catch(() => null);
    setEnviando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível enviar o arquivo");
      return;
    }
    aoMudar();
  }

  return (
    <label
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: "var(--radius-sm)",
        background: hover ? "var(--surface-2)" : "transparent",
        color: "var(--text-primary)",
        fontSize: "var(--text-sm)",
        whiteSpace: "nowrap",
        cursor: enviando ? "wait" : "pointer",
        opacity: enviando ? 0.5 : 1,
      }}
    >
      <span style={{ display: "inline-grid", placeItems: "center", width: 16, flexShrink: 0 }}>
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
          {children}
        </svg>
      </span>
      {enviando ? "Enviando…" : rotulo}
      <input
        type="file"
        accept="application/pdf,image/*"
        disabled={enviando}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          // Zerado para que escolher o MESMO arquivo de novo, depois de um erro,
          // ainda dispare o `change`.
          e.target.value = "";
          if (arquivo) void subir(arquivo);
        }}
        style={{ display: "none" }}
      />
    </label>
  );
}

/**
 * Menu de acoes da linha: "⋯" que abre um cartao flutuante.
 *
 * Tres icones soltos na celula viravam tres alvos de 24px numa linha de 34, e
 * cada acao nova estreitava as colunas de dado. Com o menu, a coluna tem a
 * largura de um botao e cabe quantas acoes precisarem.
 *
 * O filho recebe `fechar` porque toda acao daqui termina o menu: deixar aberto
 * depois do clique faz parecer que nao aconteceu nada.
 */
function MenuDeLinha({ children }: { children: (fechar: () => void) => React.ReactNode }) {
  const [aberto, setAberto] = useState(false);

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title="Ações"
        aria-label="Ações"
        aria-expanded={aberto}
        onClick={(e) => {
          // A linha pode ter clique proprio; a acao nao dispara os dois.
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        style={{ ...MOLDURA_DE_ACAO, color: "var(--text-secondary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>

      {aberto && (
        <>
          {/* Camada invisivel que fecha ao clicar fora — sem ela o cartao so
              sairia clicando de novo no proprio botao. */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              setAberto(false);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
          <span
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 41,
              padding: 4,
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              boxShadow: "var(--shadow-md)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {children(() => setAberto(false))}
          </span>
        </>
      )}
    </span>
  );
}

/** Uma linha do menu. `icone` vem pronto; sem ele, `children` sao os tracos. */
function ItemDoMenu({
  rotulo,
  perigo,
  desabilitado,
  motivo,
  icone,
  onClick,
  children,
}: {
  rotulo: string;
  perigo?: boolean;
  desabilitado?: boolean;
  motivo?: string;
  icone?: React.ReactNode;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      disabled={desabilitado}
      title={motivo}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "7px 10px",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: hover && !desabilitado ? "var(--surface-2)" : "transparent",
        color: desabilitado
          ? "var(--text-disabled)"
          : perigo
            ? "var(--danger)"
            : "var(--text-primary)",
        fontSize: "var(--text-sm)",
        fontFamily: "var(--font)",
        textAlign: "left",
        whiteSpace: "nowrap",
        cursor: desabilitado ? "not-allowed" : "pointer",
      }}
    >
      <span style={{ display: "inline-grid", placeItems: "center", width: 16, flexShrink: 0 }}>
        {icone ?? (
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
            {children}
          </svg>
        )}
      </span>
      {rotulo}
    </button>
  );
}

/**
 * O que da para fazer com uma parcela.
 *
 * Anexar so aparece enquanto NAO ha o documento; depois de baixada, nem isso.
 */
function AcoesDaParcela({
  aoBaixar,
  fatura,
  emitidoPor,
  parcela,
  bloqueado,
  aoMudar,
  fechar,
}: {
  aoBaixar: () => void;
  fatura: Fatura;
  emitidoPor: string;
  parcela: Fatura["parcelas"][number];
  bloqueado: boolean;
  aoMudar: () => void;
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

      {/* Envelope com seta saindo: o aviaozinho de papel diz "mensagem", mas nao
          diz que vai por e-mail, e aqui o meio importa porque o que sai leva a
          cobranca. */}
      {!parcela.comprovante && fatura.situacao !== "CANCELADA" && (
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
          tela seguinte, qual delas era. */}
      {!parcela.pago && fatura.situacao !== "CANCELADA" && (
        <ItemDoMenu
          rotulo="Dar baixa"
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

      {/* ⚠️ Depende do token da Meta, que ainda precisa ser rotacionado: o do
          legado esta em texto puro num zip de backup. Ver docs/02. */}
      <ItemDoMenu
        rotulo="Enviar por WhatsApp"
        desabilitado
        motivo="Depende do token da Meta, ainda não configurado"
        onClick={fechar}
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

function vencida(parcela: { pago: boolean; vencimento: string | null }): boolean {
  return !parcela.pago && parcela.vencimento != null && parcela.vencimento < hoje();
}

/** dd/mm/aa. O seculo nao muda nada aqui, e a coluna encolhe um terco. */
function curto(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
