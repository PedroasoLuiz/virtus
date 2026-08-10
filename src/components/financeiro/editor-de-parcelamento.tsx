"use client";

import { useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  BotaoDeAcao,
  CampoBloqueado,
  CampoNumerico,
  Field,
  Formulario,
  GrupoDeCampos,
  AcoesDaLinha,
  inputDeCelula,
  Pagination,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import type { OQuePodeNaConta } from "@/shared/domain/parcelas";

/**
 * Redesenha o cronograma de uma conta, dos DOIS lados do caixa.
 *
 * ⚠️ Um componente so para receber e pagar. A pergunta e a mesma — o total esta
 * fixo, e o que muda e em quantas vezes e quando —, e a regra de quem pode mexer
 * vem de `oQuePodeNaConta`, que ja era compartilhada. Escrito duas vezes, a
 * divisao de centavos e a numeracao divergiriam no primeiro ajuste feito so num
 * dos lados.
 *
 * O que muda entre os dois lados e texto e a URL do PUT.
 */

export type ParcelaDoEditor = {
  id: number;
  numero: number;
  vencimento: string | null;
  total: number;
  pago: boolean;
};


type LinhaDoParcelamento = {
  /** `null` numa parcela que ainda nao existe no banco. */
  id: number | null;
  vencimento: string;
  valor: number;
  /** Paga ou com documento emitido: aparece, mas nao se mexe. */
  travada: boolean;
};

/**
 * Quantas parcelas cabem numa pagina do editor.
 *
 * Doze porque e o parcelamento mais comum que existe: um ano em doze vezes cabe
 * inteiro na primeira pagina, e quem parcela em 3, 6 ou 10 nunca vira pagina.
 */
const POR_PAGINA_NO_PARCELAMENTO = 12;

/**
 * O mesmo dia no mes seguinte, sem estourar o fim do mes.
 *
 * ⚠️ Sobre `Date.UTC`, e nao sobre o fuso local: `new Date("2026-01-31")` no
 * horario de Brasilia volta um dia, e a parcela nasceria em 30/01.
 */
function somarUmMes(iso: string): string {
  if (!iso) return "";

  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const proximo = new Date(Date.UTC(ano, mes, 1));
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();

  proximo.setUTCDate(Math.min(dia, ultimoDia));
  return proximo.toISOString().slice(0, 10);
}

/**
 * O rodape que soma o cronograma.
 *
 * ⚠️ SEM `padding` aqui. O recuo das celulas mora no CSS, e estilo em linha vence
 * seletor: cravando um valor proprio, a soma saia alguns pixels fora da coluna
 * que ela soma — que e a unica coisa que ela precisa fazer certo.
 */
const somaDaTabela: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--fw-semi)",
  fontVariantNumeric: "tabular-nums",
};

/** "33,33%" — a fatia que a parcela representa do total. */
function porcentagem(valor: number, total: number): string {
  if (total <= 0) return "—";
  return `${((valor / total) * 100).toFixed(2).replace(".", ",")}%`;
}

