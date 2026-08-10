"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  EmptyRow,
  FilterButton,
  FilterItem,
  inputStyle,
  PageHeader,
  PageLayout,
  Panel,
  PanelTabs,
  selectStyle,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { CartaoDeIndicador, FaixaDeCartoes } from "@/components/ui/cartao-de-indicador";
import { GraficoDeLinha } from "@/components/ui/grafico-de-linha";
import {
  LayoutComMenu,
  MenuDeSecoes,
  type GrupoDeSecoes,
} from "@/components/ui/menu-de-secoes";
import { formatar, formatarSemSimbolo, paraReais, type Centavos } from "@/shared/utils/money";
import { hoje, somarDias, somarMeses, type DataISO } from "@/shared/utils/datas";
import {
  chaveEmTexto,
  rotuloDaFamilia,
  type AlvoDoPainel,
  type FamiliaDeResultado,
} from "@/shared/domain/insights";
import type {
  AnuncioDoPeriodo,
  PainelDoCliente,
  Publicacao,
} from "@/modules/insights/insights.types";

/**
 * O painel de um cliente na Meta.
 *
 * ⚠️ Uma tela só, com o CLIENTE no eixo. Antes eram duas, separadas por API, e
 * falar de um cliente exigia abrir as duas. A separação que vale é configurar
 * contra apresentar: ligar conta e token mora em Integrações, e aqui só se
 * apresenta.
 *
 * ⚠️ O menu da esquerda separa PAGO de ORGÂNICO, e dentro do orgânico separa
 * Instagram de Facebook. É a divisão que a agência já usa para falar de
 * resultado, e a única em que os números se comparam entre si: investimento e
 * custo por resultado só existem no pago, e seguidor e engajamento não têm
 * preço. Lado a lado numa tela só, os dois conjuntos se misturavam e nada dizia
 * que se medem diferente.
 *
 * ⚠️ Instagram e Facebook têm a MESMA anatomia de propósito, e é isso que
 * permite comparar: cartões, e depois a grade de publicações no mesmo formato.
 * Trocar entre os dois é estado, não navegação, então acontece na hora e o olho
 * compara sem precisar guardar número de cabeça.
 *
 * ⚠️ Um BLOCO por origem dentro de cada seção, cada um com o seu cabeçalho. Com
 * bloco, a origem que falta some inteira e o cabeçalho explica, em vez de virar
 * zero no meio dos outros números.
 *
 * ⚠️ Quem ROLA é a coluna da direita, e sem isso a tela não existia: `Panel` é
 * `overflow: hidden` porque, no padrão de listagem, quem rola é o `TableArea`.
 * Numa tela que não é uma tabela só, tudo abaixo da dobra era simplesmente
 * cortado, sem barra e sem nada que explicasse.
 *
 * ⚠️ As métricas são buscadas AO VIVO. Nada é guardado no banco: o painel é
 * sempre o que a Meta diz agora, e não há dado velho para explicar.
 */

type Secao = "anuncios" | "instagram" | "facebook";

function inteiro(n: number): string {
  return n.toLocaleString("pt-BR");
}

/** "+312" ou "-14": ganho de seguidor precisa do sinal para significar algo. */
function comSinal(n: number): string {
  return `${n > 0 ? "+" : ""}${inteiro(n)}`;
}

