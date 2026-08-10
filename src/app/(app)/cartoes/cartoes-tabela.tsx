"use client";

import { useState } from "react";
import {
  AcoesDaLinha,
  Badge,
  BotaoDeAcao,
  EmptyRow,
  IncluirButton,
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
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { NovoCartaoDrawer } from "./novo-cartao-drawer";
import { FaturasDrawer } from "./faturas-drawer";
import type { CartaoDaBaixa } from "@/modules/contas-pagar/contas-pagar.types";

/**
 * Os cartões da empresa.
 *
 * ⚠️ A página lista CARTÕES, e as faturas abrem em drawer pela linha — a mesma
 * relação do extrato com a conta bancária. Fatura não existe sozinha: ela é de
 * um cartão, e numa lista solta a primeira coluna teria de ser "de qual cartão",
 * que é a pergunta que a linha já responde.
 *
 * ⚠️ E SEM abas. Aba é recurso de drawer neste sistema; na página ela criaria
 * dois lugares para estar sem que a URL mudasse, e voltar pelo navegador levaria
 * para a aba errada.
 */

const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

export function CartoesTabela({ cartoes }: { cartoes: CartaoDaBaixa[] }) {
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [faturasDe, setFaturasDe] = useState<CartaoDaBaixa | null>(null);

  const termo = busca.trim().toLowerCase();

  const visiveis = cartoes.filter(
    (c) =>
      !termo ||
      (c.apelido ?? "").toLowerCase().includes(termo) ||
      (c.bandeira ?? "").toLowerCase().includes(termo) ||
      (c.ultimosDigitos ?? "").includes(termo),
  );

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Cartões">
          <SearchInput value={busca} onSearch={setBusca} />
          <IncluirButton onClick={() => setCriando(true)} />
        </PageHeader>

        <TableFrame>
          <TableArea minWidth={860}>
            <TableHead>
              <Th minWidth={180}>Apelido</Th>
              <Th minWidth={170}>Emissor</Th>
              <Th minWidth={110}>Bandeira</Th>
              <Th minWidth={110}>Número</Th>
              <Th minWidth={110}>Fechamento</Th>
              <Th minWidth={110}>Vencimento</Th>
              <Th minWidth={110}>Limite</Th>
              <Th minWidth={90}>Situação</Th>
              <Th minWidth={80}>Ações</Th>
            </TableHead>

            <tbody>
              {visiveis.length === 0 && (
                <EmptyRow colSpan={9} message="Nenhum cartão cadastrado." />
              )}

              {visiveis.map((c, i) => (
                <Tr key={c.id} delay={Math.min(i * 20, 150)} dimmed={!c.ativo}>
                  <Td>{c.apelido ?? `Cartão ${c.id}`}</Td>
                  {/* O emissor e quem cobra a fatura: e ele que vira fornecedor
                      da conta a pagar quando o ciclo fecha. */}
                  <Td>{c.bancoNome ?? "—"}</Td>
                  <Td>{c.bandeira ?? "—"}</Td>

                  {/*
                    ⚠️ Só os 4 últimos, com os pontos na frente para deixar claro
                    que o resto não existe aqui. O número completo e o CVV não
                    são guardados pelo sistema.
                  */}
                  <Td style={NUM}>{c.ultimosDigitos ? `•••• ${c.ultimosDigitos}` : "—"}</Td>

                  <Td style={NUM}>dia {c.diaFechamento}</Td>
                  <Td style={NUM}>dia {c.diaVencimento}</Td>
                  <Td style={NUM}>
                    {c.limite > 0 ? formatarSemSimbolo(c.limite as Centavos) : "—"}
                  </Td>

                  <Td>
                    <Badge tom={c.ativo ? "success" : "neutral"}>
                      {c.ativo ? "ATIVO" : "INATIVO"}
                    </Badge>
                  </Td>

                  <Td>
                    <AcoesDaLinha>
                      <BotaoDeAcao rotulo="Ver faturas" onClick={() => setFaturasDe(c)}>
                        {/* Recibo com linhas: os ciclos daquele cartão. */}
                        <path d="M3.4 2.4h9.2v11.2l-1.5-1-1.5 1-1.6-1-1.5 1-1.6-1-1.5 1z" />
                        <path d="M5.8 6h4.4M5.8 8.6h3" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>
        </TableFrame>
      </Panel>

      <FaturasDrawer cartao={faturasDe} onClose={() => setFaturasDe(null)} />
      {criando && <NovoCartaoDrawer onClose={() => setCriando(false)} />}
    </PageLayout>
  );
}
