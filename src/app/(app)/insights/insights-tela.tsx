"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FilterButton,
  FilterItem,
  inputStyle,
  PageHeader,
  PageLayout,
  Panel,
} from "@/components/ui/kit";
import { LayoutComMenu, MenuDeSecoes, type GrupoDeSecoes } from "@/components/ui/menu-de-secoes";
import { hoje, somarDias, somarMeses, type DataISO } from "@/shared/utils/datas";
import { chaveEmTexto, type AlvoDoPainel } from "@/shared/domain/insights";
import type { PainelDoCliente } from "@/modules/insights/insights.types";
import { BlocoDaPagina, BlocoDeAnuncios, BlocoDeInstagram } from "./blocos";
import { Bloco, CORTADO, dataBR, inicioDoMes } from "./pecas";

/**
 * O painel de um cliente na Meta.
 *
 * ⚠️ Uma tela so, com o CLIENTE no eixo. Antes eram duas, separadas por API, e
 * falar de um cliente exigia abrir as duas. A separacao que vale e configurar
 * contra apresentar: ligar conta e token mora em Integracoes, e aqui so se
 * apresenta.
 *
 * ⚠️ O menu da esquerda separa PAGO de ORGANICO, e dentro do organico separa
 * Instagram de Facebook. E a divisao que a agencia ja usa para falar de
 * resultado, e a unica em que os numeros se comparam entre si.
 *
 * ⚠️ Quem ROLA e a coluna da direita, e sem isso a tela nao existia: `Panel` e
 * `overflow: hidden` porque, no padrao de listagem, quem rola e o `TableArea`.
 *
 * ⚠️ Este arquivo guarda so a CASCA: cabecalho, menu, busca e a escolha do
 * bloco. Os blocos, as grades, os graficos e as pecas moram ao lado — juntos,
 * eram mil e novecentas linhas num arquivo so, e achar qualquer coisa custava
 * rolagem em vez de nome de arquivo.
 *
 * ⚠️ As metricas sao buscadas AO VIVO. Nada e guardado no banco.
 */

type Secao = "anuncios" | "instagram" | "facebook";


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