function porcento(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

/**
 * ⚠️ Devolve vazio em data vazia, e não "undefined/undefined".
 *
 * A publicação vem da Meta e o `timestamp` pode faltar. Sem esta saída, o cartão
 * escreveria a palavra `undefined` no canto, que é pior que não escrever nada.
 */
function dataBR(iso: string): string {
  if (iso.length < 10) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * O número do EIXO, curto.
 *
 * ⚠️ Existe separado do formato do balão porque o eixo tem quatro valores
 * empilhados num vão de quarenta pixels. "1.234.567" ali vira uma parede de
 * dígitos ao lado do desenho, e o eixo serve para estimar altura, não para ler
 * o valor exato: esse está no balão, sob o cursor.
 */
function curto(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(Math.round(n));
}

/**
 * ⚠️ Dinheiro passa por `paraReais` ANTES de encurtar. A série vem em centavos,
 * como todo dinheiro do sistema, e encurtar o centavo direto escreveria "123 mil"
 * onde são mil e duzentos reais.
 */
function curtoEmReais(centavos: number): string {
  return curto(paraReais(centavos as Centavos));
}

function plural(n: number, um: string, varios: string): string {
  return `${inteiro(n)} ${n === 1 ? um : varios}`;
}

/** O primeiro dia do mês corrente, que é o recorte com que se abre uma conta. */
function inicioDoMes(): DataISO {
  return `${hoje().slice(0, 7)}-01` as DataISO;
}

/**
 * Os recortes que se pede numa reunião.
 *
 * ⚠️ "7 dias" termina HOJE, e não ontem, apesar de o dia corrente estar
 * incompleto. Quem pede a última semana quer saber o que aconteceu até agora, e
 * cortar hoje faria o painel discordar do Gerenciador de Anúncios aberto ao
 * lado.
 *
 * ⚠️ Mês passado é o mês FECHADO, com o último dia calculado pelo dia zero do
 * mês seguinte. Somar trinta dias erraria em fevereiro e nos meses de 31.
 */
const ATALHOS: { rotulo: string; calcular: () => [DataISO, DataISO] }[] = [
  {
    rotulo: "7 dias",
    calcular: () => [somarDias(hoje(), -6), hoje()],
  },
  {
    rotulo: "30 dias",
    calcular: () => [somarDias(hoje(), -29), hoje()],
  },
  {
    rotulo: "Este mês",
    calcular: () => [inicioDoMes(), hoje()],
  },
  {
    rotulo: "Mês passado",
    calcular: () => {
      const anterior = somarMeses(inicioDoMes(), -1);
      return [anterior, somarDias(inicioDoMes(), -1)];
    },
  },
];

/**
 * O que cada medida quer dizer, em uma frase.
 *
 * ⚠️ Escrito para quem PAGA o anúncio, e não para quem o opera. Esta tela é a
 * que se mostra ao cliente, e "razão entre cliques e impressões" não explica
 * nada a quem nunca viu a sigla. Cada texto diz o que é e o que um número alto
 * ou baixo significa, que é a pergunta seguinte de quem acabou de aprender.
 */
const GLOSSARIO = {
  investido: "Quanto saiu da conta de anúncio no período, já com os impostos da plataforma.",
  resultados:
    "Quantas vezes aconteceu a ação que a campanha busca: conversa iniciada, cadastro ou compra. Curtida e visualização não entram, porque não são o que se contratou.",
  custoPorResultado:
    "Quanto custou, em média, cada resultado. É o número que diz se a campanha está cara: ele cai quando o anúncio melhora e sobe quando o público satura.",
  impressoes:
    "Quantas vezes o anúncio apareceu na tela de alguém. A mesma pessoa vendo três vezes conta três.",
  cliques: "Quantas vezes alguém tocou no anúncio.",
  ctr:
    "Quantos por cento de quem viu o anúncio clicou nele. Alto quer dizer que a peça está falando com a pessoa certa; baixo, que ela não chamou atenção ou foi mostrada a quem não interessa.",
  custoPorClique:
    "Quanto custou, em média, cada clique. Depende do quanto o leilão da Meta está disputado naquele público.",
  cpm:
    "Quanto custou mostrar o anúncio mil vezes. É o preço do espaço, e não do resultado: ele sobe quando o público é disputado, como em datas comemorativas.",
  investidoDoResultado:
    "Quanto foi investido só nas campanhas que geraram esse resultado, e quanto isso representa do total. O custo acima se refere a essa fatia: dividir o mês inteiro por um resultado que só algumas campanhas buscavam daria um número sem sentido.",
  seguidores:
    "Quantas pessoas seguem o perfil agora. É um retrato de hoje, e não do fim do período.",
  ganho: "Quantos seguidores entraram menos os que saíram, no período escolhido.",
  alcancePerfil:
    "Quantas pessoas distintas viram alguma publicação em cada dia, somando os dias.",
  reacoes: "Curtidas mais comentários nas publicações do período.",
  fas: "Quantas pessoas curtiram a Página do Facebook.",
  alcancePagina:
    "Quantas pessoas distintas viram a Página em cada dia, somando os dias. Quem viu na segunda e na terça conta duas vezes.",
  visualizacoes: "Quantas vezes alguém abriu a Página.",
  engajamento:
    "Curtidas, comentários, compartilhamentos e cliques nas publicações da Página.",
  publicacoes: "Quantas publicações o perfil tem ao todo.",
} as const;

const atalhoStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "var(--radius-full)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text-secondary)",
  fontFamily: "var(--font)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function InsightsTela({ alvos }: { alvos: AlvoDoPainel[] }) {
  const [cliente, setCliente] = useState<string>(
    alvos.length > 0 ? chaveEmTexto(alvos[0].chave) : "",
  );
  const [secao, setSecao] = useState<Secao>("anuncios");

  /*
   * ⚠️ O que esta na TELA e o que esta no RASCUNHO sao duas coisas.
   *
   * `janela` e o periodo que os numeros representam; `de` e `ate` sao o que a
   * pessoa esta preenchendo no painel de filtro e ainda nao mandou consultar.
   * Antes eles eram um so, com 400ms de espera para disfarcar: campo de data
   * dispara `change` a cada digito, e cada disparo custa uma rodada inteira na
   * Meta. Com o botao de filtrar, quem preenche decide quando vale, e a espera
   * deixou de ser necessaria.
   */
  const [janela, setJanela] = useState<{ de: string; ate: string }>({
    de: inicioDoMes(),
    ate: hoje(),
  });

  const [de, setDe] = useState<string>(janela.de);
  const [ate, setAte] = useState<string>(janela.ate);

  function aplicar(novoDe: string, novoAte: string) {
    setDe(novoDe);
    setAte(novoAte);
    setJanela({ de: novoDe, ate: novoAte });
  }

  const [painel, setPainel] = useState<PainelDoCliente | null>(null);
  const [carregando, setCarregando] = useState(alvos.length > 0);
  const [erro, setErro] = useState<string | null>(null);

  /*
   * ⚠️ Todo `setState` acontece DEPOIS do `await`, e nenhum no corpo do efeito:
   * marcar "carregando" de forma síncrona aqui dispara render em cascata.
   *
   * ⚠️ `AbortController` porque trocar de cliente enquanto uma busca corre é
   * comum, e ela demora: são várias idas à Meta. Sem ele, a resposta antiga
   * chegaria depois e pintaria a tela com o cliente que a pessoa abandonou.
   *
   * ⚠️ As dependências são os campos da janela, e não o objeto. Com o objeto,
   * cada passada do atraso acima criaria uma referência nova e a busca
   * dispararia de novo com o mesmo período.
   */
  useEffect(() => {
    if (!cliente) return;

    const controle = new AbortController();
    const p = new URLSearchParams({ cliente, de: janela.de, ate: janela.ate });

    fetch(`/api/v1/insights/painel?${p.toString()}`, { signal: controle.signal })
      .then(async (r) => {
        const dados = await r.json().catch(() => null);

        if (!r.ok) {
          /*
           * ⚠️ A mensagem da Meta chega inteira até aqui. Ela costuma dizer o
           * que fazer, token expirado ou permissão faltando, e trocá-la por
           * "erro ao carregar" deixaria quem usa sem saída.
           */
          setErro(dados?.error?.message ?? "Não foi possível carregar as métricas");
          setPainel(null);
          return;
        }

        setErro(null);
        setPainel(dados.data as PainelDoCliente);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setErro("Não foi possível falar com o servidor");
      })
      .finally(() => setCarregando(false));

    return () => controle.abort();
  }, [cliente, janela.de, janela.ate]);

  /*
   * ⚠️ O menu avisa qual lado está vazio ANTES do clique.
   *
   * O alvo já sabe o que o cliente tem ligado, e sem essa nota a pessoa entra em
   * Orgânico, encontra um bloco explicando a ausência, e volta. Dito no próprio
   * menu, ela não precisa ir até lá para descobrir.
   */
  const grupos: GrupoDeSecoes<Secao>[] = useMemo(() => {
    const alvo = alvos.find((a) => chaveEmTexto(a.chave) === cliente);
    const semPagina = alvo && !alvo.temPerfil ? "sem página" : undefined;

    return [
      {
        titulo: "Pago",
        itens: [
          {
            chave: "anuncios",
            rotulo: "Anúncios",
            nota: alvo && !alvo.temAnuncio ? "sem conta" : undefined,
          },
        ],
      },
      {
        /*
         * ⚠️ Instagram e Facebook são itens do MENU, e não abas horizontais.
         *
         * A regra da casa é que aba só existe em drawer. Aqui a troca é
         * instantânea do mesmo jeito, porque é estado e não navegação, e a
         * lista aguenta a próxima rede entrando sem virar uma fileira que rola
         * de lado.
         */
        titulo: "Orgânico",
        itens: [
          { chave: "instagram", rotulo: "Instagram", nota: semPagina },
          { chave: "facebook", rotulo: "Facebook", nota: semPagina },
        ],
      },
    ];
  }, [alvos, cliente]);

  /*
   * ⚠️ "Está buscando" é DERIVADO da resposta, e não um estado à parte.
   *
   * A resposta carrega o cliente e o período a que pertence, então basta
   * compará-los com o que está escolhido: enquanto forem diferentes, o que está
   * na tela é da consulta anterior. Um `setCarregando(true)` no corpo do efeito
   * dispararia render em cascata, que é o que esta tela evita desde o começo — e
   * ainda poderia ficar preso em `true` se a resposta se perdesse.
   */
  const buscando =
    cliente !== "" &&
    (painel == null ||
      painel.cliente.chave !== cliente ||
      painel.periodo.de !== janela.de ||
      painel.periodo.ate !== janela.ate);

  return (
    <PageLayout>
      <Panel>
        {/*
          ⚠️ Sem botão de conectar aqui, e isso é decisão.

          Esta tela é de apresentação: é o que se mostra ao cliente na reunião.
          Um botão de credencial no cabeçalho dela convida a mexer em token na
          frente de quem não deveria ver a operação. Ligar conta mora em
          Integrações, junto com as outras.

          ⚠️ O período vai na DESCRIÇÃO, e não só dentro do filtro. Todo número
          desta tela só significa alguma coisa junto do recorte, e com o
          intervalo escondido atrás do botão, "investido 4.000" numa reunião não
          diz de quando.
        */}
        <PageHeader title="Insights" description="Direto da Meta, sem nada guardado.">
          {/*
            ⚠️ O cliente fica FORA do filtro, e visível. Ele não recorta o dado:
            ele é o assunto da tela. Dentro do botão, a pessoa não veria de quem
            são os números que está apresentando.
          */}
          {/*
            ⚠️ O aviso de espera fica no CABEÇALHO, ANTES do seletor de cliente,
            e o conteúdo antigo permanece visível por baixo.

            São várias idas à Meta, e a resposta demora o suficiente para alguém
            achar que a tela travou. Trocar tudo por um vazio a cada consulta
            piscaria a tela inteira e faria perder a referência do que estava
            sendo comparado; deixando o anterior no lugar, esmaecido, a espera é
            legível sem ser uma interrupção.

            ⚠️ À esquerda do seletor, e não à direita. Os controles do cabeçalho
            são alinhados à direita: aparecendo entre eles, o aviso empurrava o
            cliente e o filtro de lado a cada consulta, e os dois dançavam na
            tela toda vez que alguém trocava de período.
          */}
          {buscando && !erro && <Buscando />}

          <SeletorDeCliente alvos={alvos} valor={cliente} aoEscolher={setCliente} />



          {/*
            ⚠️ O período é escrito no PRÓPRIO botão de filtro, e não numa legenda
            abaixo do título.

            Todo número desta tela só significa alguma coisa junto do recorte, e
            numa reunião "investido 4.000" precisa dizer de quando. Mas a legenda
            do cabeçalho o deixava longe do controle que o muda, e repetia em
            texto corrido uma informação que cabe no botão.
          */}
          <FilterButton
            rotulo={`${dataBR(janela.de)} a ${dataBR(janela.ate)}`}
            activeCount={0}
            onClear={() => aplicar(inicioDoMes(), hoje())}
            /*
             * ⚠️ Aplicar por BOTAO, e nao a cada tecla. Cada mudanca de periodo
             * aqui e uma rodada inteira na Meta: desempenho, campanhas,
             * criativos, Pagina, perfil e publicacoes, vezes o numero de contas.
             */
            onAplicar={() => setJanela({ de, ate })}
          >
            {/*
              ⚠️ Os atalhos vêm ANTES dos campos, e não depois.

              Quase todo recorte de reunião é um deles, e quem digitou as duas
              datas não vai mais olhar para os botões. Embaixo, eles seriam a
              descoberta de quem já fez o trabalho à mão.
            */}
            <FilterItem label="Atalhos">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ATALHOS.map((a) => {
                  const [inicio, fim] = a.calcular();
                  const aceso = inicio === janela.de && fim === janela.ate;

                  return (
                    <button
                      key={a.rotulo}
                      type="button"
                      /*
                       * ⚠️ O atalho APLICA na hora, e não espera o botão de
                       * filtrar. Ele é a escolha inteira, as duas datas de uma
                       * vez; uma data digitada é metade de uma, e não dá para
                       * consultar com "de" preenchido e "até" pela metade.
                       */
                      onClick={() => aplicar(inicio, fim)}
                      style={{
                        ...atalhoStyle,
                        borderColor: aceso ? "var(--primary)" : "var(--border)",
                        background: aceso ? "var(--primary-subtle)" : "var(--surface)",
                        color: aceso ? "var(--primary)" : "var(--text-secondary)",
                        fontWeight: aceso ? 600 : 400,
                      }}
                    >
                      {a.rotulo}
                    </button>
                  );
                })}
              </div>
            </FilterItem>

            {/*
              ⚠️ As duas datas na MESMA linha, sob um rótulo só.

              Empilhadas, com "De" e "Até" cada uma com a sua pauta em caixa
              alta, elas liam como dois filtros independentes, e a caixa ficava
              alta e estreita. Um intervalo é UM filtro com duas pontas, e lado a
              lado ele se lê de uma vez.
            */}
            <FilterItem label="Período">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="date"
                  value={de}
                  max={ate}
                  onChange={(e) => setDe(e.target.value)}
                  aria-label="Data inicial"
                  style={{ ...inputStyle, width: "100%", minWidth: 0 }}
                />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  até
                </span>
                <input
                  type="date"
                  value={ate}
                  /*
                   * ⚠️ `min` e `max` cruzados entre os dois campos: o navegador
                   * recusa o intervalo invertido antes de ele existir. O
                   * servidor também recusa, mas ali vira mensagem de erro para
                   * uma coisa que o campo podia ter impedido.
                   */
                  min={de}
                  onChange={(e) => setAte(e.target.value)}
                  aria-label="Data final"
                  style={{ ...inputStyle, width: "100%", minWidth: 0 }}
                />
              </div>
            </FilterItem>
          </FilterButton>
        </PageHeader>

        {/*
          ⚠️ `rolar={false}`: a coluna CABE na tela e quem rola e a peca de baixo
          de cada secao. Rolando a coluna inteira, o cabecalho com o cliente e o
          periodo saia de vista junto — e e ele que diz de quem e de quando sao
          os numeros que estao na tela.
        */}
        <LayoutComMenu
          rolar={false}
          recolhivel
          menu={<MenuDeSecoes grupos={grupos} atual={secao} aoEscolher={setSecao} />}
        >
          {erro && (
            <Bloco>
              <Alert variant="danger" title={erro} />
            </Bloco>
          )}

          {alvos.length === 0 && !erro && (
            <Bloco>
              <Alert variant="info" title="Nenhum cliente ligado">
                Ligue uma conta de anúncio ou uma Página da Meta a um cliente em Cadastros,
                Integrações.
              </Alert>
            </Bloco>
          )}

          {/*
            ⚠️ Falha de UMA origem não zera o painel, e precisa aparecer assim
            mesmo: sem isto, o investimento de uma conta que respondeu viraria "o
            total do cliente" e alguém apresentaria número incompleto.

            ⚠️ SEMPRE acima do conteúdo, e no mesmo lugar dos outros avisos.
            Chegou a ficar embaixo quando havia cartões, para não empurrar os
            números; na prática o aviso passava despercebido justamente quando
            havia dado na tela, que é quando ele mais importa — é ali que alguém
            está prestes a apresentar um total incompleto. Alerta que muda de
            lugar conforme o caso é alerta que ninguém aprende a procurar.
          */}
          {painel && <AvisoDeFalhas falhas={painel.falhas} />}


          {/*
            ⚠️ Esmaecido e sem receber clique enquanto a resposta não chega. O
            número velho continua legível — o que evita a tela piscar —, mas
            ninguém interage com um painel que está prestes a ser trocado.
          */}
          {painel && (
            <div
              style={{
                display: "contents",
                opacity: buscando ? 0.45 : 1,
                pointerEvents: buscando ? "none" : undefined,
              }}
            >
              {secao === "anuncios" && <BlocoDeAnuncios painel={painel} />}
              {secao === "instagram" && <BlocoDeInstagram painel={painel} />}
              {secao === "facebook" && <BlocoDaPagina painel={painel} />}
            </div>
          )}

          {carregando && !painel && (
            <div style={{ padding: "24px 0", color: "var(--text-tertiary)" }}>
              Buscando na Meta…
            </div>
          )}
        </LayoutComMenu>
      </Panel>
    </PageLayout>
  );
}

