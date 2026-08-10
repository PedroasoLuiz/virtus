"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Badge,
  Button,
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
  type Tom,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { competenciaBR } from "@/shared/domain/cartao";
import type { CartaoDaBaixa, FaturaDeCartao } from "@/modules/contas-pagar/contas-pagar.types";

/**
 * As faturas de um cartão, ciclo a ciclo.
 *
 * ⚠️ Drawer, e não outra página. É a mesma relação do extrato com a conta
 * bancária: a fatura não existe sozinha, ela é de um cartão. Como página, o
 * primeiro campo seria "escolha o cartão" — a pergunta que a linha já respondeu.
 */

const TOM: Record<string, Tom> = {
  ABERTA: "info",
  FECHADA: "success",
};

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
  const [fechando, setFechando] = useState<number | null>(null);

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

  async function fechar(f: FaturaDeCartao) {
    setFechando(f.id);

    const r = await fetch(`/api/v1/contas-pagar/faturas/${f.id}/fechamento`, { method: "POST" });
    const dados = await r.json().catch(() => null);
    setFechando(null);

    if (!r.ok) {
      avisar("atencao", "Não foi possível fechar", dados?.error?.message);
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
    <Drawer open onClose={onClose} title="Faturas do cartão">
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

          <Field label="Ciclo">
            <CampoBloqueado
              valor={`Fecha dia ${cartao.diaFechamento}, vence dia ${cartao.diaVencimento}`}
            />
          </Field>
        </GrupoDeCampos>

        <GrupoDeCampos
          titulo="Os ciclos"
          legenda="Fechar gera a conta a pagar da fatura. Ela é liquidação, e não despesa nova: o custo já foi lançado em cada compra."
        >
          <TableArea minWidth={0}>
            <TableHead>
              <Th minWidth={100}>Competência</Th>
              <Th minWidth={104}>Vencimento</Th>
              <Th minWidth={80}>Compras</Th>
              <Th minWidth={110}>Valor</Th>
              <Th minWidth={90}>Situação</Th>
              <Th minWidth={140}> </Th>
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
                <Tr key={f.id} delay={i * 12}>
                  <Td style={NUM}>{competenciaBR(f.competencia)}</Td>
                  <Td style={NUM}>
                    {f.vencimento ? paraFormatoBR(f.vencimento as DataISO) : "—"}
                  </Td>
                  <Td style={NUM}>{f.qtdLancamentos}</Td>
                  <Td style={NUM}>{formatarSemSimbolo(f.total as Centavos)}</Td>
                  <Td>
                    <Badge tom={TOM[f.status] ?? "neutral"}>{f.status}</Badge>
                  </Td>

                  <Td>
                    {/*
                      ⚠️ Fechada mostra a CONTA que gerou, e não some com a ação.
                      Some, e quem fechou não descobre para onde a fatura foi.
                    */}
                    {f.status === "FECHADA" ? (
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                        {f.contaPagarId ? `Conta ${f.contaPagarId}` : "Sem conta gerada"}
                      </span>
                    ) : (
                      <span
                        title={f.qtdLancamentos === 0 ? "Esta fatura não tem lançamentos" : undefined}
                      >
                        {/*
                          ⚠️ Pede confirmação com o VALOR no texto: fechar gera
                          dívida e não se desfaz pela tela, e o número é o que a
                          pessoa precisa reconhecer antes de dizer sim.
                        */}
                        <Button
                          size="sm"
                          variant={f.qtdLancamentos > 0 ? "primary" : "secondary"}
                          disabled={f.qtdLancamentos === 0 || fechando === f.id}
                          onClick={() =>
                            confirmar(
                              `Fechar a fatura de ${competenciaBR(f.competencia)} e gerar a conta a pagar de ${formatarSemSimbolo(f.total as Centavos)}?`,
                              "Fechar fatura",
                              () => fechar(f),
                            )
                          }
                        >
                          {fechando === f.id ? "Fechando…" : "Fechar fatura"}
                        </Button>
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>
        </GrupoDeCampos>
      </Formulario>
    </Drawer>
  );
}
