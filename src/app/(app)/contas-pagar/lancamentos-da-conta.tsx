"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BotaoDeAcao,
  CampoNumerico,
  EmptyRow,
  GrupoDeCampos,
  DicaFlutuante,
  IconeInfo,
  inputDeCelula,
  SeletorBuscavel,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";

/**
 * Os lançamentos da conta: leitura, e edição enquanto nada foi pago.
 *
 * ⚠️ Um desenho só de tabela, e não dois. Leitura e edição usam as MESMAS
 * colunas na mesma ordem: trocando o layout ao entrar em edição, o olho perde a
 * linha que estava lendo e precisa achar tudo de novo.
 */

export type LancamentoDaConta = {
  id: number;
  descricao: string;
  valor: number;
  centroCustoId: number | null;
  centroCustoCodigo: string | null;
  centroCustoNome: string | null;
};

type Centro = {
  id: number;
  codigo: string | null;
  descricao: string;
  tipo: string;
  ativo: boolean;
};

/** "012 · Marketing digital" quando ha codigo; so o nome quando nao ha. */
function comCodigo(codigo: string | null, descricao: string): string {
  return codigo ? `${codigo} · ${descricao}` : descricao;
}

/** Enquanto se edita, centro é TEXTO: "" é o estado de "ainda não escolhi". */
type LinhaEditavel = {
  descricao: string;
  valor: number;
  centroCustoId: string;
  /**
   * O nome vem junto porque o seletor precisa mostrar a escolha, e ele nao
   * carrega catalogo: quem escolheu ja sabe o nome, e guarda-lo aqui evita uma
   * consulta so para reexibir o que acabou de ser clicado.
   */
  centroCustoNome: string | null;
};

const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

/** O peso, embaixo do valor: apoio, e nao dado principal. */
const PESO: React.CSSProperties = {
  marginTop: 1,
  fontSize: "var(--text-xs)",
  color: "var(--text-tertiary)",
  fontVariantNumeric: "tabular-nums",
};