/** O pulso de espera, com o texto ao lado: só o giro não diz o que se espera. */
function Buscando() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: "var(--toolbar-input-h)",
        padding: "0 10px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-3)",
        color: "var(--text-tertiary)",
        fontSize: "var(--text-sm)",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="2"
        />
        <path
          d="M8 2a6 6 0 016 6"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 8 8"
            to="360 8 8"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      Buscando na Meta
    </span>
  );
}

/** ⚠️ Inteiro, e não encolhido: o que mudou de lugar foi a ordem, não o tamanho. */
function AvisoDeFalhas({ falhas }: { falhas: string[] }) {
  if (falhas.length === 0) return null;

  return (
    <div style={{ marginBottom: 12, flexShrink: 0 }}>
      <Alert variant="warning" title="Parte dos dados não veio">
        {falhas.join(" ")}
      </Alert>
    </div>
  );
}

/**
 * O cliente de quem é o painel.
 *
 * ⚠️ Não é um `select` do navegador, e a diferença não é estética. O nativo
 * herda a lista do sistema operacional: outra tipografia, outro raio, outra cor
 * de seleção, e nada disso responde ao tema. Num cabeçalho onde ele fica ao lado
 * do botão de filtro do kit, os dois pareciam vir de sistemas diferentes.
 *
 * ⚠️ Mesma anatomia do `FilterButton`: mesma altura, mesma borda, mesmo raio e a
 * mesma caixa que abre embaixo. São dois controles vizinhos que fazem a mesma
 * coisa, escolher o recorte, e desenhá-los diferente faria o olho tratá-los como
 * coisas de naturezas distintas.
 */
