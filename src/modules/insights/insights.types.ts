import type { DataISO } from "@/shared/utils/datas";
import type { Centavos } from "@/shared/utils/money";
import type { FamiliaDeResultado } from "@/shared/domain/insights";

/** Contratos de dominio do painel de anuncios. */

/**
 * Uma conta de anuncio ligada a um cliente.
 *
 * ⚠️ O TOKEN nao aparece aqui, e nao deve aparecer em nenhum tipo que a tela
 * enxergue. Ele vive cifrado no vault e so e lido no servidor, na hora de
 * chamar a Graph API. Um token nesta struct viajaria para o navegador no
 * primeiro `JSON.stringify` distraido.
 */
export type Conexao = {
  id: number;
  adAccountId: string;
  nome: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  /** De qual acesso esta conta pendura. O token vive la, nao aqui. */
  acessoId: number;
  ativo: boolean;
};

/**
 * Um acesso a Meta: um login, um token, uma validade.
 *
 * ⚠️ Isto e o que se renova. Antes o token era copiado por conta de anuncio, e a
 * renovacao so alcancava a conta que alguem abrisse — as outras venciam com a
 * copia velha, e virava "umas funcionam e outras nao".
 *
 * ⚠️ Sem `token` no tipo, pelo mesmo motivo de sempre: um `JSON.stringify`
 * distraido em qualquer camada o levaria ao navegador.
 */
export type Acesso = {
  id: number;
  nome: string | null;
  /** Quando o token perde a validade. A Meta devolve isso na troca. */
  expiraEm: string | null;
  ativo: boolean;
};

/** O periodo que a tela pede. A Meta chama isso de `time_range`. */
export type Periodo = { de: DataISO; ate: DataISO };

/**
 * Os numeros do topo.
 *
 * ⚠️ Dinheiro em CENTAVOS, como todo o resto do sistema. A Graph API devolve
 * `"1234.56"` em texto: converter na borda e a unica forma de o painel somar
 * igual ao financeiro.
 */
export type ResumoDeAnuncios = {
  investido: Centavos;
  impressoes: number;
  cliques: number;
  /** Custo por clique. Derivado, e nao lido da API: ela nem sempre devolve. */
  custoPorClique: Centavos;
  /** Cliques sobre impressoes, em pontos percentuais com uma casa. */
  ctr: number;
  /**
   * Quantos resultados da familia que a campanha buscava.
   *
   * ⚠️ NAO e a soma de compra + cadastro + conversa. Cem conversas e cem compras
   * sao coisas diferentes, e somadas viram duzentos de uma unidade que nao
   * existe. `familiaDeResultado` diz de qual delas este numero e.
   */
  resultados: number;
  familiaDeResultado: FamiliaDeResultado | null;
  /** O detalhe, para a tela poder dizer o que mais aconteceu alem do principal. */
  resultadosPorFamilia: Partial<Record<FamiliaDeResultado, number>>;
  custoPorResultado: Centavos;
};

/** Uma campanha dentro do periodo. */
export type CampanhaDoPeriodo = {
  id: string;
  nome: string;
  /** De que conta de anuncio ela veio. Um cliente pode ter mais de uma. */
  conta: string;
  investido: Centavos;
  impressoes: number;
  cliques: number;
  resultados: number;
  ctr: number;
  /**
   * O que ESTA campanha gerou de cada familia.
   *
   * ⚠️ Existe para o custo por resultado poder dividir o investimento das
   * campanhas que geraram aquela familia, e nao o investimento da conta inteira.
   * Ver o `PainelDoCliente`.
   */
  porFamilia: Partial<Record<FamiliaDeResultado, number>>;
};

/**
 * O que uma conta de anuncio rendeu no periodo, no total e dia a dia.
 *
 * ⚠️ Os dois vem da MESMA chamada, com `time_increment=1`. O total e a soma das
 * linhas diarias: pedindo em duas consultas, o topo da tela e o grafico logo
 * abaixo divergiriam, porque a Meta recorta conversao de forma diferente em cada
 * janela.
 */