export function LancamentosDaConta<T>({
  contaId,
  lancamentos,
  total,
  travado,
  motivoTravado,
  aoMudar,
  aoMudarTotal,
}: {
  contaId: number;
  lancamentos: LancamentoDaConta[];
  total: number;
  travado: boolean;
  motivoTravado: string;
  /** Recebe a conta inteira que o servidor devolveu depois de salvar. */
  aoMudar: (conta: T) => void;
  /**
   * O total enquanto se digita, para a ficha mostrar de quanto para quanto.
   * Nulo ao sair da edicao.
   */
  aoMudarTotal: (total: number | null) => void;
}) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaEditavel[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [salvando, setSalvando] = useState(false);

  // A lista de centros só é buscada ao ENTRAR em edição: quem só abriu a conta
  // para olhar não paga por uma consulta que não vai usar.
  useEffect(() => {
    if (!editando) return;

    const controle = new AbortController();

    fetch("/api/v1/centro-custo", { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        setCentros((corpo.data ?? []) as Centro[]);
      })
      .catch(() => {
        // Silencioso: sem a lista a linha pode ficar sem centro, que é permitido.
      });

    return () => controle.abort();
  }, [editando]);

  function comecar() {
    setLinhas(
      lancamentos.map((l) => ({
        descricao: l.descricao,
        valor: l.valor,
        centroCustoId: l.centroCustoId ? String(l.centroCustoId) : "",
        centroCustoNome: comCodigo(l.centroCustoCodigo, l.centroCustoNome ?? ""),
      })),
    );
    setEditando(true);
  }

  function mudar(indice: number, mudanca: Partial<LinhaEditavel>) {
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, ...mudanca } : l)));
  }

  const novoTotal = linhas.reduce((soma, l) => soma + l.valor, 0);

  /*
   * ⚠️ O aviso sobe por EFEITO, e nao dentro do `onChange` de cada campo.
   *
   * Chamando o pai durante o evento, o React reclama de atualizar um componente
   * enquanto outro renderiza. Aqui o valor ja esta calculado e o efeito so o
   * entrega depois que este render terminou.
   */
  useEffect(() => {
    aoMudarTotal(editando ? novoTotal : null);
  }, [editando, novoTotal, aoMudarTotal]);

  const motivoSalvar =
    linhas.length === 0
      ? "A conta precisa de ao menos um lançamento"
      : linhas.some((l) => l.descricao.trim().length === 0)
        ? "Descreva cada lançamento"
        : linhas.some((l) => l.valor <= 0)
          ? "Cada lançamento precisa de um valor"
          : undefined;

  async function salvar() {
    setSalvando(true);

    const r = await fetch(`/api/v1/contas-pagar/${contaId}/lancamentos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lancamentos: linhas.map((l) => ({
          descricao: l.descricao.trim(),
          valor: l.valor,
          centroCustoId: l.centroCustoId ? Number(l.centroCustoId) : null,
        })),
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível salvar");
      return;
    }

    /*
     * A resposta traz a CONTA inteira, e a tela adota o que veio.
     *
     * Montar o novo estado aqui seria uma segunda versão da verdade: as parcelas
     * mudaram de valor no servidor, e reproduzir essa redistribuição na tela
     * abriria a chance de ela divergir do que foi gravado.
     */
    aoMudar(dados.data as T);
    setEditando(false);
    avisar("sucesso", "Lançamentos salvos", "As parcelas em aberto foram ajustadas ao novo total.");
  }

  /*
   * ⚠️ So os centros de DESPESA, e so os ativos.
   *
   * Centro tem tipo, e o tipo diz de que lado do resultado a linha cai. Uma
   * despesa apontando para centro de receita entra na DRE somando onde deveria
   * subtrair. O servidor tambem recusa; aqui a lista nem chega a oferecer.
   */
  const buscarCentros = useCallback(
    async (termo: string) => {
      const alvo = termo.trim().toLowerCase();

      return centros
        .filter((c) => c.tipo === "DESPESA" && c.ativo)
        // Busca pelo codigo TAMBEM: quem sabe o codigo digita o codigo, e quem
        // nao sabe digita o nome. Os dois chegam no mesmo lugar.
        .filter(
          (c) =>
            !alvo ||
            c.descricao.toLowerCase().includes(alvo) ||
            (c.codigo ?? "").toLowerCase().includes(alvo),
        )
        .slice(0, 15)
        .map((c) => ({ id: c.id, nome: comCodigo(c.codigo, c.descricao) }));
    },
    [centros],
  );

  const totalExibido = editando ? novoTotal : total;

  return (
    <GrupoDeCampos
      primeiro
      titulo="O que está sendo pago"
      legenda="Cada linha tem o próprio centro de custo. É a soma delas que forma o total da conta, e é por elas que a DRE separa o custo."
      /*
        ⚠️ O `+` só existe em edição. Fora dela, ele acrescentaria uma linha num
        conjunto que ninguém está mexendo, e o gesto ficaria pela metade sem nada
        para salvar.
      */
      onIncluir={
        editando
          ? () =>
              setLinhas((l) => [
                ...l,
                { descricao: "", valor: 0, centroCustoId: "", centroCustoNome: null },
              ])
          : undefined
      }
    >
      <TableArea minWidth={0}>
        <TableHead>
          {/*
            ⚠️ O centro ABRE a linha, e nao a descricao. Quem varre os
            lancamentos de uma conta esta conferindo classificacao — "isto caiu
            no centro certo?" —, e a coluna que responde essa pergunta tem que
            ser a primeira. A descricao explica a linha, e explicacao vem depois
            da identificacao.

            "C. de Custo" abreviado porque a coluna e estreita: o codigo cabe em
            tres digitos, e o titulo por extenso ficava mais largo que o dado.
          */}
          <Th minWidth={92}>C. de Custo</Th>
          {/*
            ⚠️ Descricao com largura MINIMA propria. Sem ela, a coluna encolhia
            ate o texto do cabecalho e o campo de digitacao ficava com espaco
            para tres palavras — justamente na coluna em que se escreve mais.
          */}
          <Th minWidth={220}>Descrição</Th>
          {/*
            ⚠️ O peso NAO tem coluna: ele mora embaixo do valor, em cinza e
            menor. Ele e leitura de apoio — quem varre a tabela procura valor, e
            o peso responde a pergunta seguinte. Como coluna, gastava largura
            que a descricao e o centro precisavam mais.
          */}
          <Th minWidth={110}>Valor</Th>
          {/*
            ⚠️ A coluna de acao existe nos DOIS modos, e nao so na edicao.
            Aparecendo de repente ao entrar em edicao, ela empurraria as outras
            quatro para a esquerda e a tabela inteira dancaria sob o cursor.
          */}
          <Th minWidth={44}> </Th>
        </TableHead>

        <tbody>
          {!editando && lancamentos.length === 0 && (
            <EmptyRow colSpan={4} message="Esta conta não tem lançamentos detalhados." />
          )}

          {!editando &&
            lancamentos.map((l, i) => (
              <Tr key={l.id} delay={i * 12}>
                <Td>
                  {/*
                    ⚠️ A descricao inteira vive no CARTAO, e nao na celula.
                    Centro de custo tem nome longo e a coluna e estreita: ou ela
                    corta o texto, ou rouba largura de descricao e valor. O "i"
                    entrega o nome completo sem gastar espaco.
                  */}
                  {l.centroCustoNome ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {/*
                        ⚠️ O CODIGO na celula, e o nome inteiro na dica. Codigo
                        e curto e cabe sempre; nome de centro e longo e ou corta,
                        ou rouba a largura que descricao e valor precisam mais.
                      */}
                      <span style={NUM}>{l.centroCustoCodigo ?? "—"}</span>
                      <DicaFlutuante texto={l.centroCustoNome}>
                        <IconeInfo />
                      </DicaFlutuante>
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-tertiary)" }}>Sem centro</span>
                  )}
                </Td>

                <Td>{l.descricao || "—"}</Td>

                <Td style={NUM}>
                  {formatarSemSimbolo(l.valor as Centavos)}
                  {totalExibido > 0 && (
                    <div style={PESO}>{Math.round((l.valor / totalExibido) * 100)}%</div>
                  )}
                </Td>

                {/*
                  ⚠️ O lapis mora na LINHA, e nao num botao embaixo da tabela.
                  Editar e acao sobre o dado, e no sistema inteiro acao sobre o
                  dado fica na ultima coluna. Embaixo, ele se perdia entre a
                  tabela e o proximo bloco.

                  Ele entra no modo de edicao da tabela inteira: os lancamentos
                  sao uma lista so, e o total depende de todos.
                */}
                <Td>
                  <span title={travado ? motivoTravado : undefined}>
                    <BotaoDeAcao
                      rotulo="Editar os lançamentos"
                      desabilitado={travado}
                      onClick={comecar}
                    >
                      <path d="M11.2 2.6l2.2 2.2M9.9 3.9l-6.4 6.4-.7 2.9 2.9-.7 6.4-6.4z" />
                    </BotaoDeAcao>
                  </span>
                </Td>
              </Tr>
            ))}

          {editando &&
            linhas.map((l, i) => (
              <Tr key={i}>
                <Td>
                  {/*
                    ⚠️ Campo que BUSCA, e nao um `select`. Sao 72 centros de
                    despesa: numa lista nativa, achar "Marketing digital" exige
                    rolar setenta linhas, e o teclado so salta pela primeira
                    letra. Digitando pelo codigo ou pelo nome, chega-se em duas
                    teclas.
                  */}
                  <SeletorBuscavel
                    celula
                    valor={l.centroCustoId ? Number(l.centroCustoId) : null}
                    rotulo={l.centroCustoNome}
                    placeholder="Sem centro"
                    buscar={buscarCentros}
                    aoEscolher={(c) =>
                      mudar(i, {
                        centroCustoId: c ? String(c.id) : "",
                        centroCustoNome: c?.nome ?? null,
                      })
                    }
                  />
                </Td>

                <Td>
                  <input
                    value={l.descricao}
                    onChange={(e) => mudar(i, { descricao: e.target.value })}
                    maxLength={255}
                    placeholder="O que é esta linha"
                    style={inputDeCelula}
                  />
                </Td>

                <Td>
                  {/*
                    ⚠️ `CampoNumerico` tem estilo proprio e nao herda o da
                    celula: sem passar `style`, ele era o unico campo editavel da
                    tabela sem a linha pontilhada, e parecia texto.
                  */}
                  <CampoNumerico
                    valor={l.valor}
                    escala={100}
                    aoMudar={(v) => mudar(i, { valor: v })}
                    style={inputDeCelula}
                  />
                  {totalExibido > 0 && (
                    <div style={PESO}>{Math.round((l.valor / totalExibido) * 100)}%</div>
                  )}
                </Td>

                <Td>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {/*
                      ⚠️ Salvar e cancelar so na PRIMEIRA linha. Eles sao da
                      tabela inteira — o total depende de todas as linhas —, e
                      repetidos em cada uma pareceriam salvar aquela linha
                      sozinha, que e o oposto do que fazem.
                    */}
                    {i === 0 && (
                      <>
                        <span title={motivoSalvar ?? "Salvar os lançamentos"}>
                          <BotaoDeAcao
                            rotulo="Salvar os lançamentos"
                            confirmar
                            desabilitado={salvando || !!motivoSalvar}
                            onClick={salvar}
                          >
                            <path d="M3.2 8.4l3.1 3.1 6.5-6.6" />
                          </BotaoDeAcao>
                        </span>

                        <BotaoDeAcao rotulo="Cancelar a edição" onClick={() => setEditando(false)}>
                          <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />
                        </BotaoDeAcao>
                      </>
                    )}

                    {/*
                      ⚠️ A última linha não se apaga: a conta precisa de ao menos
                      um lançamento, e uma tabela vazia só poderia ser desfeita
                      pelo `+`. Travada com o motivo à vista.
                    */}
                    <span
                      title={
                        linhas.length === 1 ? "A conta precisa de ao menos um lançamento" : undefined
                      }
                    >
                      <BotaoDeAcao
                        rotulo="Tirar esta linha"
                        desabilitado={linhas.length === 1}
                        onClick={() => setLinhas((atual) => atual.filter((_, n) => n !== i))}
                      >
                        <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
                      </BotaoDeAcao>
                    </span>
                  </span>
                </Td>
              </Tr>
            ))}
        </tbody>
      </TableArea>

    </GrupoDeCampos>
  );
}