function SeletorDeCliente({
  alvos,
  valor,
  aoEscolher,
}: {
  alvos: AlvoDoPainel[];
  valor: string;
  aoEscolher: (chave: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };

    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const escolhido = alvos.find((a) => chaveEmTexto(a.chave) === valor);

  return (
    <div ref={caixa} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 280,
          height: "var(--toolbar-input-h)",
          padding: "0 10px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          background: aberto ? "var(--surface-3)" : "var(--surface)",
          cursor: "pointer",
          fontFamily: "var(--font)",
          fontSize: "var(--text-base)",
          color: "var(--text-primary)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {escolhido?.nome ?? "Nenhum cliente ligado"}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {aberto && alvos.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 300,
            minWidth: 240,
            maxHeight: 320,
            overflowY: "auto",
            padding: 6,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {alvos.map((a) => {
            const chave = chaveEmTexto(a.chave);
            const ativo = chave === valor;

            return (
              <button
                key={chave}
                type="button"
                onClick={() => {
                  aoEscolher(chave);
                  setAberto(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  padding: "7px 10px",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  background: ativo ? "var(--primary-subtle)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-base)",
                  fontWeight: ativo ? 600 : 400,
                  color: ativo ? "var(--primary)" : "var(--text-primary)",
                }}
                onMouseOver={(e) => {
                  if (!ativo) e.currentTarget.style.background = "var(--surface-3)";
                }}
                onMouseOut={(e) => {
                  if (!ativo) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={CORTADO}>{a.nome}</span>

                {/*
                  ⚠️ O que o cliente TEM, dito na própria lista. Escolher um
                  cliente para descobrir que ele não tem anúncio é uma ida e
                  volta que a lista pode evitar.
                */}
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {[a.temAnuncio ? "anúncios" : null, a.temPerfil ? "orgânico" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** O singular de cada família, para o rótulo do custo. */
const UNIDADE: Record<FamiliaDeResultado, string> = {
  COMPRA: "compra",
  CADASTRO: "cadastro",
  CONVERSA: "conversa",
  VISITA: "visita",
  ENGAJAMENTO: "engajamento",
  CLIQUE: "clique",
};

const AJUDA_DA_FAMILIA: Record<FamiliaDeResultado, string> = {
  COMPRA: "Compras que a Meta conseguiu atribuir ao anúncio, pelo pixel do site ou pela própria plataforma.",
  CADASTRO: "Formulários preenchidos por quem veio do anúncio.",
  CONVERSA:
    "Conversas iniciadas no WhatsApp, Messenger ou Direct a partir do anúncio. Conta a primeira mensagem, e não a venda.",
  VISITA:
    "Quantas vezes a página de destino terminou de abrir. É menor que os cliques de propósito: parte de quem clica desiste antes de a página carregar.",
  ENGAJAMENTO:
    "Reações, comentários, compartilhamentos e cliques na publicação impulsionada. É o que a campanha de engajamento busca.",
  CLIQUE: "Cliques que levaram ao destino do anúncio.",
};

function ajudaDaFamilia(familia: FamiliaDeResultado | null): string {
  return familia == null ? GLOSSARIO.resultados : AJUDA_DA_FAMILIA[familia];
}

/**
 * ⚠️ Um ícone por família, e não o alvo para todas. O ícone é o que se lê antes
 * do rótulo, e um balão de conversa diz "WhatsApp" antes de qualquer palavra.
 */
function IconeDaFamilia({ familia }: { familia: FamiliaDeResultado | null }) {
  if (familia === "CONVERSA") return <IconeConversa />;
  if (familia === "CADASTRO") return <IconePessoaMais />;
  if (familia === "COMPRA") return <IconeCarrinho />;
  if (familia === "VISITA" || familia === "CLIQUE") return <IconeCursor />;
  return <IconeAlvo />;
}

// ── Anúncios ────────────────────────────────────────────────────────────────

type AbaDeAnuncios = "Criativos" | "Campanhas";
const ABAS_DE_ANUNCIOS: AbaDeAnuncios[] = ["Criativos", "Campanhas"];

function BlocoDeAnuncios({ painel }: { painel: PainelDoCliente }) {
  const { resumo, contas, campanhas } = painel;
  const [aba, setAba] = useState<AbaDeAnuncios>("Criativos");

  return (
    <Bloco>
      {/*
        ⚠️ Metade ausente é dita com todas as letras, e não deixada em branco.
        Cliente com Página e sem conta de anúncio existe: sem o aviso, o bloco
        vazio parece campanha que não rodou, quando o que falta é a ligação.

        ⚠️ E é um aviso, não um cabeçalho de seção. O menu da esquerda já diz em
        que seção a pessoa está: um título repetindo "Anúncios" logo ao lado do
        item aceso rouba a altura que os cartões precisam.
      */}
      {resumo == null ? (
        <Alert variant="info" title="Este cliente não tem conta de anúncio ligada">
          Ligue uma conta de anúncio da Meta a este cliente em Cadastros, Integrações.
        </Alert>
      ) : (
        <>
          <FaixaDeCartoes>
            <CartaoDeIndicador
              label="Investido"
              valor={formatar(resumo.investido as Centavos)}
              icone={<IconeDinheiro />}
              ajuda={GLOSSARIO.investido}
              detalhe={contas.length > 1 ? `${contas.length} contas` : undefined}
              linhas={[
                {
                  rotulo: "Impressões",
                  valor: inteiro(resumo.impressoes),
                  ajuda: GLOSSARIO.impressoes,
                },
                {
                  rotulo: "Cliques",
                  valor: inteiro(resumo.cliques),
                  ajuda: GLOSSARIO.cliques,
                },
              ]}
            />

            <CartaoDeIndicador
              /*
               * ⚠️ O rótulo é o NOME do que a campanha entregou, e não a palavra
               * "resultados". Cem conversas no WhatsApp e cem compras são a
               * mesma contagem e valem coisas muito diferentes; escrever
               * "resultados" nos dois casos apaga o que distingue uma campanha
               * da outra, e é a primeira coisa que o cliente pergunta.
               */
              label={rotuloDaFamilia(resumo.familiaDeResultado)}
              valor={inteiro(resumo.resultados)}
              icone={<IconeDaFamilia familia={resumo.familiaDeResultado} />}
              ajuda={ajudaDaFamilia(resumo.familiaDeResultado)}
              linhas={[
                { rotulo: "CTR", valor: porcento(resumo.ctr), ajuda: GLOSSARIO.ctr },
                {
                  ajuda: GLOSSARIO.custoPorClique,
                  rotulo: "Custo por clique",
                  valor:
                    resumo.cliques > 0
                      ? formatarSemSimbolo(resumo.custoPorClique as Centavos)
                      : "sem clique",
                },
              ]}
            />

            <CartaoDeIndicador
              label={
                resumo.familiaDeResultado == null
                  ? "Custo por resultado"
                  : `Custo por ${UNIDADE[resumo.familiaDeResultado]}`
              }
              valor={
                resumo.resultados > 0
                  ? formatar(resumo.custoPorResultado as Centavos)
                  : "sem resultado"
              }
              icone={<IconeEtiqueta />}
              ajuda={GLOSSARIO.custoPorResultado}
              detalhe={plural(campanhas.length, "campanha", "campanhas")}
              /*
               * ⚠️ Este cartão era o único da fila SEM linhas de detalhe, e é o
               * mais difícil dos três de julgar sozinho: "R$ 12,40 por
               * resultado" não diz se está bom sem alguma referência de preço ao
               * lado. O CPM e a média diária são as duas que quem opera olha em
               * seguida, e as duas saem do que já está na mão.
               */
              linhas={[
                {
                  /*
                   * ⚠️ Diz QUANTO do investimento essa conta representa, e é a
                   * linha que protege a apresentação. Quando as campanhas que
                   * geraram o resultado são uma fatia pequena do gasto, o custo
                   * por resultado se refere a essa fatia, e não ao mês inteiro:
                   * sem isto, alguém compara o custo com o investido do topo e
                   * as contas não fecham.
                   */
                  rotulo: "Investido nessas campanhas",
                  valor:
                    resumo.investido > 0
                      ? `${formatarSemSimbolo(painel.investidoDoResultado as Centavos)} · ${Math.round(
                          (painel.investidoDoResultado / resumo.investido) * 100,
                        )}%`
                      : formatarSemSimbolo(painel.investidoDoResultado as Centavos),
                  ajuda: GLOSSARIO.investidoDoResultado,
                },
                {
                  rotulo: "Custo por mil impressões",
                  valor:
                    resumo.impressoes > 0
                      ? formatarSemSimbolo(
                          Math.round((resumo.investido / resumo.impressoes) * 1000) as Centavos,
                        )
                      : "sem impressão",
                  ajuda: GLOSSARIO.cpm,
                },
              ]}
            />
          </FaixaDeCartoes>

          <ParDeGraficos
            series={[
              {
                chave: "investido",
                rotulo: "Investimento por dia",
                pontos: painel.investidoPorDia,
                rotular: (v) => formatarSemSimbolo(v as Centavos),
                rotularEixo: curtoEmReais,
              },
              {
                chave: "resultados",
                rotulo: `${rotuloDaFamilia(resumo.familiaDeResultado)} por dia`,
                pontos: painel.resultadosPorDia,
                rotular: inteiro,
                rotularEixo: curto,
              },
              {
                chave: "cliques",
                rotulo: "Cliques por dia",
                pontos: painel.cliquesPorDia,
                rotular: inteiro,
                rotularEixo: curto,
              },
              {
                chave: "impressoes",
                rotulo: "Impressões por dia",
                pontos: painel.impressoesPorDia,
                rotular: inteiro,
                rotularEixo: curto,
              },
            ]}
            esquerda="investido"
            direita="resultados"
            vazio="Nenhum dia com veiculação neste período."
          />

          {/*
            ⚠️ Criativos e campanhas em ABAS, e não empilhados.

            São duas respostas para a mesma pergunta, "o que consumiu o
            dinheiro", uma pela peça e outra pelo orçamento: quem está olhando
            quer uma OU a outra, e empilhadas a de baixo vivia fora da tela.
            Esta é a exceção que o Pedro abriu à regra de aba só em drawer, e ela
            vale aqui porque as duas são o mesmo assunto em duas formas, não duas
            seções diferentes.
          */}
          <div style={{ marginTop: 14, flexShrink: 0 }}>
            <PanelTabs
              tabs={ABAS_DE_ANUNCIOS}
              active={aba}
              onChange={(t) => setAba(t as AbaDeAnuncios)}
            />
          </div>

          {/*
            ⚠️ A área da aba é FLEX, e não um roladouro comum, e a diferença
            aparece na tabela.

            Num roladouro, o cartão branco terminava onde as linhas acabavam e
            sobrava cinza embaixo. Sendo flex, o `TableFrame` estica até o fim da
            tela e quem rola é o corpo da tabela — que é o que faz o cabeçalho
            `sticky` do kit finalmente grudar, em vez de subir junto com as
            linhas.

            ⚠️ A grade de criativos precisa do roladouro próprio, porque ela não
            tem uma peça interna que role. Sem ele, seis cartões numa tela baixa
            seriam cortados.
          */}
          <div style={{ flex: 1, minHeight: 140, display: "flex", flexDirection: "column" }}>
            {aba === "Criativos" ? (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                <Criativos lista={painel.anuncios} />
              </div>
            ) : (
              <TabelaDeCampanhas painel={painel} />
            )}
          </div>
        </>
      )}
    </Bloco>
  );
}

function TabelaDeCampanhas({ painel }: { painel: PainelDoCliente }) {
  /*
   * ⚠️ A coluna de conta só aparece quando há mais de uma. Com uma só, ela
   * repetiria o mesmo texto em toda linha e roubaria largura do nome da
   * campanha, que é o que se lê.
   */
  const mostraConta = painel.contas.length > 1;

  return (
    <TableFrame solto>
      <TableArea minWidth={860}>
        <TableHead>
          <Th>Campanha</Th>
          {mostraConta && <Th minWidth={140}>Conta</Th>}
          <Th minWidth={110}>Investido</Th>
          <Th minWidth={100}>Resultados</Th>
          <Th minWidth={110}>Impressões</Th>
          <Th minWidth={90}>Cliques</Th>
          <Th minWidth={80}>CTR</Th>
        </TableHead>

        <tbody>
          {painel.campanhas.length === 0 && (
            <EmptyRow
              colSpan={mostraConta ? 7 : 6}
              message="Nenhuma campanha com veiculação neste período."
            />
          )}

          {painel.campanhas.map((c, i) => (
            <Tr key={`${c.conta}-${c.id}`} delay={Math.min(i * 20, 150)}>
              <Td style={{ maxWidth: 280 }}>
                <span style={CORTADO}>{c.nome}</span>
              </Td>
              {mostraConta && (
                <Td style={{ maxWidth: 160 }}>
                  <span style={CORTADO}>{c.conta}</span>
                </Td>
              )}
              <Td style={NUM}>{formatarSemSimbolo(c.investido as Centavos)}</Td>
              <Td style={NUM}>{inteiro(c.resultados)}</Td>
              <Td style={NUM}>{inteiro(c.impressoes)}</Td>
              <Td style={NUM}>{inteiro(c.cliques)}</Td>
              <Td style={NUM}>{porcento(c.ctr)}</Td>
            </Tr>
          ))}
        </tbody>
      </TableArea>
    </TableFrame>
  );
}

// ── Instagram ───────────────────────────────────────────────────────────────

function BlocoDeInstagram({ painel }: { painel: PainelDoCliente }) {
  const perfil = painel.perfil;

  /*
   * ⚠️ A base da variação é o total de HOJE menos o ganho, e não o total de
   * hoje. A Meta não guarda o total de dias passados: sem essa subtração, a
   * pílula compararia o número com ele mesmo e diria sempre zero.
   *
   * ⚠️ `null` quando a base é zero ou negativa, e não "100%". Perfil que saiu do
   * zero no período não tem percentual: a conta divide por zero.
   */
  const variacao = useMemo(() => {
    if (perfil == null) return null;
    const base = perfil.seguidores - perfil.ganhoNoPeriodo;
    return base > 0 ? (perfil.ganhoNoPeriodo / base) * 100 : null;
  }, [perfil]);

  return (
    <Bloco>
      {perfil == null ? (
        <Alert variant="info" title="Este cliente não tem perfil do Instagram ligado">
          Seguidores e publicações dependem de uma Página com perfil comercial do Instagram.
        </Alert>
      ) : (
        <>
          <FaixaDeCartoes>
            {/*
              ⚠️ "hoje" no rótulo, e não "no período". A Meta devolve o total de
              seguidores AGORA e não guarda o de dias passados: sem a palavra,
              alguém soma com o ganho e acha divergência.
            */}
            <CartaoDeIndicador
              label="Seguidores hoje"
              valor={inteiro(perfil.seguidores)}
              icone={<IconePessoas />}
              ajuda={GLOSSARIO.seguidores}
              variacao={variacao}
              linhas={[
                {
                  rotulo: "Ganho no período",
                  valor: comSinal(perfil.ganhoNoPeriodo),
                  ajuda: GLOSSARIO.ganho,
                },
                {
                  rotulo: "Publicações no perfil",
                  valor: inteiro(perfil.publicacoesNoPerfil),
                  ajuda: GLOSSARIO.publicacoes,
                },
              ]}
            />

            <CartaoDeIndicador
              /*
               * ⚠️ "por dia", igual ao lado do Facebook, e não "no período".
               *
               * É a SOMA do alcance de cada dia, e não pessoas distintas: quem
               * viu na segunda e na terça conta duas vezes. O Facebook já dizia
               * isso e o Instagram não, com o mesmo tipo de número: dois rótulos
               * diferentes para a mesma conta faziam parecer que um deles era
               * único e o outro não.
               */
              label="Alcance por dia"
              valor={inteiro(perfil.alcanceNoPeriodo)}
              icone={<IconeOnda />}
              ajuda={GLOSSARIO.alcancePerfil}
              linhas={[
                {
                  /*
                   * ⚠️ Vem do TOTAL do período, e não do tamanho da grade. A
                   * grade mostra seis; contar em cima dela anunciava "6
                   * publicações" num mês com quarenta.
                   */
                  rotulo: "Publicações no período",
                  valor: inteiro(perfil.publicacoes.quantidade),
                },
              ]}
            />

            <CartaoDeIndicador
              label="Reações no período"
              valor={inteiro(perfil.publicacoes.curtidas + perfil.publicacoes.comentarios)}
              icone={<IconeCoracao />}
              ajuda={GLOSSARIO.reacoes}
              linhas={[
                { rotulo: "Curtidas", valor: inteiro(perfil.publicacoes.curtidas) },
                { rotulo: "Comentários", valor: inteiro(perfil.publicacoes.comentarios) },
              ]}
            />
          </FaixaDeCartoes>

          <ParDeGraficos
            series={[
              {
                chave: "seguidores",
                rotulo: "Seguidores ganhos por dia",
                pontos: perfil.ganhoPorDia,
                rotular: comSinal,
                rotularEixo: curto,
              },
              {
                chave: "alcance",
                rotulo: "Alcance por dia",
                pontos: perfil.alcancePorDia,
                rotular: inteiro,
                rotularEixo: curto,
              },
            ]}
            esquerda="seguidores"
            direita="alcance"
            vazio="A Meta devolve estas séries apenas para perfis com 100 seguidores ou mais, e a de seguidores só da janela curta."
          />

          {/*
            ⚠️ O aviso da janela de 30 dias existe porque a alternativa é pior:
            a pessoa pede três meses, recebe um, e conclui que a conta ficou
            parada. O limite é da Meta, não do dado.
          */}
          {perfil.serieCortada && (
            <Vao>
              <Alert variant="info" title="A Meta só guarda 30 dias de seguidores por dia">
                O gráfico começa em {dataBR(perfil.ganhoPorDia[0].dia)} mesmo com um período
                maior escolhido. O total de seguidores acima é de agora, e não do fim do
                período.
              </Alert>
            </Vao>
          )}

          <Rolavel>
            <Publicacoes
              lista={perfil.publicacoes.melhores}
              vazio="Nenhuma publicação no Instagram neste período"
            />
          </Rolavel>
        </>
      )}
    </Bloco>
  );
}

/**
 * As publicações do período, das mais reagidas para as menos.
 *
 * ⚠️ Ordenadas por reação, e não por data. A pergunta desta grade é "o que
 * funcionou": a ordem cronológica já está na própria rede, e repeti-la aqui não
 * acrescentaria nada.
 *
 * ⚠️ A MESMA grade serve Instagram e Facebook, e é isso que permite comparar os
 * dois trocando de item no menu. Duas grades divergiriam em recorte e em ordem,
 * e a comparação passaria a depender de reparar na diferença.
 */
function Publicacoes({ lista, vazio }: { lista: Publicacao[]; vazio: string }) {
  return (
    <section>
      <Subtitulo>Publicações que mais renderam</Subtitulo>

      {lista.length === 0 ? (
        <Alert variant="info" title={vazio} />
      ) : (
        <Grade>
          {lista.map((p) => (
            <CartaoDePublicacao key={p.id} publicacao={p} />
          ))}
        </Grade>
      )}
    </section>
  );
}

/**
 * Duas séries lado a lado, cada uma com a própria escolha de métrica.
 *
 * ⚠️ DOIS gráficos, e nunca um com dois eixos. Escalas diferentes num par de
 * eixos fazem qualquer par parecer correlacionado, e a conclusão errada sai de
 * graça.
 *
 * ⚠️ E a escolha é por gráfico, não uma para os dois. Poder ver investimento ao
 * lado de resultados é o ponto: uma escolha só mostraria a mesma medida duas
 * vezes.
 */
function ParDeGraficos({
  series,
  esquerda,
  direita,
  vazio,
}: {
  series: Serie[];
  esquerda: string;
  direita: string;
  vazio: React.ReactNode;
}) {
  /*
   * ⚠️ As duas escolhas moram AQUI, e não uma em cada gráfico, porque elas
   * dependem uma da outra: os dois lados nunca podem mostrar a mesma medida.
   * Dois gráficos idênticos lado a lado ocupam o dobro do espaço para dizer a
   * mesma coisa, e ainda sugerem uma comparação que não existe.
   */
  const [par, setPar] = useState<[string, string]>([esquerda, direita]);

  function escolher(lado: 0 | 1, chave: string) {
    setPar(([a, b]) => (lado === 0 ? [chave, b] : [a, chave]));
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginTop: 12,
      }}
    >
      {/*
        ⚠️ Cada lado só OFERECE o que o outro não está mostrando. A medida do
        vizinho sai da lista, em vez de ficar lá para ser escolhida e trocar os
        dois: o menu passa a descrever exatamente o que é possível, e não existe
        mais um clique cujo efeito é mexer no gráfico ao lado.
      */}
      <GraficoComEscolha
        series={series.filter((s) => s.chave !== par[1])}
        escolhida={par[0]}
        aoEscolher={(c) => escolher(0, c)}
        vazio={vazio}
      />
      <GraficoComEscolha
        series={series.filter((s) => s.chave !== par[0])}
        escolhida={par[1]}
        aoEscolher={(c) => escolher(1, c)}
        vazio={vazio}
      />
    </div>
  );
}

export type Serie = {
  chave: string;
  rotulo: string;
  pontos: { dia: string; valor: number }[];
  rotular: (valor: number) => string;
  /** O mesmo valor, curto, para o eixo da esquerda. */
  rotularEixo: (valor: number) => string;
};

function GraficoComEscolha({
  series,
  escolhida,
  aoEscolher,
  vazio,
}: {
  series: Serie[];
  escolhida: string;
  aoEscolher: (chave: string) => void;
  vazio: React.ReactNode;
}) {
  const serie = series.find((s) => s.chave === escolhida) ?? series[0];

  return (
    <GraficoDeLinha
      titulo={serie.rotulo}
      pontos={serie.pontos}
      rotular={serie.rotular}
      rotularEixo={serie.rotularEixo}
      vazio={vazio}
      seletor={
        <select
          value={serie.chave}
          onChange={(e) => aoEscolher(e.target.value)}
          /* Discreto: ele muda o gráfico, não anuncia. */
          style={{ ...selectStyle, height: 26, fontSize: "var(--text-sm)", width: "auto" }}
          aria-label="Métrica do gráfico"
        >
          {series.map((s) => (
            <option key={s.chave} value={s.chave}>
              {s.rotulo}
            </option>
          ))}
        </select>
      }
    />
  );
}

/** A grade de peças: publicação e criativo usam a mesma. */
function Grade({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        /*
         * ⚠️ `auto-fit`, e não `auto-fill`. Com `auto-fill` o navegador cria as
         * colunas que couberem e deixa as vazias ocupando espaço: seis peças num
         * quadro largo ficavam pequenas e espremidas à esquerda, com um vão morto
         * do lado. Com `auto-fit` as colunas vazias somem e as seis crescem para
         * ocupar a largura disponível.
         */
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Subtitulo({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        color: "var(--text-secondary)",
        marginBottom: 10,
      }}
    >
      {children}
    </h3>
  );
}

/**
 * Os anúncios que mais consumiram, com a arte de cada um.
 *
 * ⚠️ É o equivalente pago da grade de publicações, e de propósito com o mesmo
 * desenho. Campanha é orçamento; o anúncio é o que a pessoa viu, e "qual peça
 * funcionou" é a pergunta que a tabela de campanhas não responde.
 */
function Criativos({ lista }: { lista: AnuncioDoPeriodo[] }) {
  return (
    <section>
      {/* Sem subtítulo: a aba acima já diz o que esta grade é, e repetir o nome
          logo abaixo dele gasta uma linha para não dizer nada. */}
      {lista.length === 0 ? (
        <Alert variant="info" title="Nenhum anúncio com veiculação neste período" />
      ) : (
        <>
          {/*
            ⚠️ Sem palpite de causa aqui. Quando nenhuma arte vem, o servidor põe
            em `falhas` o que a Meta respondeu, e é isso que a tela mostra: um
            aviso escrito de antemão erraria o motivo na primeira vez que a causa
            fosse outra, e mandaria mexer na permissão errada.
          */}
          <Grade>
            {lista.map((a) => (
              <CartaoDeCriativo key={a.id} anuncio={a} />
            ))}
          </Grade>
        </>
      )}
    </section>
  );
}

function CartaoDeCriativo({ anuncio: a }: { anuncio: AnuncioDoPeriodo }) {
  return (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
        overflow: "hidden",
      }}
    >
      <Previa imagem={a.imagem} />

      <div style={{ padding: 12 }}>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", ...CORTADO }} title={a.nome}>
          {a.nome}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            ...CORTADO,
          }}
          title={a.campanha}
        >
          {a.campanha}
        </p>

        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ fontSize: "var(--text-base)", fontWeight: "var(--fw-semi)" }}>
            {formatar(a.investido as Centavos)}
          </span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            {plural(a.resultados, "resultado", "resultados")}
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * A prévia da arte, de anúncio ou de publicação.
 *
 * ⚠️ `img` cru, e não o `Image` do Next, e isto é decisão. A URL vem do CDN da
 * Meta assinada e EXPIRA em algumas horas. O otimizador do Next guardaria a
 * versão processada por muito mais tempo que a origem existe, e a grade passaria
 * a mostrar imagem quebrada de um dia para o outro sem ninguém ter mexido nela.
 */
function Previa({ imagem, children }: { imagem: string | null; children?: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        // O fundo é o que aparece quando a URL do CDN já expirou: um quadro
        // neutro no lugar do ícone de imagem quebrada do navegador.
        background: "var(--surface-3)",
      }}
    >
      {imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagem}
          alt=""
          loading="lazy"
          /*
           * ⚠️ `no-referrer`, e isto não é detalhe.
           *
           * O CDN da Meta recusa imagem pedida com `Referer` de outro domínio: é
           * proteção contra hotlink, e do lado de cá aparece como quadro vazio,
           * sem erro nenhum no console. Sem o cabeçalho suprimido, a grade de
           * criativos nasce cinza e parece que a URL não veio.
           */
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {children}
    </div>
  );
}

function CartaoDePublicacao({ publicacao: p }: { publicacao: Publicacao }) {
  return (
    <a
      href={p.link}
      target="_blank"
      // ⚠️ `noreferrer` junto do `noopener`: sem ele, o Instagram recebe a URL
      // interna do sistema no cabeçalho de origem.
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
        overflow: "hidden",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <Previa imagem={p.imagem}>
        {p.tipo !== "IMAGEM" && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "2px 7px",
              borderRadius: "var(--radius-full)",
              background: "rgba(0, 0, 0, 0.62)",
              color: "#fff",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-medium)",
            }}
          >
            {p.tipo === "VIDEO" ? "Vídeo" : "Carrossel"}
          </span>
        )}
      </Previa>

      <div style={{ padding: 12 }}>
        {/*
          ⚠️ Duas linhas de legenda, cortadas. Legenda de Instagram passa de dois
          mil caracteres, e um cartão que cresce com o texto quebra a grade toda:
          seis cartões de alturas diferentes deixam de se comparar de relance.
        */}
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: "var(--lh-normal)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.6em",
          }}
        >
          {p.legenda ?? "Sem legenda"}
        </p>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconeCoracao pequeno />
            {inteiro(p.curtidas)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconeBalao />
            {inteiro(p.comentarios)}
          </span>
          {/*
            ⚠️ Compartilhamento só aparece quando EXISTE. O Instagram não expõe
            esse número por publicação, e um zero ali diria "ninguém
            compartilhou" onde a verdade é "a API não conta".
          */}
          {p.compartilhamentos != null && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconeSeta />
              {inteiro(p.compartilhamentos)}
            </span>
          )}
          <span style={{ marginLeft: "auto" }}>{dataBR(p.data)}</span>
        </div>
      </div>
    </a>
  );
}