export type DesempenhoDeAnuncios = {
  resumo: ResumoDeAnuncios;
  /**
   * ⚠️ As quatro series saem da MESMA resposta. A linha diaria ja traz gasto,
   * impressao, clique e acoes: uma consulta por grafico multiplicaria a
   * latencia da tela para desenhar dado que ja estava na mao.
   */
  investidoPorDia: PontoDaSerie[];
  resultadosPorDia: PontoDaSerie[];
  impressoesPorDia: PontoDaSerie[];
  cliquesPorDia: PontoDaSerie[];
};

/**
 * Uma conta de anuncio que o token alcanca, ainda NAO conectada.
 *
 * ⚠️ Nao e uma `Conexao`. Ela nao tem id nosso, nem cliente, nem token: e o que
 * a Meta respondeu quando perguntamos "o que este acesso ve". Misturar os dois
 * tipos faria a tela tratar candidata como coisa gravada.
 */
export type ContaDisponivel = {
  adAccountId: string;
  nome: string;
  ativa: boolean;
  moeda: string | null;
};

/**
 * Uma Pagina do Facebook que o acesso enxerga, ainda NAO ligada.
 *
 * ⚠️ `igUserId` nulo e caso normal, e nao erro: Pagina sem Instagram comercial
 * existe. A tela mostra assim mesmo, porque quem precisa converter o perfil e
 * justamente quem nao vai entender a ausencia.
 */
export type PaginaDisponivel = {
  pageId: string;
  nome: string;
  igUserId: string | null;
  igUsername: string | null;
};

/** Uma Pagina ligada, com o perfil do Instagram dela. */
export type Pagina = {
  id: number;
  pageId: string;
  nome: string | null;
  igUserId: string | null;
  igUsername: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  acessoId: number;
  ativo: boolean;
};

/** Um dia da serie. `dia` em ISO, para ordenar como texto. */
export type PontoDaSerie = { dia: string; valor: number };

/**
 * As metricas da propria Pagina do Facebook.
 *
 * ⚠️ `alcance` e `visualizacoes` sao SOMA DOS DIAS, e nao pessoas distintas no
 * periodo: a Meta entrega o unico de cada dia, e quem viu em dois dias conta
 * duas vezes. O rotulo na tela precisa dizer "por dia" por causa disso.
 */
export type MetricasDaPagina = {
  fas: number;
  alcance: number;
  visualizacoes: number;
  engajamento: number;
  /** As mesmas tres, dia a dia. Ja vinham na resposta e so eram somadas. */
  alcancePorDia: PontoDaSerie[];
  visualizacoesPorDia: PontoDaSerie[];
  engajamentoPorDia: PontoDaSerie[];
  /**
   * As publicacoes da PROPRIA Pagina.
   *
   * ⚠️ Consulta propria, e nao a lista do Instagram. O cross-posting e opcao por
   * publicacao, e nao espelho: reaproveitar a outra lista apresentaria como
   * publicacao do Facebook coisas que talvez nunca tenham saido la.
   */
  publicacoes: ResumoDePublicacoes;
};

/**
 * Uma publicacao do perfil, com a previa da arte.
 *
 * ⚠️ `imagem` e uma URL do CDN da Meta e EXPIRA em algumas horas. Ela serve para
 * pintar a tela agora e nao pode ser guardada: uma copia no banco viraria imagem
 * quebrada sem ninguem ter mexido em nada.
 */
export type Publicacao = {
  id: string;
  legenda: string | null;
  tipo: "IMAGEM" | "VIDEO" | "CARROSSEL";
  /** A previa. De video vem a miniatura, e nao o arquivo. */
  imagem: string | null;
  link: string;
  data: string;
  curtidas: number;
  comentarios: number;
  /** So a Pagina do Facebook tem. O Instagram nao expoe compartilhamento. */
  compartilhamentos: number | null;
};

/**
 * Um anuncio do periodo, com a arte dele.
 *
 * ⚠️ E o equivalente pago da publicacao: responde "qual PECA funcionou", que a
 * tabela de campanhas nao responde. Campanha e o orcamento; o anuncio e o que a
 * pessoa viu.
 *
 * ⚠️ `imagem` e URL do CDN da Meta e EXPIRA, como a das publicacoes. Nunca
 * guardar.
 */
