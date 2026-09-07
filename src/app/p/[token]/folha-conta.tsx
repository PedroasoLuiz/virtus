"use client";

import type { CobrancaCompartilhada } from "@/modules/publico/publico.types";
import {
  formatarSemSimbolo,
  somar,
  subtrair,
  ZERO,
  type Centavos,
} from "@/shared/utils/money";
import { hoje, paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";
import { acrescimoPorAtraso } from "@/shared/domain/cobranca";
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
} from "./pecas";

/**
 * A folha da FATURA — o que o link da cobrança abre.
 *
 * ⚠️ "Fatura" na tela, "conta a receber" no código. O segundo é o nome do
 * módulo aqui dentro; quem abre o link não tem conta a receber nenhuma, tem uma
 * fatura para pagar. Renomear o modelo por causa do documento seria trocar o
 * vocabulário de tudo por um rótulo.
 *
 * ⚠️ Uma folha, e não uma por ticket.
 *
 * O link é de uma PARCELA, e parcela pertence à conta. A página abria antes uma
 * folha para cada ticket e repetia dentro de todas as mesmas parcelas: a mesma
 * cobrança impressa tantas vezes quantos tickets ela tivesse, e nenhuma delas
 * conseguia mostrar o valor certo, porque nenhum ticket sozinho responde por uma
 * conta que reúne vários.
 *
 * Aqui a composição diz de onde o dinheiro vem, com uma linha por ticket, e o
 * NÚMERO de cada um é link para a folha dele. Ninguém perde o detalhe do
 * serviço; ele só deixou de disputar com a cobrança quem responde o quanto.
 *
 * ⚠️ A mora sai da MESMA função da tela interna (`acrescimoPorAtraso`), com os
 * parâmetros vindos de `parametroscobranca`. Recalcular por aqui faria o
 * documento do cliente e o do sistema discordarem sobre quanto ele deve.
 */
