"use client";

import { useMemo, useState } from "react";
import {
  AcoesDaLinha,
  Badge,
  BotaoDeAcao,
  EmptyRow,
  FilterButton,
  FilterItem,
  PageHeader,
  PageLayout,
  Panel,
  SearchInput,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
  selectStyle,
  tdNum,
  type Tom,
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Emitente, ParcelaDoCliente } from "@/modules/portal/portal.types";

/**
 * As cobranças do cliente, na UI do sistema.
 *
 * Mesma casca das listagens internas — `PageLayout`, `Panel`, `PageHeader`,
 * `TableFrame` — e não um desenho próprio. O portal é uma tela do produto, não
 * um anexo: se ele parecesse outra coisa, cada ajuste no sistema teria que ser
 * refeito aqui à mão.
 *
 * ⚠️ Nenhum número de conta a receber aparece. A conta é controle interno; o que
 * o cliente conhece é o TICKET e o vencimento (ver docs/10).
 */

type Situacao = "Pago" | "Vencido" | "Em aberto";

const TOM: Record<Situacao, Tom> = {
  Pago: "success",
  Vencido: "danger",
  "Em aberto": "info",
};

function situacaoDe(p: ParcelaDoCliente): Situacao {
  if (p.pago) return "Pago";
  return p.atrasada ? "Vencido" : "Em aberto";
}

export function CobrancasTabela({
  parcelas,
  emitentes,
  emAberto,
  vencido,
}: {
  parcelas: ParcelaDoCliente[];
  emitentes: Emitente[];
  emAberto: Centavos;
  vencido: Centavos;
}) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [emitente, setEmitente] = useState("");

  // Mais de um emitente habilita a escolha: o mesmo cliente pode ser atendido
  // por mais de uma empresa da casa, e para ele são cobranças de origens
  // diferentes. Com um só, o filtro seria uma pergunta de resposta única.
  const varios = emitentes.length > 1;

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return parcelas.filter((p) => {
      if (situacao && situacaoDe(p) !== situacao) return false;
      if (emitente && String(p.emitente.id) !== emitente) return false;
      if (!termo) return true;

      return (
        p.tickets.some((t) => String(t).includes(termo)) ||
        p.emitente.nome.toLowerCase().includes(termo)
      );
    });
  }, [parcelas, busca, situacao, emitente]);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Minhas cobranças">
          <FilterButton
            activeCount={(situacao ? 1 : 0) + (emitente ? 1 : 0)}
            onClear={() => {
              setSituacao("");
              setEmitente("");
            }}
          >
            {varios && (
              <FilterItem label="Cobrado por">
                <select
                  value={emitente}
                  onChange={(e) => setEmitente(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Todas as empresas</option>
                  {emitentes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </FilterItem>
            )}

            <FilterItem label="Situação">
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                style={selectStyle}
              >
                <option value="">Todas</option>
                <option value="Em aberto">Em aberto</option>
                <option value="Vencido">Vencido</option>
                <option value="Pago">Pago</option>
              </select>
            </FilterItem>
          </FilterButton>

          <SearchInput value={busca} onSearch={setBusca} />
        </PageHeader>

        {/* Os totais antes da tabela: é a pergunta que traz o cliente aqui.
            Vencido só aparece quando existe — um "R$ 0,00 vencido" permanente
            ensina a ignorar o número justamente quando ele passa a importar. */}
        <div style={{ display: "flex", gap: 24, padding: "0 4px 14px" }}>
          <Total rotulo="Em aberto" valor={emAberto} />
          {vencido > 0 && <Total rotulo="Vencido" valor={vencido} alerta />}
        </div>

        <TableFrame>
          <TableArea minWidth={760}>
            <TableHead>
              {varios && <Th minWidth={160}>Cobrado por</Th>}
              <Th minWidth={130}>Referente a</Th>
              <Th minWidth={90}>Parcela</Th>
              <Th minWidth={110}>Vencimento</Th>
              <Th align="center" minWidth={100}>
                Situação
              </Th>
              <Th align="right" minWidth={110}>
                Valor
              </Th>
              <Th align="right" minWidth={80}>
                Ações
              </Th>
            </TableHead>
            <tbody>
              {filtradas.length === 0 && <EmptyRow colSpan={varios ? 7 : 6} />}
              {filtradas.map((p, i) => (
                <Tr key={p.parcelaId} delay={Math.min(i * 20, 150)} dimmed={p.pago}>
                  {varios && (
                    <Td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {p.emitente.nome}
                    </Td>
                  )}

                  <Td>
                    {p.tickets.length > 0 ? (
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {p.tickets.length > 1 ? "Tickets " : "Ticket "}
                        {p.tickets.join(", ")}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>Cobrança</span>
                    )}
                  </Td>

                  <Td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {p.totalParcelas > 1 ? `${p.numero} de ${p.totalParcelas}` : "Única"}
                  </Td>

                  <Td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {p.vencimento ? paraFormatoBR(p.vencimento as DataISO) : "—"}
                  </Td>

                  <Td style={{ textAlign: "center" }}>
                    <Badge tom={TOM[situacaoDe(p)]}>{situacaoDe(p)}</Badge>
                  </Td>

                  <Td style={{ ...tdNum, fontWeight: "var(--fw-medium)" }}>
                    {formatarSemSimbolo((p.pago ? p.total : p.emAberto) as Centavos)}
                  </Td>

                  <Td>
                    <AcoesDaLinha>
                      {/*
                       * O mesmo documento que vai no e-mail da cobrança.
                       *
                       * `/p/{token}` já existe, já mostra o ticket no formato
                       * impresso e já serve boleto e nota — é exatamente a
                       * página que o cliente abre quando clica no link que
                       * recebeu. Reaproveitar evita uma segunda tela de detalhe
                       * e uma segunda forma de errar a permissão do arquivo.
                       */}
                      <BotaoDeAcao
                        rotulo="Abrir cobrança"
                        desabilitado={!p.token}
                        onClick={() => {
                          if (p.token) window.open(`/p/${p.token}`, "_blank", "noopener");
                        }}
                      >
                        {/* Bilhete com o corte lateral: é o ticket, e não uma
                            folha, que significaria documento genérico. */}
                        <path d="M2.2 5.4a1 1 0 0 1 1-1h9.6a1 1 0 0 1 1 1v1.2a1.4 1.4 0 0 0 0 2.8v1.2a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V9.4a1.4 1.4 0 0 0 0-2.8z" />
                        <path d="M9.4 4.4v7.2" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>
        </TableFrame>
      </Panel>
    </PageLayout>
  );
}

function Total({ rotulo, valor, alerta }: { rotulo: string; valor: Centavos; alerta?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
        {rotulo}
      </span>
      <span
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
          color: alerta ? "var(--danger-text)" : "var(--text-primary)",
        }}
      >
        {formatarSemSimbolo(valor)}
      </span>
    </div>
  );
}