export type AnuncioDoPeriodo = {
  id: string;
  nome: string;
  campanha: string;
  conta: string;
  imagem: string | null;
  investido: Centavos;
  impressoes: number;
  cliques: number;
  resultados: number;
  ctr: number;
  /** Mesma razao da campanha: a grade conta a familia do CLIENTE, nao a do anuncio. */
  porFamilia: Partial<Record<FamiliaDeResultado, number>>;
};

/**
 * As publicacoes de um periodo: os totais de TODAS, e as seis da grade.
 *
 * ⚠️ Os dois vem juntos de proposito. A grade mostra seis; a contagem e as
 * reacoes falam do periodo inteiro. Devolvendo so as seis, a tela contava em
 * cima delas e anunciava "6 publicacoes" num mes com quarenta.
 */
export type ResumoDePublicacoes = {
  quantidade: number;
  curtidas: number;
  comentarios: number;
  /** As mais reagidas, para a grade. */
  melhores: Publicacao[];
};

/** As metricas do perfil do Instagram daquela Pagina. */
export type MetricasDoPerfil = {
  igUsername: string | null;
  /** O total AGORA. E um retrato: a Meta nao guarda o total de dias passados. */
  seguidores: number;
  /**
   * Quantas publicacoes o perfil tem AO TODO, e nao no periodo.
   *
   * ⚠️ Nome diferente do `publicacoes` logo abaixo de proposito: aquele e o
   * recorte do periodo. Com o mesmo nome, os dois numeros se confundiam na tela
   * e ninguem sabia qual estava lendo.
   */
  publicacoesNoPerfil: number;
  ganhoNoPeriodo: number;
  alcanceNoPeriodo: number;
  ganhoPorDia: PontoDaSerie[];
  /** Ja vinha na resposta e so era somada. */
  alcancePorDia: PontoDaSerie[];
  /** Se a Meta devolveu menos dias que o pedido, por causa da janela curta. */
  serieCortada: boolean;
  /** Os totais do periodo e as mais reagidas para a grade. */
  publicacoes: ResumoDePublicacoes;
};

/**
 * O painel de UM CLIENTE: tudo que a Meta sabe sobre ele, junto.
 *
 * ⚠️ `anuncios` e `perfil` sao anulaveis de proposito, e nao um erro a evitar.
 * Existe cliente com conta de anuncio e sem Pagina, e o contrario: exigir os
 * dois deixaria os dois de fora da tela em vez de mostrar a metade que existe.
 *
 * ⚠️ As contas de anuncio de um cliente sao SOMADAS num painel so. Um seletor de
 * conta dentro do cliente traria de volta a separacao por API, que e exatamente
 * o modelo que esta tela veio desfazer. A tabela de campanhas carrega o nome da
 * conta para desempatar.
 */
export type PainelDoCliente = {
  cliente: { chave: string; nome: string };
  periodo: Periodo;
  /** As contas de anuncio somadas, nomeadas para a tela poder dizer quais. */
  contas: string[];
  resumo: ResumoDeAnuncios | null;
  /**
   * Quanto foi investido nas campanhas que geraram a familia dominante.
   *
   * ⚠️ NAO e o investimento da conta. Uma conta com campanhas de engajamento e
   * duas conversas soltas dividia o gasto INTEIRO pelas duas conversas e
   * anunciava "R$ 101,82 por conversa" — um numero que nao descreve nada e que
   * ninguem pode mostrar a um cliente. O custo por resultado so faz sentido
   * sobre o dinheiro que estava perseguindo aquele resultado.
   */
  investidoDoResultado: Centavos;
  investidoPorDia: PontoDaSerie[];
  resultadosPorDia: PontoDaSerie[];
  impressoesPorDia: PontoDaSerie[];
  cliquesPorDia: PontoDaSerie[];
  campanhas: CampanhaDoPeriodo[];
  anuncios: AnuncioDoPeriodo[];
  paginaNome: string | null;
  pagina: MetricasDaPagina | null;
  perfil: MetricasDoPerfil | null;
  /**
   * O que falhou sem derrubar o resto.
   *
   * ⚠️ Uma conta que a Meta recusou NAO pode zerar o painel inteiro do cliente.
   * Somando so o que respondeu e dizendo o que faltou, a tela continua util e
   * ninguem apresenta um numero incompleto achando que e o total.
   */
  falhas: string[];
};
