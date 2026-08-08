"use client";

import { useMemo, useState } from "react";
import {
  CampoNumerico,
  inputDeCelula,
  MarcaDeUso,
  Pagination,
  SearchInput,
  TableArea,
  TableHead,
  Td,
  tdNum,
  Th,
  Tr,
} from "@/components/ui/kit";
import { filaDeRecebimento } from "@/shared/domain/parcelas";
import type { ParametrosDeCobranca } from "@/shared/domain/cobranca";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { ParcelaEmAberto } from "@/modules/recebimentos/recebimentos.types";
import {
  POR_PAGINA_NA_BAIXA,
  preencher,
  valorDaLinha,
  VAZIO,
  type EstadoDaLinha,
  type Valores,
} from "./baixa-linhas";

/**
 * Para onde o dinheiro foi: a divida que esta baixa abate, parcela a parcela.
 *
 * ⚠️ Busca, pagina e a linha em edicao sao estado DAQUI, e nao da casca. Sao
 * tres perguntas sobre como olhar a lista, e nenhuma delas muda o que vai para o
 * banco: na casca, elas obrigariam o drawer inteiro a renderizar de novo a cada
 * tecla do filtro. O que sobe para a casca e `valores`, porque e ele que vira
 * lancamento.
 */
export function AbaDePagamentos({
  parcelas,
  cobranca,
  data,
  total,
  valores,
  aoMudarValores,
  carregando,
  semCliente,
}: {
  parcelas: ParcelaEmAberto[];
  cobranca: ParametrosDeCobranca;
  /** O dia do pagamento: e ele que define o atraso de cada parcela. */
  data: string;
  /** O total da baixa inteira, para o pe da tabela. */
  total: Centavos;
  valores: Valores;
  aoMudarValores: (atualizar: (atual: Valores) => Valores) => void;
  carregando: boolean;
  semCliente: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  /*
   * A parcela cujo valor esta sendo digitado a mao.
   *
   * ⚠️ Uma de cada vez, e por clique. Receber menos e o caso raro, e um campo
   * aberto em toda linha convidaria a digitar o numero que ja esta calculado ao
   * lado — com as duas versoes podendo discordar.
   */
  const [parcial, setParcial] = useState<number | null>(null);

  /**
   * O que o filtro por numero de conta deixou na tela.
   *
   * ⚠️ Filtra por CONTA INTEIRA, e nunca por parcela solta. A fila de
   * recebimento diz que a parcela seguinte de uma conta so abre quando a
   * anterior fecha, e ela e calculada por conta sobre a lista que esta na mao:
   * escondendo a parcela 1 e deixando a 2, a tela liberaria a 2 acreditando que
   * ela e a primeira da fila. Quem baixa preencheria a linha inteira e so
   * descobriria o bloqueio no Registrar, quando o servidor recusa em
   * `paradaNaFila`. Casando a conta e trazendo todas as parcelas dela, a fila
   * continua vendo o mesmo que veria sem filtro nenhum.
   */
  const filtradas = useMemo(() => {
    const termo = busca.trim();
    if (!termo) return parcelas;

    const contas = new Set(
      parcelas.filter((p) => String(p.faturaNumero).includes(termo)).map((p) => p.faturaId),
    );

    return parcelas.filter((p) => contas.has(p.faturaId));
  }, [parcelas, busca]);

  /*
   * Quais parcelas aceitam valor AGORA.
   *
   * Recalculado a cada digito porque a fila anda dentro do proprio formulario:
   * cobrir a parcela 1 por inteiro libera a 2 na mesma tela, sem salvar e voltar.
   * A regra e a mesma que o servidor confere em `paradaNaFila` — aqui ela apenas
   * evita que o usuario descubra o bloqueio depois de preencher tudo.
   *
   * ⚠️ Le `parcelas`, e nao `filtradas` nem a pagina. A fila e do que EXISTE em
   * aberto, e nao do que esta a vista: calculada sobre a lista recortada, a
   * primeira parcela de cada recorte pareceria liberada.
   */
  const liberadas = useMemo(() => {
    const livres = new Set<number>();

    for (const faturaId of new Set(parcelas.map((p) => p.faturaId))) {
      const fila = filaDeRecebimento(
        parcelas
          .filter((p) => p.faturaId === faturaId)
          .map((p) => ({
            id: p.parcelaId,
            numero: p.numero,
            vencimento: p.vencimento,
            total: p.total,
            recebido: p.recebido,
            pago: false,
          })),
      );

      for (const p of fila) {
        livres.add(p.id);

        const preenchido = valores[p.id] ?? VAZIO;
        const emAberto = p.total - p.recebido;
        const sobra = emAberto - valorDaLinha(preenchido, emAberto) - preenchido.desconto;
        // Esta ainda nao fechou: as seguintes continuam travadas.
        if (sobra > 0) break;
      }
    }

    return livres;
  }, [parcelas, valores]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA_NA_BAIXA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice(
    (paginaAtual - 1) * POR_PAGINA_NA_BAIXA,
    paginaAtual * POR_PAGINA_NA_BAIXA,
  );

  /**
   * Mexe num campo de uma linha.
   *
   * ⚠️ Mexer INCLUI a parcela. Digitar juros numa linha que ninguem marcou seria
   * um numero guardado que nao vai a lugar nenhum, e a pessoa so descobriria
   * conferindo o total no fim.
   */
  function mudar(parcelaId: number, campo: keyof EstadoDaLinha, valor: number | boolean | null) {
    aoMudarValores((atual) => ({
      ...atual,
      [parcelaId]: { ...(atual[parcelaId] ?? VAZIO), incluida: true, [campo]: valor },
    }));
  }

  if (semCliente) {
    return <Aviso>Escolha o cliente na aba de informações para ver o que ele tem em aberto.</Aviso>;
  }
  if (carregando) return <Aviso>Carregando as parcelas…</Aviso>;
  if (parcelas.length === 0) return <Aviso>Este cliente não tem parcela em aberto.</Aviso>;

  return (
    <>
      {/*
        ⚠️ A tabela vem CHEIA, e a busca filtra o que ja esta nela.

        Abrir vazia esperando um numero seria o padrao que ja foi recusado
        neste sistema: quem baixa sabe que caiu um PIX de 5.000, e raramente
        sabe de cabeca o numero da conta. Com tres contas em aberto ele ve as
        tres na hora; com quarenta, digita o numero e o resto sai da frente.

        ⚠️ O vao aqui e o de TITULO, e nao o de campo. Os filhos do grupo se
        separam por `--form-gap-campo`, que sao 3px: e o respiro de um campo para
        o seguinte numa pilha de campos irmaos. A busca e a tabela nao sao irmas
        — uma comanda a outra —, e com 3px o fio de baixo do campo encostava no
        cabecalho da tabela e os dois liam como uma linha so.
      */}
      <div style={{ marginBottom: "var(--form-gap-titulo)" }}>
        <SearchInput
          value={busca}
          sublinhado
          placeholder="Número da conta"
          onSearch={(v) => {
            setBusca(v);
            // A pagina volta ao inicio: filtrando na pagina 3, o recorte novo
            // costuma ter uma pagina so e a tela ficaria vazia.
            setPagina(1);
          }}
        />
      </div>

      {filtradas.length === 0 ? (
        <Aviso>
          Nenhuma conta em aberto com esse número. Limpe o filtro para ver as {parcelas.length}{" "}
          parcelas que este cliente ainda deve.
        </Aviso>
      ) : (
        <>
          {/*
            ⚠️ TABELA, e nao um cartao por parcela.

            Sao seis numeros por linha — em aberto, recebido, juros, multa,
            desconto — e cartao empilhado punha cada um num lugar diferente da
            tela: conferir se a soma bate exigia ler quinze blocos em vez de
            varrer uma coluna. Aqui valor fica embaixo de valor.
          */}
          <TableArea minWidth={0}>
            <TableHead>
              {/*
                ⚠️ A marca de INCLUIR abre a linha.

                Sem ela, com o valor recebido saindo de uma conta, toda parcela
                da lista entraria na baixa sozinha: abrir a tela de um cliente
                com seis parcelas em aberto significaria receber as seis.
              */}
              <Th minWidth={54}>Baixar</Th>
              <Th minWidth={150}>Conta</Th>
              <Th minWidth={96}>Vence</Th>
              <Th minWidth={96}>Em aberto</Th>
              {/*
                ⚠️ A unidade no rotulo, e nao so no campo.

                Juros e multa se falam em porcentagem no dia a dia — "dois por
                cento de multa" —, e um campo chamado so "Juros" convida a
                digitar 2 querendo dizer 2%. Aqui o que entra e o dinheiro que
                o cliente pagou a mais, e o rotulo diz isso antes do erro.
              */}
              <Th minWidth={86}>Juros (R$)</Th>
              <Th minWidth={86}>Multa (R$)</Th>
              <Th minWidth={96}>Desconto (R$)</Th>
              {/*
                ⚠️ O TOTAL da linha, e nao o que abate a divida.

                E o que o cliente pagou por esta parcela: o que abate, menos o
                perdoado, mais juros e multa. E o numero que vai bater com o
                extrato, e por isso ele se move a cada tecla nos tres campos ao
                lado — mostrando so o abatimento, digitar juros nao mudava nada
                na coluna e a pessoa procurava o dinheiro que tinha somado.

                Nunca se digita: seria o mesmo numero pedido duas vezes, e as
                duas podiam discordar.
              */}
              <Th align="right" minWidth={110}>
                Total
              </Th>
            </TableHead>

            <tbody>
              {visiveis.map((p) => (
                <LinhaDaParcela
                  key={p.parcelaId}
                  parcela={p}
                  estado={valores[p.parcelaId] ?? VAZIO}
                  liberada={liberadas.has(p.parcelaId)}
                  emParcial={parcial === p.parcelaId}
                  aoAbrirParcial={() => setParcial(p.parcelaId)}
                  aoMudar={mudar}
                  aoAlternar={() =>
                    aoMudarValores((atual) => {
                      const antes = atual[p.parcelaId] ?? VAZIO;

                      return {
                        ...atual,
                        [p.parcelaId]: antes.incluida
                          ? VAZIO
                          : /*
                              Marcar ja traz o acrescimo sugerido pela regra de
                              cobranca: quem baixa uma parcela atrasada quase
                              sempre cobra o juro, e calcula-lo de cabeca era o
                              trabalho que a tela existe para poupar.
                            */
                            { ...preencher(p, cobranca, data), incluida: true },
                      };
                    })
                  }
                />
              ))}
            </tbody>

            {/*
              ⚠️ Soma a coluna, e a soma e da BAIXA INTEIRA.

              Nao e o total da pagina nem o do que o filtro deixou a vista: o
              que vai para o banco e o que foi marcado em qualquer conta, em
              qualquer pagina. Ele existe aqui porque este e o numero que se
              confere enquanto se distribui, e ele mora na aba de informacoes:
              sem esta linha, fechar a conta obrigava a trocar de aba a cada
              valor digitado. O rotulo diz "desta baixa" justamente para nao
              ser lido como a soma das linhas visiveis.
            */}
            <tfoot>
              <tr style={{ height: "var(--h-row)", borderTop: "1px solid var(--border-strong)" }}>
                <Td colSpan={7} style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                  Total desta baixa
                </Td>
                <Td style={{ ...tdNum, fontWeight: "var(--fw-semi)" }}>
                  {formatarSemSimbolo(total)}
                </Td>
              </tr>
            </tfoot>
          </TableArea>

          {/*
            ⚠️ Pagina, e a soma do rodape continua sendo do TODO.

            Um cliente com trinta parcelas em aberto nao cabe na tela, e rolar
            trinta linhas para achar a que se quer baixar e pior do que virar
            pagina. O que ja foi digitado nas outras paginas continua valendo:
            o estado e da baixa inteira, e nao da pagina.
          */}
          {filtradas.length > POR_PAGINA_NA_BAIXA && (
            <Pagination
              page={paginaAtual}
              totalPages={totalPaginas}
              total={filtradas.length}
              pageSize={POR_PAGINA_NA_BAIXA}
              onPage={setPagina}
            />
          )}
        </>
      )}
    </>
  );
}

// ── A linha ─────────────────────────────────────────────────────────────────

function LinhaDaParcela({
  parcela: p,
  estado,
  liberada,
  emParcial,
  aoAbrirParcial,
  aoMudar,
  aoAlternar,
}: {
  parcela: ParcelaEmAberto;
  estado: EstadoDaLinha;
  liberada: boolean;
  emParcial: boolean;
  aoAbrirParcial: () => void;
  aoMudar: (id: number, campo: keyof EstadoDaLinha, valor: number | boolean | null) => void;
  aoAlternar: () => void;
}) {
  const atrasada = p.vencimento != null && p.vencimento < hoje();
  const valor = valorDaLinha(estado, p.emAberto);
  /*
   * O que o cliente pagou por esta parcela: o que abate a divida mais o
   * acrescimo. Juros e multa NAO abatem — entram por cima —, e e por isso que o
   * total e maior que a divida quitada.
   */
  const totalDaLinha = estado.incluida ? valor + estado.juros + estado.multa : 0;
  const sobra = estado.incluida ? Math.max(0, p.emAberto - valor - estado.desconto) : 0;

  return (
    <Tr
      /*
        A parcela que ainda nao chegou na fila aparece apagada, e nao escondida:
        some, e ninguem entende por que a conta tem tres parcelas e a tela
        mostra uma.
      */
      dimmed={!liberada}
      /*
        ⚠️ Duas cores, duas coisas diferentes.

        Vencida e vermelho claro: e o unico estado que pede acao hoje, e a data
        sozinha em vermelho se perde no meio da tabela. Travada e o cinza
        esverdiado das linhas que nao se editam, o mesmo da parcela paga no
        parcelamento — ela aparece para explicar a conta, e nao para ser mexida.

        Travada ganha do vermelho: nao adianta chamar para uma acao que a fila
        ainda nao liberou.
      */
      style={
        !liberada
          ? { background: "var(--surface-hover)" }
          : atrasada
            ? { background: "var(--danger-bg)" }
            : undefined
      }
    >
      <Td>
        <MarcaDeUso
          marcado={estado.incluida}
          desabilitado={!liberada}
          rotulo={
            !liberada
              ? "A parcela anterior desta conta ainda está em aberto"
              : estado.incluida
                ? "Tirar esta parcela da baixa"
                : "Recebi esta parcela"
          }
          onClick={aoAlternar}
        />
      </Td>

      <Td>
        {p.faturaNumero}
        <div style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
          parcela {p.numero}
          {p.totalParcelas > 0 && ` de ${p.totalParcelas}`}
        </div>
      </Td>

      <Td
        style={
          atrasada ? { color: "var(--danger-text)", fontWeight: "var(--fw-medium)" } : undefined
        }
      >
        {p.vencimento ? paraFormatoBR(p.vencimento as DataISO) : "—"}
      </Td>

      {/*
        ⚠️ Clicar aqui e dizer "destes X, recebi so uma parte".

        E o caso raro — quase todo mundo paga a parcela —, e por isso e um clique
        e nao um campo aberto. Ele mora nesta coluna porque a pergunta e sobre a
        DIVIDA: quanto dela entrou. O total do fim continua sendo conta, nunca
        digitacao.
      */}
      <Td>
        {emParcial ? (
          <CampoNumerico
            valor={valor}
            escala={100}
            style={inputDeCelula}
            aoMudar={(v) =>
              aoMudar(
                p.parcelaId,
                "recebido",
                Math.min(Math.max(0, v), p.emAberto - estado.desconto),
              )
            }
          />
        ) : (
          <button
            type="button"
            disabled={!liberada}
            title={
              liberada
                ? "Clique para receber só uma parte: o resto continua devendo"
                : "A parcela anterior desta conta ainda está em aberto"
            }
            onClick={aoAbrirParcial}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              fontVariantNumeric: "tabular-nums",
              color: "inherit",
              textDecoration: liberada ? "underline dotted" : undefined,
              textUnderlineOffset: 3,
              cursor: liberada ? "pointer" : "default",
            }}
          >
            {formatarSemSimbolo(p.emAberto as Centavos)}
          </button>
        )}

        {p.recebido > 0 && (
          <div style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            já entrou {formatarSemSimbolo(p.recebido as Centavos)}
          </div>
        )}
      </Td>

      {/*
        ⚠️ Juros e multa NAO abatem a divida: entram no caixa por cima do valor.
        Por isso ficam antes dele na leitura, e nunca somados a ele.
      */}
      <Td>
        <CampoNumerico
          valor={estado.juros}
          escala={100}
          style={inputDeCelula}
          aoMudar={(v) => aoMudar(p.parcelaId, "juros", v)}
        />
      </Td>

      <Td>
        <CampoNumerico
          valor={estado.multa}
          escala={100}
          style={inputDeCelula}
          aoMudar={(v) => aoMudar(p.parcelaId, "multa", v)}
        />
      </Td>

      {/*
        ⚠️ O desconto e a resposta a uma pergunta que o sistema nao pode responder
        sozinho: recebi 500 de 510, os 10 continuam devidos ou eu abri mao?
        Digitando aqui, a pessoa diz que abriu mao — e o valor ao lado se ajusta.
      */}
      <Td>
        <CampoNumerico
          valor={estado.desconto}
          escala={100}
          style={inputDeCelula}
          aoMudar={(v) => aoMudar(p.parcelaId, "desconto", Math.min(Math.max(0, v), p.emAberto))}
        />
      </Td>

      <Td style={{ ...tdNum, fontWeight: "var(--fw-medium)" }}>
        {formatarSemSimbolo(totalDaLinha as Centavos)}

        {/* O que sobra depois desta baixa. So aparece quando sobra: uma linha
            "ainda devendo 0,00" seria ruido. */}
        {sobra > 0 && (
          <div
            style={{
              marginTop: 1,
              fontSize: "var(--text-xs)",
              fontWeight: 400,
              color: "var(--danger-text)",
            }}
          >
            ainda devendo {formatarSemSimbolo(sobra as Centavos)}
          </div>
        )}
      </Td>
    </Tr>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}
