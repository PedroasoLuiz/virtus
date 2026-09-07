"use client";

import type { CobrancaCompartilhada, TicketPublico } from "@/modules/publico/publico.types";
import {
  formatarSemSimbolo,
  multiplicar,
  somar,
  ZERO,
  type Centavos,
} from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";
import {
  AZUL,
  Campo,
  CINZA,
  Detalhe,
  Nome,
  Resumo,
  RodapeDaFolha,
  Secao,
  Td,
  Th,
  TINTA,
  quantidade,
} from "./pecas";

/**
 * A folha do TICKET, como o cliente a vê.
 *
 * ⚠️ Ela não fala de cobrança. Responde "o que foi feito e quanto vale":
 * serviços, ajustes e total.
 *
 * Tinha um bloco de parcelas aqui, e ele era errado por modelo: uma conta reúne
 * VÁRIOS tickets (`faturasorigens` é N para 1), e as parcelas que este ticket
 * mostrava cobriam também os outros. Numa conta de dois tickets, o cliente
 * recebia duas folhas que discordavam sobre quanto ele devia. Quem responde
 * "quanto, quando e como se paga" é a folha da conta.
 *
 * Esta folha deixou de ser a página e virou destino de link: o número do ticket
 * na composição da conta abre esta aba.
 */
