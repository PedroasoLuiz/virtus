"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAvisos } from "@/components/ui/avisos";
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
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();

  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [faturasDe, setFaturasDe] = useState<CartaoDaBaixa | null>(null);

  /*
   * ⚠️ A lista vem do servidor e a tela nao guarda copia dela.
   *
   * Ligar o interruptor grava e chama `refresh`: o estado do cartao passa a ser
   * o do banco, e nao um espelho local que pode divergir se a gravacao falhar.
   */
  async function alternarAtivo(c: CartaoDaBaixa) {
    const r = await fetch(`/api/v1/contas-pagar/cartoes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !c.ativo }),
    });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("erro", "Não foi possível mudar a situação do cartão", dados?.error?.message);
      return;
    }

    router.refresh();
  }

  async function excluir(c: CartaoDaBaixa) {
    const r = await fetch(`/api/v1/contas-pagar/cartoes/${c.id}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("erro", "Não foi possível excluir o cartão", dados?.error?.message);
      return;
    }

    router.refresh();
    avisar("sucesso", "Cartão excluído");
  }

  const termo = busca.trim().toLowerCase();

  const visiveis = cartoes.filter(
    (c) =>
      !termo ||
      (c.apelido ?? "").toLowerCase().includes(termo) ||
      (c.bandeira ?? "").toLowerCase().includes(termo) ||
      (c.ultimosDigitos ?? "").includes(termo),
  );

  /*
   * ⚠️ Sem campo de busca proprio: a tela ANUNCIA o seu filtro para a caixa do
   * topo, a unica do sistema. O estado continua sendo daqui — quem sabe o que e
   * "buscar um cartao" e esta tela; a caixa so chama `setBusca`, e a etiqueta com
   * o termo em vigor aparece sozinha no `PageHeader`. Ver `busca-da-tela`.
   */
  useRegistrarBusca("Cartões", busca, setBusca, visiveis.length);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Cartões" />

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

                    {/*
                      ⚠️ Interruptor, e não pastilha.

                      A pastilha só CONTAVA a situação, e mudá-la exigia abrir o
                      cadastro — dois cliques e uma tela para um estado de sim ou
                      não. O interruptor conta e muda no mesmo lugar, que é como o
                      resto do sistema trata "ativo".
                    */}
                    <Td>
                      <ActiveToggle active={c.ativo} onChange={() => void alternarAtivo(c)} />
                    </Td>

                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao rotulo="Ver faturas" onClick={() => setFaturasDe(c)}>
                          {/* Recibo com linhas: os ciclos daquele cartão. */}
                          <path d="M3.4 2.4h9.2v11.2l-1.5-1-1.5 1-1.6-1-1.5 1-1.6-1-1.5 1z" />
                          <path d="M5.8 6h4.4M5.8 8.6h3" />
                        </BotaoDeAcao>

                        {/*
                          ⚠️ Excluir vale só para o cartão que NUNCA teve fatura —
                          quem recusa é o servidor, com o número de faturas na
                          mensagem. Com fatura, as compras já contaram na DRE: o
                          histórico ficaria sem dono, e o caminho é o interruptor
                          ao lado.
                        */}
                        <BotaoDeAcao
                          rotulo="Excluir cartão"
                          perigo
                          onClick={() =>
                            confirmar(
                              `Excluir o cartão ${c.apelido ?? c.id}?`,
                              "Excluir",
                              () => excluir(c),
                              "Só é possível enquanto ele não tiver nenhuma fatura. Se já tiver, inative pelo interruptor da linha.",
                            )
                          }
                        >
                          <path d="M2.5 4h11" />
                          <path d="M5.5 4V2.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V4" />
                          <path d="M12.3 4l-.7 9a.8.8 0 0 1-.8.8H5.2a.8.8 0 0 1-.8-.8L3.7 4" />
                          <path d="M6.5 6.8v4.4M9.5 6.8v4.4" />
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
              rotulo="Novo cartão"
              legenda="Novo"
              destaque
              icone={<IconeMais />}
              onClick={() => setCriando(true)}
            />
          </BarraDeFerramentas>
        </div>
      </Panel>

      <FaturasDrawer cartao={faturasDe} onClose={() => setFaturasDe(null)} />
      {criando && <NovoCartaoDrawer onClose={() => setCriando(false)} />}
    </PageLayout>
  );
}
