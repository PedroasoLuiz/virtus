"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  EmptyRow,
  PanelTabs,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { CartaoDeIndicador, FaixaDeCartoes } from "@/components/ui/cartao-de-indicador";
import { formatar, formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { rotuloDaFamilia } from "@/shared/domain/insights";
import type { PainelDoCliente } from "@/modules/insights/insights.types";
import { ParDeGraficos } from "./graficos";
import { Criativos, Publicacoes } from "./midia";
import { GLOSSARIO, UNIDADE, ajudaDaFamilia } from "./glossario";
import {
  Bloco,
  CORTADO,
  IconeCoracao,
  IconeDaFamilia,
  IconeDinheiro,
  IconeEtiqueta,
  IconeOlho,
  IconeOnda,
  IconePessoas,
  NUM,
  Rolavel,
  Vao,
  comSinal,
  curto,
  curtoEmReais,
  dataBR,
  inteiro,
  plural,
  porcento,
} from "./pecas";

/** Um bloco por origem: o pago, o Instagram e a Pagina. */




type AbaDeAnuncios = "Criativos" | "Campanhas";
const ABAS_DE_ANUNCIOS: AbaDeAnuncios[] = ["Criativos", "Campanhas"];


export function BlocoDeAnuncios({ painel }: { painel: PainelDoCliente }) {
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


export function BlocoDeInstagram({ painel }: { painel: PainelDoCliente }) {
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


export function BlocoDaPagina({ painel }: { painel: PainelDoCliente }) {
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