// ── Página do Facebook ──────────────────────────────────────────────────────

function BlocoDaPagina({ painel }: { painel: PainelDoCliente }) {
  const pagina = painel.pagina;

  if (pagina == null) {
    return (
      <Bloco>
        <Alert variant="info" title="Este cliente não tem Página do Facebook ligada">
          Ligue uma Página da Meta a este cliente em Cadastros, Integrações.
        </Alert>
      </Bloco>
    );
  }

  return (
    <Bloco>
      <FaixaDeCartoes>
        <CartaoDeIndicador
          label="Fãs"
          valor={inteiro(pagina.fas)}
          icone={<IconePessoas />}
          ajuda={GLOSSARIO.fas}
        />
        {/*
          ⚠️ "por dia" no rótulo porque é a SOMA dos dias, e não pessoas
          distintas no período: a Meta entrega o único de cada dia, e quem viu na
          segunda e na terça conta duas vezes. Sem a palavra, o número seria lido
          como alcance único e ficaria alto demais para o que significa.
        */}
        <CartaoDeIndicador
          label="Alcance por dia"
          valor={inteiro(pagina.alcance)}
          icone={<IconeOnda />}
          ajuda={GLOSSARIO.alcancePagina}
        />
        <CartaoDeIndicador
          label="Visualizações"
          valor={inteiro(pagina.visualizacoes)}
          icone={<IconeOlho />}
          ajuda={GLOSSARIO.visualizacoes}
        />
        <CartaoDeIndicador
          label="Engajamento"
          valor={inteiro(pagina.engajamento)}
          icone={<IconeCoracao />}
          ajuda={GLOSSARIO.engajamento}
        />
      </FaixaDeCartoes>

      <ParDeGraficos
        series={[
          {
            chave: "alcance",
            rotulo: "Alcance por dia",
            pontos: pagina.alcancePorDia,
            rotular: inteiro,
            rotularEixo: curto,
          },
          {
            chave: "engajamento",
            rotulo: "Engajamento por dia",
            pontos: pagina.engajamentoPorDia,
            rotular: inteiro,
            rotularEixo: curto,
          },
          {
            chave: "visualizacoes",
            rotulo: "Visualizações por dia",
            pontos: pagina.visualizacoesPorDia,
            rotular: inteiro,
            rotularEixo: curto,
          },
        ]}
        esquerda="alcance"
        direita="engajamento"
        vazio="Sem série da Página neste período. Estas métricas dependem da permissão read_insights."
      />

      {/*
        ⚠️ Publicações da PÁGINA, e não a lista do Instagram repetida. O
        cross-posting é opção por publicação, e não espelho: repetir a outra
        lista aqui apresentaria como publicação do Facebook coisas que talvez
        nunca tenham saído nele, com as curtidas do outro lado no rodapé.
      */}
      <Rolavel>
        <Publicacoes
          lista={pagina.publicacoes.melhores}
          vazio="Nenhuma publicação na Página neste período"
        />
      </Rolavel>
    </Bloco>
  );
}

