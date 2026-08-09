"use client";

import { useEffect, useState } from "react";
import { BotaoDeCabecalho, Drawer } from "@/components/ui/drawer";
import {
  Alert,
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
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Recebimento } from "@/modules/recebimentos/recebimentos.types";

/**
 * Detalhe de um recebimento: o lancamento em cima, o rateio embaixo.
 *
 * A pergunta que esta tela responde e "este dinheiro do extrato pagou o que?".
 * Por isso o destaque vai para a lista de parcelas, e nao para os dados do
 * lancamento, que a listagem ja mostrou.
 *
 * Somente leitura de proposito: mexer num recebimento ja gravado mexe no saldo
 * de contas que talvez ja tenham recibo emitido. Correcao vira estorno, que e
 * gesto proprio e ainda nao existe.
 */

export function RecebimentoDrawer({
  recebimentoId,
  aoEstornar,
  onClose,
}: {
  recebimentoId: number | null;
  aoEstornar?: () => void;
  onClose: () => void;
}) {
  // `key` remonta a cada recebimento: o estado nasce vazio sozinho, sem limpar a
  // mao num efeito, e sem mostrar o registro anterior enquanto carrega.
  return recebimentoId == null ? null : (
    <Conteudo
      key={recebimentoId}
      recebimentoId={recebimentoId}
      aoEstornar={aoEstornar}
      onClose={onClose}
    />
  );
}