/** "12/03/26": ano em dois digitos, porque a coluna e estreita. */
function curto(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

/** O visto de parcela ja quitada. Cheio: ele fecha a pergunta. */
function CheckPreenchido({ titulo, cor }: { titulo: string; cor?: string }) {
  return (
    <span
      title={titulo}
      style={{ display: "inline-grid", placeItems: "center", color: cor ?? "var(--credito)" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path
          d="M8 12.4l2.6 2.6L16 9.6"
          fill="none"
          stroke="var(--surface)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function EditorDeParcelamento({
  url,
  numero,
  contraparte,
  rotuloContraparte,
  tituloDaConta,
  total,
  parcelas,
  pode,
  onClose,
  aoSalvar,
}: {
  /** Para onde o PUT vai. E o unico ponto que sabe de que lado do caixa isto e. */
  url: string;
  numero: string;
  contraparte: string | null;
  /** "Cliente" ou "Fornecedor". */
  rotuloContraparte: string;
  /** "Conta a receber" ou "Conta a pagar". */
  tituloDaConta: string;
  total: number;
  parcelas: ParcelaDoEditor[];
  pode: OQuePodeNaConta;
  onClose: () => void;
  aoSalvar: () => void;
}) {
  const abertas = parcelas.filter((p) => !p.pago);
  const pagas = parcelas.filter((p) => p.pago);

  const [pagina, setPagina] = useState(1);
  const [linhas, setLinhas] = useState<LinhaDoParcelamento[]>(() =>
    abertas.map((p) => ({
      id: p.id,
      vencimento: p.vencimento ?? "",
      valor: p.total,
      travada: !pode.porParcela[p.id]?.pode,
    })),
  );

  const somaPagas = pagas.reduce((s, p) => s + p.total, 0);
  const somaAbertas = linhas.reduce((s, l) => s + l.valor, 0);
  const diferenca = total - somaPagas - somaAbertas;

  /*
   * Os numeros que estas linhas terao depois de salvar.
   *
   * ⚠️ Repete a numeracao do dominio: paga nao troca de numero — o recibo que o
   * cliente tem na mao diz "parcela 2" — e as em aberto pegam o que sobra, na
   * ordem em que vencem.
   */
  const numeros = (() => {
    const usados = new Set(pagas.map((p) => p.numero));
    let proximo = 1;
    const livre = () => {
      while (usados.has(proximo)) proximo++;
      return proximo++;
    };

    const ordem = linhas
      .map((l, i) => ({ i, venc: l.vencimento }))
      .sort((a, b) => (a.venc === b.venc ? a.i - b.i : a.venc < b.venc ? -1 : 1));

    const saida: number[] = [];
    for (const { i } of ordem) saida[i] = livre();
    return saida;
  })();

  /*
   * ⚠️ A tabela pagina; a CONTA nao.
   *
   * Um financiamento de 160 parcelas nao cabe na tela, e rolar cento e sessenta
   * linhas para achar a que se quer mudar e pior do que virar pagina. O rodape
   * continua somando o cronograma INTEIRO — paginar a soma seria mostrar um
   * fechamento que nao fecha coisa nenhuma.
   */
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA_NO_PARCELAMENTO));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const primeira = (paginaAtual - 1) * POR_PAGINA_NO_PARCELAMENTO;
  const visiveis = linhas.slice(primeira, primeira + POR_PAGINA_NO_PARCELAMENTO);

  const semData = linhas.some((l) => !l.vencimento);
  const semValor = linhas.some((l) => l.valor <= 0);

  function mudar(indice: number, mudanca: Partial<LinhaDoParcelamento>) {
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, ...mudanca } : l)));
  }

  /**
   * O mais parte a ULTIMA parcela em duas.
   *
   * ⚠️ Assim a soma continua batendo depois de acrescentar. Nascendo com valor
   * zero, toda parcela nova deixaria a tabela em erro e obrigaria a digitar antes
   * de qualquer outra coisa.
   */
  function acrescentar() {
    // A parcela nova nasce no fim; sem isto, quem esta na pagina 1 clica no mais
    // e nao ve nada acontecer.
    setPagina(Math.max(1, Math.ceil((linhas.length + 1) / POR_PAGINA_NO_PARCELAMENTO)));

    setLinhas((atual) => {
      const ultima = atual.at(-1);
      if (!ultima) return atual;

      const fica = Math.ceil(ultima.valor / 2);
      const vai = ultima.valor - fica;

      return [
        ...atual.slice(0, -1),
        { ...ultima, valor: fica },
        {
          id: null,
          // Um mes depois da ultima: e o intervalo que todo parcelamento usa, e
          // quem quiser outro dia muda ali mesmo.
          vencimento: somarUmMes(ultima.vencimento),
          valor: vai,
          travada: false,
        },
      ];
    });
  }

  /** Tirar uma parcela devolve o valor dela para a ultima que sobrar. */
  function remover(indice: number) {
    setLinhas((atual) => {
      if (atual.length <= 1) return atual;

      const fora = atual[indice];
      const restantes = atual.filter((_, i) => i !== indice);
      const ultima = restantes.at(-1)!;

      return restantes.map((l) => (l === ultima ? { ...l, valor: l.valor + fora.valor } : l));
    });
  }

  return (
    <FormDrawer
      aberto
      nivel={2}
      titulo="Parcelamento"
      onClose={onClose}
      aoSalvar={aoSalvar}
      url={url}
      metodo="PUT"
      podeSalvar={diferenca === 0 && !semData && !semValor}
      valores={() => ({
        parcelas: linhas.map((l) => ({ id: l.id, vencimento: l.vencimento, valor: l.valor })),
      })}
    >
      <Formulario>
        {/*
          ⚠️ De QUEM e QUAL conta, antes da tabela.

          O drawer abre por cima de outro e mexe em dinheiro: quem comeca a
          lancar, atende o telefone e volta cinco minutos depois nao tem como
          saber em que conta esta digitando. O título do drawer diz "Parcelamento",
          que serve para qualquer uma.
        */}
        <GrupoDeCampos
          primeiro
          titulo={tituloDaConta}
          legenda="É este acordo que está sendo redividido. O total não muda: o que muda é em quantas vezes e quando."
        >
          <Field label="Código">
            <CampoBloqueado valor={numero} />
          </Field>

          <Field label={rotuloContraparte}>
            <CampoBloqueado valor={contraparte ?? "—"} />
          </Field>

          <Field label="Total">
            <CampoBloqueado valor={formatarSemSimbolo(total as Centavos)} />
          </Field>
        </GrupoDeCampos>

        <GrupoDeCampos
          titulo="Como o pagamento se divide"
          legenda="Digite o valor ou a porcentagem de cada parcela; um preenche o outro. A soma tem de fechar com o total da conta para salvar."
          onIncluir={acrescentar}
          rotuloIncluir="Mais uma parcela"
        >
          <TableArea minWidth={0}>
            <TableHead>
              <Th minWidth={44}>#</Th>
              <Th minWidth={130}>Vence</Th>
              <Th minWidth={110}>Valor</Th>
              <Th minWidth={80}>%</Th>
              {/*
                ⚠️ "Paga" tem titulo, e a coluna de acoes nao.

                A marca de paga e DADO: ela responde uma pergunta sobre a parcela,
                e coluna de dado se nomeia. O botao de remover e ferramenta, e
                ferramenta nao precisa de rotulo — o resto do sistema tambem deixa
                essa coluna sem titulo.
              */}
              <Th minWidth={60}>Paga</Th>
              <Th> </Th>
            </TableHead>

            <tbody>
              {/*
                ⚠️ As pagas vem primeiro e sem edicao. Elas contam para o total:
                escondendo-as, a soma da tabela nunca bateria com a conta e a tela
                pareceria estar errando.
              */}
              {pagas.map((p) => (
                /*
                  ⚠️ Fundo um tom mais escuro, do mesmo cinza do hover.

                  A linha paga nao se edita, e o texto apagado sozinho nao dizia
                  isso: parecia dado sem importancia, e nao campo travado. Com o
                  fundo, ela le como uma faixa fechada no alto da tabela, e os
                  campos editaveis das outras linhas ganham contraste.
                */
                <Tr key={p.id} dimmed style={{ background: "var(--surface-hover)" }}>
                  <Td>{p.numero}</Td>
                  <Td>{p.vencimento ? curto(p.vencimento) : "—"}</Td>
                  <Td>{formatarSemSimbolo(p.total as Centavos)}</Td>
                  <Td>{porcentagem(p.total, total)}</Td>
                  <Td>
                    <CheckPreenchido titulo="Parcela já recebida. Ela não se mexe." />
                  </Td>
                  <Td />
                </Tr>
              ))}

              {/*
                ⚠️ O indice usado nas edicoes e o ABSOLUTO, e nao o da pagina: ele
                aponta para a linha dentro do cronograma inteiro. Com o indice da
                fatia, digitar na pagina 2 mexeria na parcela da pagina 1.
              */}
              {visiveis.map((l, indiceNaPagina) => {
                const i = primeira + indiceNaPagina;

                return (
                <Tr key={l.id ?? `nova-${i}`}>
                  {/*
                    ⚠️ O numero e o que a parcela VAI ter depois de salvar, e nao a
                    posicao na tela.

                    Quem numera e a ordem de vencimento, e a mesma regra roda aqui:
                    mudando a data de uma parcela para depois da seguinte, os
                    numeros se trocam na hora. Mostrando a posicao do array, a
                    tabela diria "3" para a parcela que o banco vai gravar como 2.
                  */}
                  <Td>{numeros[i]}</Td>

                  <Td>
                    <input
                      type="date"
                      disabled={l.travada}
                      value={l.vencimento.slice(0, 10)}
                      onChange={(e) => mudar(i, { vencimento: e.target.value })}
                      style={inputDeCelula}
                    />
                  </Td>

                  <Td>
                    {l.travada ? (
                      formatarSemSimbolo(l.valor as Centavos)
                    ) : (
                      <CampoNumerico
                        valor={l.valor}
                        aoMudar={(v) => mudar(i, { valor: v })}
                        escala={100}
                        /*
                          ⚠️ Parcela de zero nao existe: ela nao vence, nao cobra
                          nada e nao fecha. O campo acusa em vermelho, e o salvar
                          fica travado enquanto houver uma — antes, a soma podia
                          ate fechar com uma linha zerada no meio, e o botao
                          desligado nao dizia por que.
                        */
                        style={
                          l.valor <= 0
                            ? { ...inputDeCelula, color: "var(--danger-text)" }
                            : inputDeCelula
                        }
                      />
                    )}
                  </Td>

                  <Td>
                    {l.travada ? (
                      porcentagem(l.valor, total)
                    ) : (
                      <CampoNumerico
                        valor={Math.round((l.valor / total) * 10000)}
                        /*
                         * ⚠️ A porcentagem vira VALOR na hora, e nao fica guardada
                         * ao lado dele. Guardadas as duas, elas divergem no
                         * arredondamento e a tabela passa a mostrar 33,33% de uma
                         * parcela que vale outra coisa.
                         */
                        aoMudar={(pct) =>
                          mudar(i, { valor: Math.round((total * pct) / 10000) })
                        }
                        escala={100}
                        sufixo="%"
                        style={inputDeCelula}
                      />
                    )}
                  </Td>

                  {/*
                    Em aberto a celula fica vazia: um X ou um circulo vazado
                    acusariam uma pendencia, e parcela que ainda nem venceu nao
                    esta devendo nada.
                  */}
                  <Td />

                  <Td>
                    <AcoesDaLinha>
                      {!l.travada && linhas.length > 1 && (
                        <BotaoDeAcao rotulo="Tirar esta parcela" perigo onClick={() => remover(i)}>
                          <path d="M3.5 8h9" />
                        </BotaoDeAcao>
                      )}
                    </AcoesDaLinha>
                  </Td>
                </Tr>
                );
              })}
            </tbody>

            {/*
              ⚠️ O fechamento e RODAPE DA TABELA, e nao uma faixa embaixo dela.

              A soma tem de cair na mesma coluna dos valores que ela soma: fora da
              tabela, ela era um numero solto atravessado na linha, e conferir
              exigia o olho ir e voltar. Aqui e a conta de somar que a pessoa faria
              de qualquer jeito, escrita onde ela olharia.
            */}
            <tfoot>
              {/*
                ⚠️ A soma e a porcentagem tem o MESMO peso e a mesma cor: sao a
                mesma conta dita de dois jeitos, e uma delas em cinza pareceria
                nota de rodape da outra.

                ⚠️ Corpo menor que o das linhas. Ela e conferencia, e nao mais um
                dado da tabela: em negrito e no mesmo tamanho, competia com os
                valores que ela existe para somar.
              */}
              <tr style={{ borderTop: "1px solid var(--border-strong)" }}>
                <td
                  colSpan={2}
                  style={{
                    height: 32,
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Soma das parcelas
                </td>
                <td style={somaDaTabela}>
                  {formatarSemSimbolo((somaPagas + somaAbertas) as Centavos)}
                </td>
                <td style={somaDaTabela}>
                  {porcentagem(somaPagas + somaAbertas, total)}
                </td>
                <td colSpan={2} />
              </tr>

              {/* A diferenca so existe enquanto ha diferenca. Uma linha "faltam
                  0,00" seria ruido permanente pedindo para ser ignorada. */}
              {/*
                ⚠️ O salvar travado precisa dizer POR QUE. A soma pode fechar com
                uma linha zerada no meio — 5.000 + 0 num total de 5.000 —, e ai o
                botao desligado seria um mistério.
              */}
              {(semValor || semData) && (
                <tr style={{ color: "var(--danger-text)" }}>
                  <td colSpan={6} style={{ height: 28, fontSize: "var(--text-xs)" }}>
                    {semValor
                      ? "Toda parcela precisa de um valor maior que zero."
                      : "Toda parcela precisa de um vencimento."}
                  </td>
                </tr>
              )}

              {diferenca !== 0 && (
                <tr style={{ color: "var(--danger-text)" }}>
                  <td colSpan={2} style={{ height: 28, fontSize: "var(--text-xs)" }}>
                    {diferenca > 0 ? "Falta distribuir" : "Passou do total em"}
                  </td>
                  <td style={somaDaTabela}>
                    {formatarSemSimbolo(Math.abs(diferenca) as Centavos)}
                  </td>
                  <td colSpan={3} />
                </tr>
              )}
            </tfoot>
          </TableArea>

          {linhas.length > POR_PAGINA_NO_PARCELAMENTO && (
            <Pagination
              page={paginaAtual}
              totalPages={totalPaginas}
              total={linhas.length}
              pageSize={POR_PAGINA_NO_PARCELAMENTO}
              onPage={setPagina}
            />
          )}
        </GrupoDeCampos>
      </Formulario>
    </FormDrawer>
  );
}