// ── Peças de layout ─────────────────────────────────────────────────────────

/*
 * ⚠️ Tudo alinhado à ESQUERDA, inclusive dinheiro. É regra do sistema, e não
 * preferência desta tela.
 */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const CORTADO: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/**
 * Um bloco do relatório.
 *
 * ⚠️ SEM recuo lateral: ele vem da coluna do `LayoutComMenu`. Repetido aqui, os
 * cartões ficariam 16 mais para dentro que o texto ao lado deles.
 *
 * ⚠️ É uma coluna FLEX, e não um empilhamento comum. Os cartões e o gráfico têm
 * a altura que têm; o que sobra é da peça de baixo, que rola por dentro. Sem
 * isso, a seção passaria da tela e seria cortada, porque a coluna não rola.
 */
function Bloco({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      {children}
    </div>
  );
}

/**
 * O que ocupa a altura que sobrou, e rola por dentro.
 *
 * ⚠️ UMA por seção, e sempre a última. Duas dividiriam o espaço e as duas
 * ficariam curtas demais para servir; nenhuma faria a seção ser cortada em
 * silêncio.
 */
function Rolavel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 140, overflowY: "auto", marginTop: 12 }}>{children}</div>
  );
}

/** O respiro entre as peças de um mesmo bloco. */
function Vao({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 12 }}>{children}</div>;
}

