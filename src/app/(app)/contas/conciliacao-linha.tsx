"use client";

import {
  Badge,
  Button,
  MarcaDeUso,
  SeletorBuscavel,
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR } from "@/shared/utils/datas";
import type {
  LinhaDoExtrato,
  PainelDeConciliacao,
} from "@/modules/conciliacao/conciliacao.types";

/**
 * Uma linha do banco e o lancamento que ela e — ou a busca por ele.
 *
 * ⚠️ Arquivo proprio porque o drawer passou de oitocentas linhas. Aqui mora o
 * bloco de UMA linha e as pecas que so ele usa; la ficam o estado, as chamadas e
 * o cabecalho. O corte segue o que ja foi feito no drawer da baixa.
 */
export function LinhaDaConciliacao({
  linha: l,
  painel,
  pilha,
  marcado,
  trocando,
  ocupado,
  aoMarcar,
  aoTrocar,
  aoLigar,
  aoDesfazer,
  procurar,
  aoCadastrar,
}: {
  linha: LinhaDoExtrato;
  painel: PainelDeConciliacao | null;
  pilha: "aConciliar" | "conciliados";
  marcado: boolean;
  /** Esta linha teve a sugestao recusada e espera outra escolha. */
  trocando: boolean;
  ocupado: boolean;
  aoMarcar: () => void;
  aoTrocar: (trocando: boolean) => void;
  aoLigar: (pagamentoId: number) => void;
  aoDesfazer: () => void;
  procurar: (
    valorDaLinha: number,
    termo: string,
  ) => Promise<{ id: number; nome: string }[]>;
  /**
   * Cadastrar a conta a pagar que esta linha cobra.
   *
   * ⚠️ Só vem preenchido quando não há nada no sistema com aquele valor. Nas
   * outras linhas existe o que procurar, e um botão de cadastro ao lado
   * convidaria a criar a segunda cópia de um lançamento que já está na lista.
   */
  aoCadastrar?: () => void;
}) {
  const sugestao = painel?.sugestoes.find((s) => s.linhaId === l.id);
  const par = painel?.lancamentos.find((p) => p.id === l.pagamentoId);
  const aba = pilha;

  return (
    <div
      key={l.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 0",
        /*
          ⚠️ O fio so aparece em "Conferidos".

          Em "A conciliar", a segunda linha e um campo de busca
          sublinhado: o fio do bloco caia dois pixels abaixo do fio
          do campo e os dois liam como uma linha dupla. Sem
          divisoria, o proprio vao entre blocos separa — e ali ele
          pode, porque cada bloco tem duas alturas de conteudo.
        */
        borderBottom:
          aba === "conciliados" ? "1px solid var(--border)" : "none",
        /*
          ⚠️ O corpo de texto vem daqui.

          Na tabela ele vinha do `Td`, que crava `--text-sm` e a
          tinta cheia. Fora dela, data e valor passaram a herdar o
          tamanho do drawer e sairam maiores que o resto da tela.
        */
        fontSize: "var(--text-sm)",
        color: "var(--text-primary)",
      }}
    >
      {/* A linha do banco, como o extrato a trouxe. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={NUM}>{paraFormatoBR(l.data)}</span>
        <span style={TEXTO_QUE_CORTA}>{l.nome || "—"}</span>
        <span
          style={{
            ...NUM,
            fontWeight: "var(--fw-medium)",
            color: l.valor < 0 ? "var(--debito)" : "var(--credito)",
          }}
        >
          {l.valor < 0 ? "-" : ""}
          {formatarSemSimbolo(Math.abs(l.valor) as Centavos)}
        </span>
      </div>

      {/*
        A segunda linha e o outro lado do par: o lancamento do
        sistema, ou a busca por ele. Recuada, para se ler como
        resposta da linha de cima e nao como um segundo registro.
      */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginLeft: 16,
          minHeight: 28,
        }}
      >
        {aba === "conciliados" ? (
          <>
            <SetaDoPar />
            {/*
              ⚠️ O numero da CONTA vem na frente da data.

              E o mesmo lugar em que o kanban o poe, e pela mesma
              razao: e por ele que se acha o documento — a conta a
              receber que se combinou com o cliente, a conta a pagar
              que se combinou com o fornecedor. Data e valor dizem se
              bate; o numero diz do que se trata.
            */}
            {par?.documento && <Documento texto={par.documento} />}
            <span style={TEXTO_DO_PAR}>
              {par
                ? `${paraFormatoBR(par.data)} · ${formatarSemSimbolo(
                    Math.abs(par.valor) as Centavos,
                  )} · ${par.nome || `Lançamento ${par.id}`}`
                : "Lançamento fora do período consultado"}
            </span>
            <Button size="xs" disabled={ocupado} onClick={aoDesfazer}>
              Desfazer
            </Button>
          </>
        ) : sugestao && !trocando ? (
          <>
            {/*
              ⚠️ A MARCA no lugar do botao de aceitar uma a uma.

              Conciliar e trabalho de lote: com trinta linhas, clicar
              "e este" trinta vezes e trinta idas ao servidor e trinta
              recargas da lista. Marcando, a pessoa varre a lista
              decidindo, e grava tudo de uma vez no fim.

              ⚠️ E NADA chega marcado, nem as exatas: sugestao e
              palpite do sistema, e virar conferido depende de alguem
              afirmar. Ver `conferidos`.
            */}
            <MarcaDeUso
              marcado={marcado}
              rotulo={
                marcado ? "Tirar esta da conciliação" : "Conferi: é este mesmo"
              }
              onClick={aoMarcar}
            />
            {(() => {
              const doc = painel?.lancamentos.find(
                (p) => p.id === sugestao.lancamentoId,
              )?.documento;

              return doc ? <Documento texto={doc} /> : null;
            })()}
            {/*
              ⚠️ A tag vem DEPOIS do nome e COLADA nele, e nao na
              ponta da linha.

              Antes do nome, todas as linhas comecavam por uma
              pastilha colorida e o nome — que e o que se le para
              decidir — passava a comecar num eixo diferente em cada
              linha. Empurrada para a ponta, ela se soltava do que
              qualifica: a confianca e daquela sugestao, e nao da
              linha inteira.
            */}
            <span
              title={sugestao.motivo}
              style={{ ...TEXTO_DO_PAR, flex: "0 1 auto" }}
            >
              {nomeDoLancamento(painel, sugestao.lancamentoId)}
            </span>
            <Badge tom={sugestao.confianca === "exata" ? "success" : "warning"}>
              {sugestao.confianca === "exata" ? "Exata" : "Provável"}
            </Badge>

            {/* O vao empurra so o "Outro" para a ponta: ele e a saida
                da linha, e nao parte do que ela afirma. */}
            <span style={{ flex: 1 }} />
            {/*
              ⚠️ "Outro" existe porque a sugestao pode estar errada.

              Sem ele, recusar exigia aceitar e desfazer — passando
              por um vinculo errado no meio, que por um instante e
              verdade para o resto do sistema.
            */}
            <Button size="xs" disabled={ocupado} onClick={() => aoTrocar(true)}>
              Outro
            </Button>
          </>
        ) : (
          <>
            <SetaDoPar />
            {/*
              ⚠️ O SELETOR BUSCAVEL do kit, e nao um `select` nativo.

              O nativo abre uma lista que se percorre rolando, e com
              trinta lancamentos no periodo achar o certo virava
              caca. Aqui se digita o valor ou o nome e a lista
              encolhe — e a busca ja mostra data e valor de cada
              candidato, que e como se reconhece um lancamento.

              ⚠️ Ele traz so os da MESMA direcao. Saida do banco nao
              casa com entrada do sistema: o vinculo inverte o sinal
              do fechamento e continua fechando o saldo, que e o erro
              mais dificil de achar depois.
            */}
            <span style={{ flex: 1, minWidth: 0 }}>
              <SeletorBuscavel
                valor={null}
                rotulo={null}
                sublinhado
                placeholder="Buscar o lançamento por valor ou nome…"
                desabilitado={ocupado}
                buscar={(termo) => procurar(l.valor, termo)}
                aoEscolher={(escolhido) => {
                  if (escolhido) aoLigar(escolhido.id);
                }}
              />
            </span>
            {sugestao && (
              <Button
                size="xs"
                disabled={ocupado}
                onClick={() => aoTrocar(false)}
              >
                Voltar
              </Button>
            )}
            {aoCadastrar && (
              /*
                ⚠️ A busca CONTINUA aqui do lado, e o cadastro não a substitui.
                "Nada com esse valor" é o que o sistema conclui do período
                carregado; a conta pode existir com outro valor, ou fora da
                janela. Trocando a busca pelo botão, o palpite viraria veredito.
              */
              <Button
                size="xs"
                disabled={ocupado}
                onClick={aoCadastrar}
                title="Cria a conta a pagar já com a data, o valor e o histórico do banco"
              >
                Cadastrar
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function nomeDoLancamento(
  painel: PainelDeConciliacao | null,
  id: number,
): string {
  const achado = painel?.lancamentos.find((l) => l.id === id);
  if (!achado) return `Lançamento ${id}`;

  return `${paraFormatoBR(achado.data)} · ${achado.nome || `Lançamento ${id}`}`;
}

/**
 * A seta que liga a linha do banco ao lancamento.
 *
 * ⚠️ Ela existe para a segunda linha nao parecer um segundo registro. Sem uma
 * marca de continuidade, duas linhas empilhadas com data e valor leem como dois
 * lancamentos, e a tela inteira dobra de tamanho aos olhos de quem chega.
 */
function SetaDoPar() {
  return (
    <span
      aria-hidden
      style={{ display: "inline-flex", color: "var(--text-disabled)" }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 3v6.2A2.8 2.8 0 0 0 6.8 12H12" />
        <path d="M9.6 9.6 12 12l-2.4 2.4" />
      </svg>
    </span>
  );
}

/** O texto que nao pode empurrar a coluna: corta com reticencias. */
const TEXTO_QUE_CORTA: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "var(--text-sm)",
};

/**
 * O numero do documento de origem, em pastilha.
 *
 * ⚠️ Monoespacado por `tabular-nums` e nao por fonte propria: sao numeros que se
 * comparam de uma linha para a outra, e largura variavel faz o olho reposicionar
 * a cada linha.
 */
function Documento({ texto }: { texto: string }) {
  return (
    <span
      style={{
        flexShrink: 0,
        padding: "1px 6px",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-3)",
        color: "var(--text-secondary)",
        fontSize: "var(--text-xs)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {texto}
    </span>
  );
}

/**
 * O outro lado do par: para onde a seta aponta.
 *
 * ⚠️ Cinza, e nao tinta cheia. A linha de cima e o FATO — o que o banco
 * registrou —, e a de baixo e a resposta que o sistema deu a ela. Nas duas com o
 * mesmo peso, o bloco lia como dois lancamentos empilhados, e a lista parecia ter
 * o dobro do tamanho que tem.
 */
const TEXTO_DO_PAR: React.CSSProperties = {
  ...TEXTO_QUE_CORTA,
  color: "var(--text-tertiary)",
};

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
