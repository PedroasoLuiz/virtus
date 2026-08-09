"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoBloqueado,
  Field,
  Formulario,
  GrupoDeCampos,
  PanelTabs,
  inputStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR } from "@/shared/utils/datas";
import { lerOfx, textoDoOfx } from "@/shared/domain/ofx";
import { LinhaDaConciliacao } from "./conciliacao-linha";
import type { ContaBancaria } from "@/modules/contas/contas.types";
import type { PainelDeConciliacao } from "@/modules/conciliacao/conciliacao.types";

/**
 * Conciliar: dizer que a linha do banco e o lancamento do sistema sao o mesmo
 * dinheiro.
 *
 * ⚠️ Abre em NIVEL 2, de dentro do extrato. Conciliar sem conta e sem periodo e
 * uma pergunta pela metade, e os dois ja estao decididos na tela que a abriu —
 * pedir de novo aqui seria refazer uma escolha que a pessoa acabou de fazer.
 *
 * ⚠️ A leitura do arquivo acontece AQUI, no navegador. O OFX esta na maquina de
 * quem importa; subir o binario para o servidor devolver as mesmas linhas seria
 * uma volta inteira sem ganho. O que nao se delega ao navegador e o que importa:
 * a chave de deduplicacao, o vinculo e a conferencia de que o lancamento e mesmo
 * daquela conta.
 */
/**
 * O que a tela esta fazendo agora.
 *
 * ⚠️ Tres estados e nao um booleano. "Lendo" acontece na maquina de quem
 * importa e pode demorar num arquivo grande; "enviando" e a ida ao servidor.
 * Com um `ocupado` so, a barra dizia a mesma coisa nos dois e quem esperava nao
 * sabia se o travamento era do computador dele ou da internet.
 */
type Etapa = null | "lendo" | "enviando" | "gravando";

/**
 * As duas pilhas de trabalho.
 *
 * ⚠️ "Sugerido" e "sem par" viraram UMA. A separacao supunha dois trabalhos
 * diferentes, e e o mesmo: percorrer o que falta conciliar de cima a baixo.
 * Quem tem sugestao ja chega marcado, quem nao tem mostra a busca — a linha se
 * explica sozinha, e nao ha por que obrigar a trocar de aba no meio da varredura
 * para nao esquecer metade do periodo.
 */
type Pilha = "aConciliar" | "conciliados";

const VAZIO: Record<Pilha, string> = {
  aConciliar: "Nada a conciliar neste período. Comece importando o arquivo do banco.",
  conciliados: "Nada conferido neste período ainda.",
};

const DIZERES: Record<Exclude<Etapa, null>, string> = {
  lendo: "Lendo o arquivo do banco…",
  enviando: "Gravando os lançamentos importados…",
  gravando: "Salvando…",
};