// ── Ícones (grade de 20) ────────────────────────────────────────────────────

const TRACO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Cédula: o dinheiro que saiu. */
function IconeDinheiro() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <rect x="2.5" y="5" width="15" height="10" rx="2" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  );
}

/** Alvo: o que a campanha estava buscando. */
function IconeAlvo() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
    </svg>
  );
}

/** Etiqueta de preço: quanto custou cada um. */
function IconeEtiqueta() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M3.2 10.6V4.2a1 1 0 011-1h6.4l6 6-7.4 7.4z" />
      <circle cx="6.9" cy="6.9" r="1.1" />
    </svg>
  );
}

/** Duas pessoas: audiência. */
function IconePessoas() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="8" cy="7.2" r="2.8" />
      <path d="M2.8 16.2a5.2 5.2 0 0110.4 0" />
      <path d="M13.8 5.1a2.8 2.8 0 010 4.6M14.6 16.2a5 5 0 00-1.2-3.2" />
    </svg>
  );
}

/** Ondas: o quanto se espalhou. */
function IconeOnda() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="10" cy="10" r="1.6" />
      <path d="M6.3 6.3a5.2 5.2 0 000 7.4M13.7 6.3a5.2 5.2 0 010 7.4" />
    </svg>
  );
}

/** Coração: reação. */
function IconeCoracao({ pequeno = false }: { pequeno?: boolean }) {
  const t = pequeno ? 13 : 18;
  return (
    <svg width={t} height={t} viewBox="0 0 20 20" {...TRACO}>
      <path d="M10 16s-5.6-3.4-5.6-7A2.9 2.9 0 0110 7.2 2.9 2.9 0 0115.6 9c0 3.6-5.6 7-5.6 7z" />
    </svg>
  );
}