export function FolhaDaConta({
  conta,
  empresa,
  cobranca,
  linkDoTicket,
}: {
  conta: CobrancaCompartilhada["conta"];
  empresa: CobrancaCompartilhada["empresa"];
  cobranca: CobrancaCompartilhada["cobranca"];
  /** Para onde o número do ticket aponta. */
  linkDoTicket: (numero: number) => string;
}) {
  const apuracao = periodoEmMeses(conta.inicio, conta.fim);
  const e = conta.cliente.endereco;
  const soma = (valores: Centavos[]) => valores.reduce<Centavos>((a, b) => somar(a, b), ZERO);

  const ate = hoje();

  /*
   * A mora de cada parcela, apurada antes de desenhar.
   *
   * ⚠️ Cada uma conta do PRÓPRIO vencimento e sobre o PRÓPRIO saldo: a parcela
   * que recebeu 2.250 de 2.500 deve mora sobre os 250 que faltam, contados do
   * dia em que ela venceu — e não sobre o valor cheio, nem a partir de hoje.
   */
  const linhas = conta.parcelas.map((p) => {
    const saldo = subtrair(p.total, p.recebido);
    const m =
      cobranca && saldo > 0
        ? acrescimoPorAtraso(saldo, p.vencimento, ate, cobranca)
        : { dias: 0, multa: ZERO, juros: ZERO };
    return { p, saldo, dias: m.dias, encargos: somar(m.multa, m.juros) };
  });

  /* A coluna só existe quando há o que mostrar nela: uma coluna de traços
     esconde as que têm número. */
  const temMora = linhas.some((l) => l.encargos > 0);

  const totalParcelas = soma(conta.parcelas.map((p) => p.total));
  const recebido = soma(conta.parcelas.map((p) => p.recebido));
  const saldo = soma(linhas.map((l) => l.saldo));
  const encargos = soma(linhas.map((l) => l.encargos));

  const composicao = soma(conta.tickets.map((t) => t.valor));

  return (
    <div className="folha">
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
              FATURA
            </div>

            <div style={{ marginTop: "5mm" }}>
              <Campo rotulo="Número" valor={String(conta.numero)} />
              <Campo rotulo="Situação" valor={conta.situacao || "—"} />
              {apuracao && <Campo rotulo="Apuração" valor={apuracao} />}
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
            <Nome>{conta.cliente.nome ?? "—"}</Nome>
            {conta.cliente.doc && <Detalhe>{conta.cliente.doc}</Detalhe>}
            {e && (
              <>
                <Detalhe>
                  {[e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ")}
                </Detalhe>
                <Detalhe>
                  {[e.bairro, [e.cidade, e.uf].filter(Boolean).join("/"), e.cep]
                    .filter(Boolean)
                    .join(" · ")}
                </Detalhe>
              </>
            )}
          </div>
        </div>

        {/* ── Composição ────────────────────────────────────────────────── */}
        {/*
          De onde vem o dinheiro. O número é LINK, e abre em outra aba: quem
          está conferindo a cobrança não pode perder a página dela para ver um
          serviço.
        */}
        <div style={{ marginTop: "14mm" }}>
          <Secao>COMPOSIÇÃO</Secao>

          <table style={{ marginTop: "2mm" }}>
            <thead>
              <tr>
                <Th larguraMm={20}>Ticket</Th>
                <Th>Descrição</Th>
                <Th larguraMm={44}>Projeto</Th>
                <Th direita larguraMm={22}>Data</Th>
                <Th direita larguraMm={26}>Valor</Th>
              </tr>
            </thead>
            <tbody>
              {conta.tickets.map((t) => (
                <tr key={t.numero}>
                  <Td>
                    <a
                      href={linkDoTicket(t.numero)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: AZUL, fontWeight: 600, textDecoration: "none" }}
                    >
                      {t.numero}
                    </a>
                  </Td>
                  <Td>{t.titulo}</Td>
                  <Td>{t.projetoNome ?? "—"}</Td>
                  <Td direita>{t.data ? paraFormatoBR(t.data as DataISO) : "—"}</Td>
                  <Td direita>{formatarSemSimbolo(t.valor)}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          <Resumo linhas={[{ rotulo: "Total dos serviços", valor: composicao, forte: true }]} />
        </div>

        {/* ── Parcelas ──────────────────────────────────────────────────── */}
        {/*
          ⚠️ Uma base só: a PARCELA. Contrato, pago, saldo e encargos saem todos
          dela, e por isso os totais fecham. A tabela antiga misturava o pago da
          conta inteira com o total de um ticket só, e a subtração não era o
          saldo de nada.
        */}
        <div style={{ marginTop: "12mm" }}>
          <Secao>PARCELAS</Secao>

          <table style={{ marginTop: "2mm" }}>
            <thead>
              <tr>
                <Th larguraMm={12}>#</Th>
                <Th larguraMm={26}>Vencto.</Th>
                <Th direita>Contrato</Th>
                <Th direita larguraMm={24}>Pago</Th>
                <Th direita larguraMm={24}>Data pgto.</Th>
                {temMora && <Th direita larguraMm={14}>Dias</Th>}
                <Th direita larguraMm={24}>Saldo</Th>
                {temMora && <Th direita larguraMm={24}>Encargos</Th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ p, saldo: s, dias, encargos: enc }) => (
                /*
                 * ⚠️ Sem destaque na parcela deste link.
                 *
                 * Ela saía com o fundo azul claro, para dizer "é esta que foi
                 * cobrada". Mas linha inteira pintada compete com o que está
                 * escrito nela, e numa tabela de cinco colunas de número o
                 * olho vai para a cor antes de ir para o valor. Quem manda a
                 * cobrança já diz qual parcela é: está no corpo do e-mail,
                 * em "Parcela 1 de 3".
                 */
                <tr key={p.numero}>
                  <Td>{p.numero}</Td>
                  <Td>{p.vencimento ? paraFormatoBR(p.vencimento as DataISO) : "—"}</Td>
                  <Td direita>{formatarSemSimbolo(p.total)}</Td>
                  <Td direita>{p.recebido > 0 ? formatarSemSimbolo(p.recebido) : "—"}</Td>
                  <Td direita>{p.pagoEm ? paraFormatoBR(p.pagoEm as DataISO) : "—"}</Td>
                  {temMora && <Td direita>{dias > 0 ? String(dias) : "—"}</Td>}
                  <Td direita>{s > 0 ? formatarSemSimbolo(s) : "—"}</Td>
                  {temMora && <Td direita>{enc > 0 ? formatarSemSimbolo(enc) : "—"}</Td>}
                </tr>
              ))}
            </tbody>
          </table>

          <Resumo
            linhas={[
              { rotulo: "Faturado", valor: totalParcelas },
              { rotulo: "Valor pago", valor: recebido },
              ...(encargos > 0 ? [{ rotulo: "Encargos até hoje", valor: encargos }] : []),
              {
                rotulo: encargos > 0 ? "Total a receber" : "Saldo devedor",
                valor: somar(saldo, encargos),
                forte: true,
              },
            ]}
          />

          {/* A conta não confere com o total dos serviços quando ela traz
              desconto ou acréscimo. Dizer isso é melhor que deixar o leitor
              procurar o erro que não existe. */}
          {composicao !== totalParcelas && (
            <div style={{ marginTop: "3mm", fontSize: "7.5pt", color: CINZA, lineHeight: 1.5 }}>
              O total das parcelas difere do total dos serviços por desconto ou acréscimo
              aplicado na conta.
            </div>
          )}
        </div>
      </div>

      <RodapeDaFolha esquerda={`Fatura ${conta.numero}`} />
    </div>
  );
}