export function ConciliacaoDrawer({
  conta,
  de,
  ate,
  aoFechar,
}: {
  conta: ContaBancaria;
  de: string;
  ate: string;
  aoFechar: (mudou: boolean) => void;
}) {
  const { avisar } = useAvisos();
  const arquivo = useRef<HTMLInputElement>(null);

  const [painel, setPainel] = useState<PainelDeConciliacao | null>(null);
  /*
   * ⚠️ O periodo e ESTADO DAQUI, e nao a janela do extrato que abriu a tela.
   *
   * Ele nasce igual ao de la, mas a importacao o move: quem importa o extrato de
   * junho quer ver junho. Preso a janela de quem abriu, o arquivo entrava no
   * banco e a tela continuava vazia — foi exatamente o que aconteceu, e nao ha
   * nada na tela que explicasse.
   */
  const [periodo, setPeriodo] = useState({ de, ate });
  const [aba, setAba] = useState<Pilha>("aConciliar");
  /**
   * As marcas que a pessoa mexeu. Ausente = o padrao da confianca.
   *
   * ⚠️ Guarda so a DIFERENCA, e nao o estado de todas as linhas. Guardando
   * tudo, cada recarga depois de conciliar teria de reconstruir o mapa — e
   * uma linha que sumiu da lista deixaria uma marca orfa ligada.
   */
  const [marcados, setMarcados] = useState<Record<number, boolean>>({});
  /** A linha cuja sugestao foi recusada e espera outra escolha. */
  const [trocando, setTrocando] = useState<number | null>(null);
  /** O que esta acontecendo agora, para a tela nao parecer travada. */
  const [etapa, setEtapa] = useState<Etapa>(null);
  const ocupado = etapa !== null;
  /* Fechar precisa dizer se algo mudou, para o extrato atras recarregar. */
  const [mudou, setMudou] = useState(false);

  /**
   * ⚠️ Busca DEVOLVE o painel, e nao grava o estado ela mesma.
   *
   * Chamada direto dentro do efeito, uma funcao que grava estado dispara render
   * em cascata — e o lint acusa, com razao. Devolvendo, o efeito atribui no
   * `then` e as acoes da tela atribuem depois de gravar, com a mesma consulta.
   */
  const buscar = useCallback(async (): Promise<PainelDeConciliacao> => {
    const r = await fetch(
      `/api/v1/contas/${conta.id}/conciliacao?de=${periodo.de}&ate=${periodo.ate}`,
    );
    const corpo = await r.json().catch(() => null);

    if (!r.ok) throw new Error(corpo?.error?.message ?? "Não foi possível carregar a conciliação");

    return corpo.data as PainelDeConciliacao;
  }, [conta.id, periodo]);

  const carregar = useCallback(async () => {
    try {
      setPainel(await buscar());
    } catch (e: unknown) {
      avisar("atencao", e instanceof Error ? e.message : "Não foi possível carregar a conciliação");
    }
  }, [buscar, avisar]);

  useEffect(() => {
    buscar()
      .then(setPainel)
      .catch(() => {
        // O aviso fica para as acoes: erro na abertura ja aparece na lista vazia.
      });
  }, [buscar]);

  async function importar(entrada: File) {
    setEtapa("lendo");

    const extrato = lerOfx(textoDoOfx(await entrada.arrayBuffer()));

    if (extrato.lancamentos.length === 0) {
      setEtapa(null);
      avisar(
        "atencao",
        "Nenhum lançamento no arquivo",
        "Confira se é o extrato em OFX. Alguns bancos chamam de 'arquivo para o gerenciador financeiro'.",
      );
      return;
    }

    setEtapa("enviando");

    const r = await fetch(`/api/v1/contas/${conta.id}/conciliacao/importar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linhas: extrato.lancamentos.map((l) => ({
          data: l.data,
          valor: l.valor,
          nome: l.nome,
          tipo: l.tipo,
        })),
      }),
    });

    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      setEtapa(null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível importar o extrato");
      return;
    }

    const { gravadas, repetidas } = corpo.data;
    avisar(
      "sucesso",
      `${gravadas} ${gravadas === 1 ? "lançamento importado" : "lançamentos importados"}`,
      repetidas > 0
        ? `${repetidas} já estavam aqui e foram ignorados: reimportar o mesmo período não duplica.`
        : undefined,
    );

    /*
     * ⚠️ O periodo se abre para caber o ARQUIVO.
     *
     * Sem isto, importar o extrato de junho com a tela em agosto grava tudo e
     * nao mostra nada — e a pessoa conclui que a importacao falhou. Abre, e nao
     * substitui: o que ja estava a vista continua, para nao sumir o que ela
     * acabou de conciliar.
     */
    const datas = extrato.lancamentos.map((l) => l.data);
    const primeira = datas.reduce((a, b) => (a < b ? a : b));
    const ultima = datas.reduce((a, b) => (a > b ? a : b));

    setPeriodo((atual) => ({
      de: primeira < atual.de ? primeira : atual.de,
      ate: ultima > atual.ate ? ultima : atual.ate,
    }));

    setMudou(true);
    setEtapa(null);
  }

  async function ligar(linhaId: number, pagamentoId: number) {
    setEtapa("gravando");

    const r = await fetch(`/api/v1/contas/${conta.id}/conciliacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linhaId, pagamentoId }),
    });

    setEtapa(null);
    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível conciliar");
      return;
    }

    setTrocando(null);
    setMudou(true);
    await carregar();
  }

  async function desfazer(linhaId: number) {
    setEtapa("gravando");

    const r = await fetch(`/api/v1/contas/${conta.id}/conciliacao/desfazer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linhaId }),
    });

    setEtapa(null);
    if (!r.ok) return;

    setMudou(true);
    await carregar();
  }

  async function aceitarConferidos() {
    setEtapa("gravando");

    const r = await fetch(`/api/v1/contas/${conta.id}/conciliacao/exatas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pares: conferidos }),
    });
    const corpo = await r.json().catch(() => null);
    setEtapa(null);

    if (!r.ok) {
      avisar("atencao", corpo?.error?.message ?? "Não foi possível conciliar");
      return;
    }

    avisar("sucesso", `${corpo.data.conciliadas} conciliadas`);
    // As marcas somem junto: as linhas gravadas sairam da pilha, e uma marca
    // apontando para linha que nao esta mais aqui e estado orfao.
    setMarcados({});
    setMudou(true);
    await carregar();
  }

  const linhas = painel?.linhas ?? [];

  /** Os lancamentos que ainda podem receber vinculo, para o seletor da linha. */
  const livres = (painel?.lancamentos ?? []).filter((l) => !l.conciliado);

  /**
   * Os lancamentos que podem casar com uma linha, pela DIRECAO do dinheiro.
   *
   * ⚠️ Saida do banco so olha saida do sistema, e entrada so olha entrada. Um
   * debito de 500 nao tem como ser a conta a receber de 500 que entrou no mesmo
   * dia — sao dinheiros opostos. Oferecendo os dois lados, o seletor convidava a
   * um vinculo que inverte o sinal do fechamento e continua fechando o saldo,
   * que e o erro mais dificil de achar depois.
   *
   * Transferencia entre contas entra pelo mesmo criterio: ela sai de uma conta e
   * entra na outra, e cada ponta aparece do lado que lhe corresponde.
   */
  const candidatos = (valorDaLinha: number) =>
    livres.filter((p) => (valorDaLinha < 0 ? p.valor < 0 : p.valor > 0));

  /**
   * O que o seletor oferece enquanto se digita.
   *
   * ⚠️ Filtra em MEMORIA e nao no servidor: os lancamentos do periodo ja estao
   * na mao, e uma ida por tecla so acrescentaria espera. A busca cobre o nome e
   * o valor, porque quem concilia costuma saber o numero antes do nome.
   */
  const procurar = async (valorDaLinha: number, termo: string) => {
    const alvo = termo.trim().toLowerCase();

    return candidatos(valorDaLinha)
      .map((p) => ({
        id: p.id,
        // O documento abre o rotulo pelo mesmo motivo de abrir a linha do par: e
        // por ele que se procura, e quem digita "214" espera achar a CR 214.
        nome: [
          p.documento,
          paraFormatoBR(p.data),
          formatarSemSimbolo(Math.abs(p.valor) as Centavos),
          p.nome || `Lançamento ${p.id}`,
        ]
          .filter(Boolean)
          .join(" · "),
      }))
      .filter((p) => !alvo || p.nome.toLowerCase().includes(alvo))
      .slice(0, 30);
  };

  const pilhas: Record<Pilha, typeof linhas> = {
    aConciliar: linhas.filter((l) => !l.conciliado),
    conciliados: linhas.filter((l) => l.conciliado),
  };

  const rotulos: Record<Pilha, string> = {
    aConciliar: `A conciliar (${pilhas.aConciliar.length})`,
    conciliados: `Conferidos (${pilhas.conciliados.length})`,
  };

  const visiveis = pilhas[aba];

  /**
   * O que o botao do cabecalho vai gravar.
   *
   * ⚠️ NADA chega marcado, nem as exatas.
   *
   * Elas comecavam ligadas, com o argumento de que mesmo valor e mesmo dia nao
   * deixam o que decidir. Mas o botao passava a contar linhas que ninguem tinha
   * olhado — cinco no cabecalho para tres marcadas na tela —, e "aceitar" deixava
   * de significar "aceito o que conferi". Sugestao e palpite do sistema; virar
   * conferido depende de alguem afirmar.
   */
  const conferidos = (painel?.sugestoes ?? [])
    .filter((s) => marcados[s.linhaId])
    .filter((s) => !linhas.find((l) => l.id === s.linhaId)?.conciliado)
    .map((s) => ({ linhaId: s.linhaId, pagamentoId: s.lancamentoId }));

  return (
    <Drawer
      open
      nivel={2}
      onClose={() => aoFechar(mudou)}
      title="Conciliar extrato"
      acoes={
        /*
          ⚠️ As DUAS acoes da tela ficam juntas, no cabecalho.

          Importar estava no meio do formulario e aceitar as exatas no topo: sao
          os dois unicos gestos que valem para a tela inteira, e separados a
          pessoa procurava um deles. A ordem e a do trabalho — primeiro entra o
          arquivo, depois se aceita o que casou.
        */
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {/*
            ⚠️ O `input type=file` fica ESCONDIDO atras do botao do kit.

            O seletor nativo tem desenho proprio em cada navegador e nao aceita os
            tokens da casa. Escondido, o botao continua sendo o do sistema e o
            gesto continua sendo o nativo, que o sistema operacional faz melhor
            que qualquer coisa que eu desenhasse.
          */}
          <input
            ref={arquivo}
            type="file"
            accept=".ofx,.OFX"
            style={{ display: "none" }}
            onChange={(e) => {
              const escolhido = e.target.files?.[0];
              // O valor e limpo para o mesmo arquivo poder ser escolhido de
              // novo: sem isso, `change` nao dispara na segunda vez.
              e.target.value = "";
              if (escolhido) void importar(escolhido);
            }}
          />
          {/*
            ⚠️ Aceitar vem PRIMEIRO, e importar fica na ponta.

            Importar acontece uma vez por arquivo; aceitar e confirmar acontecem
            o tempo todo. A acao repetida fica onde a mao volta, e a de abertura
            encosta na borda — como o incluir das listagens, que tambem mora na
            ponta por ser o gesto raro.
          */}
          <Button
            size="xs"
            variant="primary"
            disabled={ocupado || conferidos.length === 0}
            title={
              conferidos.length === 0
                ? "Marque as linhas que você conferiu"
                : `Grava ${conferidos.length} de uma vez`
            }
            onClick={() => void aceitarConferidos()}
          >
            {`Aceitar ${conferidos.length}`}
          </Button>

          {/*
            ⚠️ Icone MAIS a extensao, e nao um dos dois.

            O icone sozinho nao diz que o arquivo tem formato exigido, e e nele
            que a importacao falha: quem tenta com o PDF do extrato descobre
            depois de escolher. "OFX" escrito ao lado responde antes do erro, e a
            seta entrando diz o resto sem gastar a palavra "importar".
          */}
          {/*
            ⚠️ A borda acompanha a do X, e nao a do botao padrao.

            O botao secundario do kit usa `--border-strong`, que e o certo no
            meio de um formulario; encostado no fechar do cabecalho, ele ficava
            com um contorno mais escuro que o vizinho a dois pixels de distancia.
            Aqui o vizinho e quem manda.
          */}
          <Button
            size="xs"
            disabled={ocupado}
            style={{ borderColor: "var(--border)" }}
            onClick={() => arquivo.current?.click()}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
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
                {/* Seta entrando numa bandeja: o arquivo vindo de fora. */}
                <path d="M8 2v7" />
                <path d="M5.2 6.2 8 9l2.8-2.8" />
                <path d="M2.8 10.4v1.8a1.4 1.4 0 0 0 1.4 1.4h7.6a1.4 1.4 0 0 0 1.4-1.4v-1.8" />
              </svg>
              OFX
            </span>
          </Button>
        </span>
      }
    >
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="O arquivo do banco"
          legenda="O extrato em OFX, que todo banco exporta. Reimportar o mesmo período não duplica: cada linha tem uma chave própria."
        >
          {/*
            ⚠️ Campo bloqueado, e sem marca de pendencia ao lado.

            A conta aqui e contexto e nao dado a preencher: o campo com cadeado e
            o que o sistema inteiro usa para isso. A contagem de pendentes saiu
            porque as abas logo abaixo ja a mostram, uma por pilha — repetida no
            topo, ela era o mesmo numero em dois lugares, e um deles sem dizer de
            que recorte falava.
          */}
          <Field label="Conta">
            <CampoBloqueado valor={conta.apelido?.trim() || conta.nome} />
          </Field>

          {/*
            ⚠️ O periodo e EDITAVEL aqui, e nao herdado em silencio.

            Ele decide o que a lista abaixo mostra, e a importacao o move
            sozinha. Fixo e invisivel, quem importasse um mes fora da janela
            veria a tela vazia sem nada que explicasse — e concluiria que o
            arquivo nao entrou.
          */}
          <Field label="Período" hint="Move sozinho para caber o arquivo que você importar.">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="date"
                value={periodo.de}
                max={periodo.ate}
                onChange={(e) => setPeriodo((p) => ({ ...p, de: e.target.value }))}
                style={{ ...inputStyle, width: 150 }}
              />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>até</span>
              <input
                type="date"
                value={periodo.ate}
                min={periodo.de}
                onChange={(e) => setPeriodo((p) => ({ ...p, ate: e.target.value }))}
                style={{ ...inputStyle, width: 150 }}
              />
            </div>
          </Field>

          {/*
            ⚠️ Barra INDETERMINADA, e nao percentual.

            Nao ha como saber a fracao: a leitura do arquivo e sincrona e o envio
            depende da rede. Barra que finge porcentagem mente duas vezes —
            quando anda rapido demais e quando para nos 90%. O que a pessoa
            precisa saber e que algo esta acontecendo, e o que.
          */}
          {etapa && (
            /*
              ⚠️ O recuo de 142 e a COLUNA DOS CAMPOS: o rotulo do `Field` tem
              130 fixos e o vao ate o conteudo, 12. Sem ele, a barra comecava na
              margem dos rotulos e nao se alinhava com nada da tela.
            */
            <span
              style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 142 }}
            >
              <span
                aria-hidden
                style={{
                  position: "relative",
                  overflow: "hidden",
                  height: 3,
                  flex: 1,
                  maxWidth: 200,
                  borderRadius: "var(--radius-full)",
                  background: "var(--surface-3)",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "40%",
                    borderRadius: "var(--radius-full)",
                    background: "var(--primary)",
                    animation: "barra-indeterminada 1.1s var(--ease) infinite",
                  }}
                />
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {DIZERES[etapa]}
              </span>
            </span>
          )}

        </GrupoDeCampos>

        <GrupoDeCampos
          titulo="Linha do banco e lançamento"
          legenda="Uma pilha de cada vez: o que já casou por valor e data, o que ficou sem par, e o que você já conferiu."
        >
          {/*
            ⚠️ ABAS POR ESTADO, e nao uma lista so.

            As tres situacoes pedem gestos diferentes — confirmar, procurar e
            desfazer — e misturadas na mesma lista obrigavam a decidir qual era a
            de cada linha antes de agir. Separadas, cada aba tem uma acao so, e a
            coluna da direita para de mudar de natureza de linha para linha.

            Os numeros no rotulo sao o que dizem quanto falta, que e a pergunta
            que se faz o tempo todo enquanto se concilia.
          */}
          <PanelTabs
            tabs={[rotulos.aConciliar, rotulos.conciliados]}
            active={rotulos[aba]}
            onChange={(escolhida) =>
              setAba(escolhida === rotulos.aConciliar ? "aConciliar" : "conciliados")
            }
          />

          {/*
            ⚠️ BLOCO por linha, e nao tabela de colunas.

            Duas razoes, e as duas doeram na pratica. A primeira: o par se monta
            de cima para baixo — a linha do banco, e logo abaixo o lancamento que
            ela e —, e em colunas lado a lado o olho ia e voltava para associar
            os dois. A segunda: o `TableArea` tem `overflow: auto`, e ele CORTAVA
            a lista do seletor de busca, que aparecia por baixo das linhas
            seguintes. Fora da tabela, o seletor abre por cima como deve.
          */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visiveis.length === 0 && (
              <p
                style={{
                  padding: "28px 0",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {VAZIO[aba]}
              </p>
            )}

            {visiveis.map((l) => (
              <LinhaDaConciliacao
                key={l.id}
                linha={l}
                painel={painel}
                pilha={aba}
                marcado={marcados[l.id] ?? false}
                trocando={trocando === l.id}
                ocupado={ocupado}
                aoMarcar={() => setMarcados((atual) => ({ ...atual, [l.id]: !atual[l.id] }))}
                aoTrocar={(ligado) => setTrocando(ligado ? l.id : null)}
                aoLigar={(pagamentoId) => void ligar(l.id, pagamentoId)}
                aoDesfazer={() => void desfazer(l.id)}
                procurar={procurar}
              />
            ))}
          </div>
        </GrupoDeCampos>
      </Formulario>
    </Drawer>
  );
}
