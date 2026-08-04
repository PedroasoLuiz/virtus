"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  tdNum,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { ContaDrawer } from "./conta-drawer";
import { ExtratoDrawer } from "./extrato-drawer";
import { formatarSemSimbolo } from "@/shared/utils/money";
import type { ContaBancaria } from "@/modules/contas/contas.types";

/**
 * Contas e saldo.
 *
 * O extrato mora aqui dentro, aberto pela conta: era assim no legado e e o
 * caminho certo, porque extrato sem conta escolhida e uma pergunta pela metade.
 * Por isso "Extrato bancario" deixou de ser item de menu.
 */

export function ContasTabela({ contas }: { contas: ContaBancaria[] }) {
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<ContaBancaria | null>(null);
  const [criando, setCriando] = useState(false);
  const [extrato, setExtrato] = useState<ContaBancaria | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contas;

    return contas.filter((c) =>
      [c.apelido, c.banco, c.agencia, c.conta, c.tipo]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(termo)),
    );
  }, [contas, busca]);

  async function excluir(conta: ContaBancaria) {
    const r = await fetch(`/api/v1/contas/${conta.id}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível excluir a conta");
      return;
    }

    avisar("sucesso", "Conta excluída");
    router.refresh();
  }

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Contas e saldo">
          <SearchInput value={busca} onSearch={setBusca} />
          <IncluirButton onClick={() => setCriando(true)} />
        </PageHeader>

        <TableFrame>
          <TableArea minWidth={860}>
            <TableHead>
              <Th>Conta</Th>
              <Th minWidth={130}>Banco</Th>
              <Th minWidth={110}>Agência</Th>
              <Th minWidth={110}>Tipo</Th>
              <Th align="center" minWidth={90}>
                Situação
              </Th>
              <Th align="right" minWidth={120}>
                Saldo
              </Th>
              <Th align="right" minWidth={110}>
                Ações
              </Th>
            </TableHead>
            <tbody>
              {filtradas.length === 0 && <EmptyRow colSpan={7} />}
              {filtradas.map((c, i) => (
                <Tr
                  key={c.id}
                  delay={Math.min(i * 20, 150)}
                  dimmed={!c.ativo}
                  onClick={() => setExtrato(c)}
                >
                  <Td style={{ maxWidth: 240 }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.apelido?.trim() || c.nome}
                    </span>
                  </Td>
                  <Td style={{ color: "var(--text-secondary)" }}>{c.banco ?? "—"}</Td>
                  <Td style={{ color: "var(--text-secondary)" }}>
                    {[c.agencia, c.conta].filter(Boolean).join(" / ") || "—"}
                  </Td>
                  <Td style={{ color: "var(--text-secondary)" }}>{c.tipo ?? "—"}</Td>
                  <Td style={{ textAlign: "center" }}>
                    <Badge tom={c.ativo ? "success" : "neutral"}>
                      {c.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </Td>
                  <Td
                    style={{
                      ...tdNum,
                      fontWeight: "var(--fw-medium)",
                      color: c.saldo < 0 ? "var(--debito)" : "var(--text-primary)",
                    }}
                  >
                    {formatarSemSimbolo(c.saldo)}
                  </Td>
                  <Td>
                    <AcoesDaLinha>
                      <BotaoDeAcao rotulo="Ver extrato" onClick={() => setExtrato(c)}>
                        {/* Folha com linhas e um valor destacado: o papel do
                            extrato, e nao um cifrao, que significaria dinheiro
                            em vez do documento. */}
                        <path d="M3.4 2h9.2v12H3.4z" />
                        <path d="M5.6 5.2h4.8M5.6 7.6h4.8M5.6 10h2.8" />
                      </BotaoDeAcao>

                      <BotaoDeAcao rotulo="Editar conta" onClick={() => setEditando(c)}>
                        <path d="M11.2 2.6l2.2 2.2-7.4 7.4-2.8.6.6-2.8z" />
                      </BotaoDeAcao>

                      <BotaoDeAcao
                        rotulo="Excluir conta"
                        perigo
                        onClick={() =>
                          confirmar(
                            `Excluir a conta ${c.apelido?.trim() || c.nome}?`,
                            "Excluir",
                            () => excluir(c),
                            "Só é possível excluir conta que nunca recebeu lançamento. As demais se desativam.",
                          )
                        }
                      >
                        <path d="M2.4 4.4h11.2" />
                        <path d="M6 4.4V3a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v1.4" />
                        <path d="M12.4 4.4L11.8 13a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8L3.6 4.4" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>
        </TableFrame>
      </Panel>

      {(criando || editando) && (
        <ContaDrawer
          conta={editando}
          onClose={() => {
            setCriando(false);
            setEditando(null);
          }}
          aoSalvar={() => {
            setCriando(false);
            setEditando(null);
            router.refresh();
          }}
        />
      )}

      {extrato && <ExtratoDrawer conta={extrato} onClose={() => setExtrato(null)} />}
    </PageLayout>
  );
}
