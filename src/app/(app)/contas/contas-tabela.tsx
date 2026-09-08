"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AcoesDaLinha,
  ActiveToggle,
  BotaoDeAcao,
  EmptyRow,
  PageHeader,
  PageLayout,
  Panel,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { BarraDeFerramentas, BotaoDaBarra, IconeMais } from "@/components/ui/barra-de-ferramentas";
import { useRegistrarBusca } from "@/components/layout/busca-da-tela";
import { useAvisos } from "@/components/ui/avisos";
import { ContaDrawer } from "./conta-drawer";
import { ExtratoDrawer } from "./extrato-drawer";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import type { ContaBancaria } from "@/modules/contas/contas.types";

/**
 * Contas e saldo.
 *
 * O extrato mora aqui dentro, aberto pela conta: era assim no legado e e o
 * caminho certo, porque extrato sem conta escolhida e uma pergunta pela metade.
 * Por isso "Extrato bancario" deixou de ser item de menu.
 */

export function ContasTabela({
  contas,
  empresa,
  emitidoPor,
}: {
  contas: ContaBancaria[];
  /** Emitente do cabecalho do extrato em PDF. */
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
}) {
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

  /**
   * ⚠️ Sem estado local: quem guarda a situacao e o servidor.
   *
   * Um `useState` por linha daria o retorno imediato do clique, mas ficaria
   * mentindo quando a gravacao falhasse — e o interruptor e justamente onde a
   * mentira custa caro, porque a conta pareceria fora do ar continuando a
   * aparecer nas listas de escolha. O `refresh` traz a verdade de volta.
   */
  async function alternarSituacao(conta: ContaBancaria) {
    const r = await fetch(`/api/v1/contas/${conta.id}/situacao`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !conta.ativo }),
    });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível mudar a situação da conta",
      );
      return;
    }

    avisar("sucesso", conta.ativo ? "Conta inativada" : "Conta ativada");
    router.refresh();
  }

  async function excluir(conta: ContaBancaria) {
    const r = await fetch(`/api/v1/contas/${conta.id}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível excluir a conta",
      );
      return;
    }

    avisar("sucesso", "Conta excluída");
    router.refresh();
  }

  /*
   * ⚠️ Sem campo de busca proprio: a tela ANUNCIA o seu filtro para a caixa do
   * topo, a unica do sistema. O estado continua sendo daqui — quem sabe o que e
   * "buscar uma conta" e esta tela; a caixa so chama `setBusca`, e a etiqueta com
   * o termo em vigor aparece sozinha no `PageHeader`. Ver `busca-da-tela`.
   */
  useRegistrarBusca("Contas e saldo", busca, setBusca, filtradas.length);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Contas e saldo" />

        {/*
          ⚠️ O recuo da pagina mora AQUI, e a tabela entra `solto`.

          Com a barra ao lado, a margem propria do `TableFrame` viraria um vao
          entre o cartao e a barra — e os dois precisam se encostar. Passando o
          recuo para a linha, o conjunto continua alinhado com o resto da tela.
        */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            /* Sem margem a DIREITA: aquele respiro e da propria barra, que o
               carrega na largura. Ver `BarraDeFerramentas`. */
            margin: "0 0 16px 16px",
          }}
        >
          <TableFrame solto>
            <TableArea minWidth={860}>
              {/*
                ⚠️ SEM coluna de saldo, e nao por desenho: por custo.

                `vwsaldo` varre `pagamentos` inteiro a cada chamada, e a listagem
                pedia o saldo de todas as contas da empresa. Vinte contas e vinte
                pessoas com a tela aberta viravam uma varredura completa por
                abertura, vezes vinte — e indice nao corta isso, porque somar todas
                as contas exige tocar todo lancamento de qualquer jeito.

                O saldo continua a um clique: o extrato abre com abertura,
                entradas, saidas e fecho do periodo, e ai a conta e de UMA conta so.
              */}
              <TableHead>
                <Th>Conta</Th>
                <Th minWidth={130}>Banco</Th>
                <Th minWidth={110}>Agência</Th>
                <Th minWidth={110}>Tipo</Th>
                <Th align="center" minWidth={70}>
                  Ativo
                </Th>
                <Th align="right" minWidth={110}>
                  Ações
                </Th>
              </TableHead>
              <tbody>
                {filtradas.length === 0 && <EmptyRow colSpan={6} />}
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
                    <Td style={{ color: "var(--text-secondary)" }}>
                      {c.banco ?? "—"}
                    </Td>
                    <Td style={{ color: "var(--text-secondary)" }}>
                      {[c.agencia, c.conta].filter(Boolean).join(" / ") || "—"}
                    </Td>
                    <Td style={{ color: "var(--text-secondary)" }}>
                      {c.tipo ?? "—"}
                    </Td>
                    {/*
                      ⚠️ Interruptor, e nao etiqueta.

                      A etiqueta so DIZIA a situacao: para desativar uma conta era
                      preciso abrir o cadastro, achar o campo e salvar. E o gesto
                      mais comum da tela — conta que se encerra no banco —, e era
                      o mais escondido. O mesmo interruptor do drawer, para nao
                      haver dois desenhos do mesmo gesto.
                    */}
                    <Td style={{ textAlign: "center" }}>
                      {/* A linha inteira abre o extrato: sem parar o clique aqui,
                          ligar a conta abriria o extrato junto. */}
                      <span onClick={(e) => e.stopPropagation()}>
                        <ActiveToggle
                          active={c.ativo}
                          onChange={() => alternarSituacao(c)}
                        />
                      </span>
                    </Td>
                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao
                          rotulo="Ver extrato"
                          onClick={() => setExtrato(c)}
                        >
                          {/* Folha com linhas e um valor destacado: o papel do
                              extrato, e nao um cifrao, que significaria dinheiro
                              em vez do documento. */}
                          <path d="M3.4 2h9.2v12H3.4z" />
                          <path d="M5.6 5.2h4.8M5.6 7.6h4.8M5.6 10h2.8" />
                        </BotaoDeAcao>

                        <BotaoDeAcao
                          rotulo="Editar conta"
                          onClick={() => setEditando(c)}
                        >
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

          <BarraDeFerramentas>
            <BotaoDaBarra
              rotulo="Nova conta"
              legenda="Nova"
              destaque
              icone={<IconeMais />}
              onClick={() => setCriando(true)}
            />
          </BarraDeFerramentas>
        </div>
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

      {extrato && (
        <ExtratoDrawer
          conta={extrato}
          empresa={empresa}
          emitidoPor={emitidoPor}
          onClose={() => setExtrato(null)}
        />
      )}
    </PageLayout>
  );
}