/** Balão: comentário. */
function IconeBalao() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" {...TRACO}>
      <path d="M17 9.6c0 3.1-3.1 5.6-7 5.6a8 8 0 01-2-.25L4 16.5l.8-2.6A5.4 5.4 0 013 9.6C3 6.5 6.1 4 10 4s7 2.5 7 5.6z" />
    </svg>
  );
}

/** Balão com traços: conversa iniciada. */
function IconeConversa() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M17 9.6c0 3.1-3.1 5.6-7 5.6a8 8 0 01-2-.25L4 16.5l.8-2.6A5.4 5.4 0 013 9.6C3 6.5 6.1 4 10 4s7 2.5 7 5.6z" />
      <path d="M7.4 9.6h.1M10 9.6h.1M12.6 9.6h.1" />
    </svg>
  );
}

/** Pessoa com mais: cadastro novo. */
function IconePessoaMais() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <circle cx="8.2" cy="7" r="2.8" />
      <path d="M3 16.2a5.2 5.2 0 0110.4 0" />
      <path d="M15.4 6.6v4.4M13.2 8.8h4.4" />
    </svg>
  );
}

/** Carrinho: compra. */
function IconeCarrinho() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M2.6 3.4h2l1.8 8.2h7.6l1.6-6H5.2" />
      <circle cx="7.4" cy="15.4" r="1.1" />
      <circle cx="13.6" cy="15.4" r="1.1" />
    </svg>
  );
}

/** Cursor: visita e clique. */
function IconeCursor() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M4.6 3.4l11 4.6-4.7 1.6-1.7 4.8z" />
      <path d="M11.4 11.4l4 4" />
    </svg>
  );
}

/** Seta curva: compartilhamento. */
function IconeSeta() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" {...TRACO}>
      <path d="M3.5 15.5c0-4.4 2.9-6.6 7.5-6.8V5.5l5.5 4.6-5.5 4.6v-3.2c-3.6.1-5.8 1.2-7.5 4z" />
    </svg>
  );
}

/** Olho: quem abriu a Página. */
function IconeOlho() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...TRACO}>
      <path d="M2.5 10S5.4 5.5 10 5.5 17.5 10 17.5 10 14.6 14.5 10 14.5 2.5 10 2.5 10z" />
      <circle cx="10" cy="10" r="2.1" />
    </svg>
  );
}