export function FolhaDoTicket({
  ticket,
  empresa,
  conta,
}: {
  ticket: TicketPublico;
  empresa: CobrancaCompartilhada["empresa"];
  /** Só para o rodapé — de que fatura esta folha veio. */
  conta: number;
}) {
  const apuracao = periodoEmMeses(ticket.inicio, ticket.fim);

  /*
   * Somas em CENTAVOS, pelos helpers de dinheiro.
   *
   * `somar` passa por `centavos()`, que recusa valor nao inteiro — e e essa
   * recusa que teria denunciado, na primeira execucao, o dia em que reais
   * entraram aqui achando que eram centavos.
   */
  const soma = (valores: Centavos[]) => valores.reduce<Centavos>((a, b) => somar(a, b), ZERO);

  const subtotal = soma(
    ticket.itens.map((i) =>
      somar(multiplicar(i.valor, i.quantidade), soma(i.despesas.map((d) => d.valor))),
    ),
  );
  const desconto = soma(ticket.itens.map((i) => i.desconto));
  const acrescimo = soma(ticket.itens.map((i) => i.acrescimo));
  const total = soma(ticket.itens.map((i) => i.total));

  return (
    <div className="folha">
      {/* Faixa da marca, sangrando de ponta a ponta. */}
      <div style={{ height: "2.8mm", background: AZUL }} />

      <div style={{ padding: "0 14mm", boxSizing: "border-box" }}>
        {/* ── Identificação ─────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            paddingTop: "8.7mm",
          }}
        >
          <div style={{ paddingRight: "8mm" }}>
            <div
              style={{
                fontSize: "20pt",
                fontWeight: 700,
                color: AZUL,
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              TICKET
            </div>

            <div style={{ marginTop: "5mm" }}>
              <Campo rotulo="Número" valor={String(ticket.numero)} />
              <Campo rotulo="Situação" valor={ticket.situacao || "—"} />
              {apuracao && <Campo rotulo="Apuração" valor={apuracao} />}
              {/*
                ⚠️ PROJETO, e não centro de custo — e aqui, não embaixo do
                endereço do cliente. Lá ele lia como parte do endereço, do mesmo
                tamanho do bairro e do CEP. Projeto não é onde o cliente fica: é
                a obra a que este ticket pertence, que identifica o documento.
              */}
              {ticket.projeto && <Campo rotulo="Projeto" valor={ticket.projeto} />}
            </div>
          </div>

          {empresa.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logo}
              alt=""
              style={{
                width: "29mm",
                height: "9mm",
                objectFit: "contain",
                objectPosition: "right top",
                flexShrink: 0,
              }}
            />
          )}
        </div>

        {/* ── DE / PARA ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", marginTop: "9mm" }}>
          <div style={{ width: "91mm", paddingRight: "6mm", boxSizing: "border-box" }}>
            <Secao>DE</Secao>
            <Nome>{empresa.razaoSocial ?? "—"}</Nome>
            {empresa.cnpj && <Detalhe>CNPJ {empresa.cnpj}</Detalhe>}
            {empresa.endereco && <Detalhe>{empresa.endereco}</Detalhe>}
          </div>

          <div style={{ width: "91mm", boxSizing: "border-box" }}>
            <Secao>PARA</Secao>
            <Nome>{ticket.cliente.nome ?? "—"}</Nome>
            {ticket.cliente.doc && <Detalhe>{ticket.cliente.doc}</Detalhe>}
            {ticket.cliente.endereco && <Detalhe>{ticket.cliente.endereco}</Detalhe>}
            {ticket.cliente.endereco2 && <Detalhe>{ticket.cliente.endereco2}</Detalhe>}
          </div>
        </div>

        {/* ── Serviços ──────────────────────────────────────────────────── */}
        <table style={{ marginTop: "14mm" }}>
          <thead>
            <tr>
              <Th>Serviço</Th>
              <Th direita larguraMm={20}>Data</Th>
              <Th direita larguraMm={16}>Qtd.</Th>
              <Th direita larguraMm={22}>Unitário</Th>
              {desconto > 0 && (
                <Th direita larguraMm={22}>
                  Desconto
                </Th>
              )}
              {acrescimo > 0 && (
                <Th direita larguraMm={22}>
                  Acréscimo
                </Th>
              )}
              <Th direita larguraMm={24}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {ticket.itens.map((i, n) => (
              <tr key={n}>
                <Td>
                  {/*
                    ⚠️ Sem serviço do cadastro, o TÍTULO é a descrição — como no
                    PDF. Saía "Serviço" em cima e o texto embaixo, e o item que
                    não usa item de cadastro (o valor fechado, escrito à mão)
                    aparecia com um rótulo genérico no lugar do próprio nome.
                  */}
                  <div>{i.servico ?? i.descricao ?? "Serviço"}</div>
                  {i.servico && i.descricao && (
                    <div style={{ color: CINZA }}>{i.descricao}</div>
                  )}
                  {i.despesas.map((d, k) => (
                    <div key={k} style={{ color: CINZA }}>
                      + {d.descricao || "Despesa"} {formatarSemSimbolo(d.valor)}
                    </div>
                  ))}
                </Td>
                <Td direita>{i.data ? paraFormatoBR(i.data as DataISO) : "—"}</Td>
                <Td direita>{quantidade(i.quantidade, i.unidade)}</Td>
                <Td direita>{formatarSemSimbolo(i.valor)}</Td>
                {desconto > 0 && (
                  <Td direita>{i.desconto ? formatarSemSimbolo(i.desconto) : "—"}</Td>
                )}
                {acrescimo > 0 && (
                  <Td direita>{i.acrescimo ? formatarSemSimbolo(i.acrescimo) : "—"}</Td>
                )}
                <Td direita>{formatarSemSimbolo(i.total)}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        <Resumo
          linhas={[
            { rotulo: "Subtotal", valor: subtotal },
            ...(desconto > 0 ? [{ rotulo: "Desconto", valor: desconto }] : []),
            ...(acrescimo > 0 ? [{ rotulo: "Acréscimo", valor: acrescimo }] : []),
            { rotulo: "Total", valor: total, forte: true },
          ]}
        />

        {ticket.descricao && (
          <div style={{ marginTop: "12mm" }}>
            <Secao>OBSERVAÇÕES</Secao>
            <div
              style={{
                marginTop: "1.5mm",
                fontSize: "8.5pt",
                color: TINTA,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {ticket.descricao}
            </div>
          </div>
        )}
      </div>

      <RodapeDaFolha esquerda={`Fatura ${conta}`} />
    </div>
  );
}