function Conteudo({
  recebimentoId,
  aoEstornar,
  onClose,
}: {
  recebimentoId: number;
  aoEstornar?: () => void;
  onClose: () => void;
}) {
  const [recebimento, setRecebimento] = useState<Recebimento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { avisar, confirmar } = useAvisos();

  async function estornar() {
    const r = await fetch(`/api/v1/recebimentos/${recebimentoId}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível estornar");
      return;
    }

    avisar("sucesso", "Recebimento estornado", "As parcelas voltaram a ficar em aberto.");
    aoEstornar?.();
    onClose();
  }

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/recebimentos/${recebimentoId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o recebimento");
        setRecebimento(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [recebimentoId]);

  return (
    <Drawer
      open
      onClose={onClose}
      /*
        ⚠️ Sem o numero no titulo: ele agora e o campo Codigo, logo abaixo.

        Escrito nos dois lugares, a mesma informacao aparece duas vezes na
        primeira dobra da tela, e a do titulo e a pior das duas — nao se copia e
        some ao rolar. Mesma decisao da conta a receber, que se chama so "Conta a
        receber".
      */
      title="Recebimento"
      headerExtra={
        recebimento ? (
          /*
           * Estornar so aparece enquanto a linha nao foi conciliada.
           *
           * Conciliar e "conferi no extrato e bate"; apagar depois disso desfaz
           * uma conferencia que alguem assinou. Desabilitado com o motivo, e nao
           * escondido: sumir faria parecer que o sistema nao sabe estornar.
           */
          <BotaoDeCabecalho
            rotulo={
              recebimento.conciliado
                ? "Recebimento conciliado não é estornado"
                : "Estornar este recebimento"
            }
            perigo
            desabilitado={recebimento.conciliado}
            onClick={() =>
              confirmar(
                `Estornar o recebimento ${recebimento.id}?`,
                "Estornar",
                estornar,
                "O lançamento é apagado e as parcelas voltam a ficar em aberto. O desconto dado na baixa volta a ser devido.",
              )
            }
          >
            {/* Seta circular anti-horária: desfazer. Um arco quase fechado, com
                a ponta abrindo em cima à esquerda, que é de onde a seta sai.
                Desenhada na grade de 24, que é o `viewBox` do botão de cabeçalho. */}
            <path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.7" />
            <path d="M4 4v5h5" />
          </BotaoDeCabecalho>
        ) : null
      }
    >
      {erro && (
        /*
          O `Alert` do kit, e nao uma caixa escrita aqui. A que existia
          pintava o TEXTO de `--danger-text` sobre `--danger-bg`, e o
          proprio kit avisa que essa combinacao tem menos contraste que o
          preto do resto da pagina. La quem carrega a gravidade e o icone
          e o cartao.
        */
        <Alert variant="danger" title={erro} />
      )}

      {recebimento && (
        /*
          ⚠️ A anatomia e a do resto do sistema: `Formulario` e `GrupoDeCampos`,
          com o vao entre campos vindo do token. Havia aqui um `div` com `gap: 3`
          e uma margem de 18 escritos a mao, que acertavam o ritmo dos campos por
          coincidencia e erravam o de um bloco para o outro.
        */
        <Formulario>
          <GrupoDeCampos
            primeiro
            titulo="Como o dinheiro entrou"
            legenda="O lançamento como ele foi gravado. Recebimento não se edita: corrigir é estornar e lançar de novo, porque mexer num valor já conciliado desfaz uma conferência que alguém assinou."
          >
            {/*
              ⚠️ O codigo vem PRIMEIRO, e e campo com cadeado como os outros.

              E o que se dita ao telefone e o que se procura no extrato. Escrito
              so no titulo do drawer, ele some assim que a pessoa rola ate a
              tabela, e nao da para copiar. Mesma decisao da conta a receber.
            */}
            <Field label="Código">
              <CampoBloqueado
                valor={String(recebimento.id)}
                titulo="O número é dado pelo sistema quando o recebimento nasce."
              />
            </Field>

            {/* Antes do cliente: baixa é ato de alguém, e a primeira pergunta de
                quem confere um lançamento estranho é quem lançou. */}
            <Field label="Baixado por">
              <CampoBloqueado
                valor={recebimento.registradoPor ?? "—"}
                titulo={
                  recebimento.registradoEm
                    ? `Lançado em ${paraFormatoBR(recebimento.registradoEm.slice(0, 10) as DataISO)}`
                    : undefined
                }
              />
            </Field>

            <Field label="Cliente">
              <CampoBloqueado valor={recebimento.clienteNome ?? "—"} />
            </Field>
            <Field label="Data">
              <CampoBloqueado
                valor={recebimento.data ? paraFormatoBR(recebimento.data as DataISO) : "—"}
              />
            </Field>
            <Field label="Forma">
              <CampoBloqueado valor={recebimento.tipo ?? "—"} />
            </Field>
            <Field label="Conta">
              <CampoBloqueado valor={recebimento.contaNome ?? "—"} />
            </Field>

            {/*
              ⚠️ O valor virou CAMPO, e saiu do rodape.

              No rodape ele era um numero solto com rotulo miudo, verde, do lado
              de fora do bloco onde mora todo o resto do lancamento: o unico dado
              da tela que nao se copiava, justamente o que se confere contra o
              extrato. Como campo, ele tem o rotulo a esquerda como os outros e
              vem logo depois da conta em que caiu, que e a pergunta anterior.
              Mesma decisao dos tres valores da conta a receber.
            */}
            <Field label="Entrou no banco">
              <CampoBloqueado valor={formatarSemSimbolo(recebimento.valor)} />
            </Field>

            <Field label="Conciliado">
              <CampoBloqueado
                valor={recebimento.conciliado ? "Sim" : "Ainda não"}
                titulo="Conciliar é conferir no extrato do banco. É gesto humano, e nada no sistema marca sozinho."
              />
            </Field>
            {recebimento.observacoes && (
              <Field label="Observações">
                <CampoBloqueado valor={recebimento.observacoes} multilinha />
              </Field>
            )}
          </GrupoDeCampos>

          <GrupoDeCampos
            titulo="Parcelas quitadas"
            legenda="Para onde cada parte deste dinheiro foi. Juros e multa entram por cima do que abateu a dívida, e é por isso que somar as três colunas passa do valor da parcela."
          >
            {/*
              ⚠️ A tabela e a do KIT, e nao uma escrita neste arquivo.

              A que existia aqui repetia moldura, cabecalho cinza e altura de
              linha por conta propria, e ja discordava do resto do sistema em
              detalhe que ninguem notaria uma tela por vez: o dia em que a altura
              da linha muda no kit, esta continuaria com a antiga.

              ⚠️ Tudo a ESQUERDA, inclusive numero. E a regra da conta a receber,
              e ela existe para o olho nao refazer o percurso a cada tela.
            */}
            <TableArea minWidth={0}>
              <TableHead>
                <Th minWidth={80}>Conta</Th>
                <Th minWidth={70}>Parcela</Th>
                <Th minWidth={110}>Vencimento</Th>
                <Th minWidth={100}>Abatido</Th>
                <Th minWidth={90}>Juros</Th>
                <Th minWidth={90}>Multa</Th>
              </TableHead>

              <tbody>
                {recebimento.destinos.length === 0 && (
                  <EmptyRow colSpan={6} message="Nenhuma parcela neste recebimento." />
                )}

                {recebimento.destinos.map((d) => (
                  <Tr key={`${d.faturaNumero}-${d.numero}`}>
                    <Td style={NUM}>{d.faturaNumero}</Td>
                    <Td style={NUM}>{d.numero}</Td>
                    <Td>{d.vencimento ? paraFormatoBR(d.vencimento as DataISO) : "—"}</Td>
                    <Td style={NUM}>{formatarSemSimbolo(d.valor as Centavos)}</Td>
                    {/* Zero, e não travessão: a coluna é de dinheiro, e "0,00"
                        diz que não houve juros. O travessão diz "não se aplica",
                        que é outra coisa, e aqui sempre se aplica. */}
                    <Td style={NUM}>{formatarSemSimbolo(d.juros as Centavos)}</Td>
                    <Td style={NUM}>{formatarSemSimbolo(d.multa as Centavos)}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableArea>
          </GrupoDeCampos>
        </Formulario>
      )}
    </Drawer>
  );
}

/**
 * Numero na tabela: tabular e sem quebra, mas a ESQUERDA.
 *
 * ⚠️ Nao e o `tdNum` do kit. Aquele alinha a direita, e aqui a regra e a da
 * conta a receber: tudo a esquerda, inclusive dinheiro. O que se ganha e o
 * digito alinhado com o digito de cima, que e o que faz uma coluna de valores
 * ser conferivel de relance.
 */
const NUM: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
