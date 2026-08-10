import "server-only";
import { AppError } from "@/shared/errors/app-error";
import { somarDias } from "@/shared/utils/datas";
import type {
  MetricasDaPagina,
  MetricasDoPerfil,
  PaginaDisponivel,
  Periodo,
  PontoDaSerie,
  Publicacao,
} from "@/modules/insights/insights.types";

/**
 * Paginas do Facebook e perfis do Instagram.
 *
 * ⚠️ Arquivo separado do `meta.client.ts` porque e OUTRA API. Anuncio fala de
 * dinheiro e campanha, e vem pelos insights da conta de anuncio; perfil fala de
 * audiencia, e vem por `/{ig-user-id}/insights`, com outras permissoes e outro
 * token. Juntar os dois faria parecer que um erro de um afeta o outro.
 */

/**
 * ⚠️ A versão é fixada e não segue "a mais recente".
 *
 * A Meta descontinua versão a cada ~2 anos e muda formato entre elas. Sem fixar,
 * o painel quebraria sozinho num dia qualquer, sem ninguém ter tocado no código.
 * Subir a versão passa a ser uma decisão, com teste.
 *
 * ⚠️ Subida de v21.0 para v26.0 em 10/08/2026, e o motivo importa.
 *
 * A v21 é de outubro de 2024 e ainda tem data de validade em 2027, mas a Meta já
 * estava atendendo nossas chamadas com o comportamento da v26: o erro que
 * derrubou a busca das artes dizia "The ids query parameter is deprecated in
 * v26.0+", numa requisição feita para `/v21.0/`. Ou seja, a fixação tinha
 * deixado de proteger, e o pior de tudo é que ela escondia isso: o código dizia
 * uma versão e a plataforma respondia outra. Melhor rodar na versão que
 * responde de fato e saber qual é.
 */
const VERSAO = "v26.0";
const BASE = `https://graph.facebook.com/${VERSAO}`;

async function pedir<T>(caminho: string, token: string): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    // A mensagem da Meta e repassada, mas o token NUNCA. Ela costuma dizer o que
    // fazer ("sem permissao instagram_basic"), e esconder isso deixa sem saida.
    const detalhe = corpo?.error?.message ?? "A Meta recusou a consulta";
    throw new AppError("EXTERNAL_ERROR", 502, `Meta: ${detalhe}`);
  }

  return (corpo ?? {}) as T;
}

type LinhaDePagina = {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string; username?: string };
};

/**
 * As Paginas que este acesso enxerga, com o Instagram de cada uma.
 *
 * ⚠️ Pagina sem Instagram aparece na lista, com o campo vazio. Filtrar aqui
 * faria a busca parecer quebrada para quem tem Pagina mas ainda nao converteu o
 * perfil para comercial — que e justamente quem precisa ser avisado.
 */
export async function paginasDoToken(token: string): Promise<PaginaDisponivel[]> {
  const corpo = await pedir<{ data?: LinhaDePagina[] }>(
    "/me/accounts?fields=id,name,instagram_business_account{id,username}&limit=100",
    token,
  );

  return (corpo.data ?? [])
    .map((p) => ({
      pageId: p.id ?? "",
      nome: p.name ?? "Sem nome",
      igUserId: p.instagram_business_account?.id ?? null,
      igUsername: p.instagram_business_account?.username ?? null,
    }))
    .filter((p) => p.pageId.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * O token da Pagina, derivado do token do acesso.
 *
 * ⚠️ Derivado a cada consulta, e nao guardado. A Graph API exige token de PAGINA
 * para as metricas do perfil, e guardar uma copia por Pagina criaria mais um
 * segredo para renovar — o erro que acabamos de desfazer nas contas de anuncio.
 * Uma ida a mais custa pouco; um token esquecido vencendo em silencio custa
 * caro.
 */
async function tokenDaPagina(pageId: string, tokenDoAcesso: string): Promise<string> {
  const corpo = await pedir<{ data?: LinhaDePagina[] }>(
    "/me/accounts?fields=id,access_token&limit=100",
    tokenDoAcesso,
  );

  const achada = (corpo.data ?? []).find((p) => p.id === pageId);

  if (!achada?.access_token) {
    throw new AppError(
      "EXTERNAL_ERROR",
      502,
      "Este acesso não alcança mais esta Página. Renove o token com as permissões de Página.",
    );
  }

  return achada.access_token;
}

type LinhaDeMetrica = {
  name?: string;
  values?: { value?: number; end_time?: string }[];
};

/** "2026-08-09T07:00:00+0000" vira "2026-08-09". */
function diaDe(endTime: string | undefined): string {
  return (endTime ?? "").slice(0, 10);
}

function serieDe(linhas: LinhaDeMetrica[], nome: string): PontoDaSerie[] {
  const linha = linhas.find((l) => l.name === nome);

  return (linha?.values ?? [])
    .filter((v) => v.end_time)
    .map((v) => ({ dia: diaDe(v.end_time), valor: Math.round(v.value ?? 0) }));
}

/**
 * ⚠️ Os insights da Pagina aceitam NO MAXIMO 90 DIAS por requisicao.
 *
 * Documentado pela Meta: "Only 90 days of insights can be viewed at one time
 * when using the since and until parameters". Pedindo um trimestre e meio de uma
 * vez, ela recusa — e como a falha aqui e engolida de proposito para nao derrubar
 * o painel, os quatro numeros da Pagina vinham zerados sem dizer por que. Um
 * periodo longo vira varias janelas somadas.
 *
 * ⚠️ 89 dias de passo, e nao 90: a janela e inclusiva nas duas pontas, entao
 * `de` mais 90 sao 91 dias e a Meta recusa pelo mesmo motivo.
 */
const DIAS_POR_JANELA = 89;

function janelasDe90(periodo: Periodo): Periodo[] {
  const janelas: Periodo[] = [];
  let inicio = periodo.de;

  while (inicio <= periodo.ate) {
    const fim = somarDias(inicio, DIAS_POR_JANELA);
    janelas.push({ de: inicio, ate: fim < periodo.ate ? fim : periodo.ate });
    inicio = somarDias(fim, 1);
  }

  return janelas;
}

/**
 * As metricas da PROPRIA Pagina do Facebook.
 *
 * ⚠️ `fan_count` vem como CAMPO da Pagina, e nao como insight. A metrica
 * `page_fans` so aceita `period=lifetime`, o que obrigaria uma segunda chamada
 * com periodo diferente das outras tres. O campo responde a mesma pergunta com
 * uma ida a menos e sem essa pegadinha de periodo.
 *
 * ⚠️ Alcance e visualizacoes sao a SOMA dos dias, e nao o unico do periodo.
 * `page_impressions_unique` e unico DENTRO DE CADA DIA: quem viu na segunda e na
 * terca conta duas vezes na soma. O unico do periodo inteiro exigiria pedir a
 * janela fechada, que nao acompanha o filtro de data da tela. O rotulo diz "por
 * dia" para ninguem ler como pessoas distintas.
 */
async function metricasDaPagina(
  pageId: string,
  token: string,
  periodo: Periodo,
): Promise<Omit<MetricasDaPagina, "publicacoes">> {
  const perfil = await pedir<{ fan_count?: number }>(`/${pageId}?fields=fan_count`, token);

  /*
   * ⚠️ Falha aqui NAO derruba o painel. As metricas de Pagina dependem de
   * `read_insights`, que passa por App Review proprio: enquanto ele nao sair, o
   * certo e o bloco vir zerado e o resto da tela funcionar, em vez de um erro
   * que esconde o investimento e os seguidores junto.
   */
  /*
   * ⚠️ UMA requisicao por metrica, e nao as tres juntas.
   *
   * A Graph API recusa a chamada INTEIRA quando um dos nomes nao existe mais, e
   * a Meta aposentou varias metricas de Pagina em junho de 2026, entre elas o
   * alcance unico. Pedidas juntas, uma metrica morta zerava as tres — que e
   * exatamente o sintoma que os quatro numeros da Pagina tinham. Separadas, cada
   * uma cai sozinha e as outras continuam respondendo.
   *
   * ⚠️ E cada metrica tem uma LISTA de nomes, tentados em ordem. A Meta renomeia
   * metrica sem aviso (`impressions` virou `views`), e fixar um nome so faz o
   * painel morrer na proxima renomeacao. O primeiro que responder vale.
   */
  async function serieDaMetrica(nomes: string[]): Promise<PontoDaSerie[]> {
    for (const nome of nomes) {
      const respostas = await Promise.all(
        janelasDe90(periodo).map((janela) =>
          pedir<{ data?: LinhaDeMetrica[] }>(
            `/${pageId}/insights?metric=${nome}` +
              `&period=day&since=${janela.de}&until=${janela.ate}`,
            token,
          ).catch(() => null),
        ),
      );

      // Recusada em todas as janelas: o nome nao serve, tenta o proximo.
      if (respostas.every((r) => r == null)) continue;

      /*
       * ⚠️ Junta as linhas de TODAS as janelas. Cada janela de 90 dias devolve
       * uma linha para a metrica, entao pegar a primeira traria so o primeiro
       * trimestre e o resto sumiria em silencio.
       */
      const serie = respostas
        .flatMap((r) => r?.data ?? [])
        .filter((l) => l.name === nome)
        .flatMap((l) => serieDe([l], nome))
        .sort((a, b) => a.dia.localeCompare(b.dia));

      if (serie.length > 0) return serie;
    }

    return [];
  }

  const [alcancePorDia, visualizacoesPorDia, engajamentoPorDia] = await Promise.all([
    // Alcance unico morreu em junho de 2026; o total de exibicoes sobreviveu.
    serieDaMetrica(["page_impressions_unique", "page_impressions", "page_views_total"]),
    serieDaMetrica(["page_views_total", "page_impressions"]),
    serieDaMetrica(["page_post_engagements", "page_engaged_users"]),
  ]);

  const total = (serie: PontoDaSerie[]) => serie.reduce((s, p) => s + p.valor, 0);

  return {
    fas: Math.round(perfil.fan_count ?? 0),
    alcance: total(alcancePorDia),
    visualizacoes: total(visualizacoesPorDia),
    engajamento: total(engajamentoPorDia),
    /*
     * ⚠️ As janelas de 90 dias sao CONCATENADAS na serie e somadas so no total.
     * Elas nao se sobrepoem, entao juntar os dias em ordem da a serie do periodo
     * inteiro — e era essa serie que existia e era jogada fora.
     */
    alcancePorDia,
    visualizacoesPorDia,
    engajamentoPorDia,
  };
}

/**
 * As metricas do perfil do Instagram daquela Pagina.
 *
 * ⚠️ A primeira chamada traz o TOTAL de seguidores agora — um retrato, sem
 * historico. A segunda traz a serie diaria de ganho, que a Meta so guarda por
 * **30 dias**. Nao ha como reconstruir o total de um dia passado a partir das
 * duas: pedir 90 dias devolve os ultimos 30, e a tela precisa dizer isso em vez
 * de mostrar um grafico curto sem explicacao.
 */
async function metricasDoPerfil(
  igUserId: string,
  igUsername: string | null,
  token: string,
  periodo: Periodo,
): Promise<MetricasDoPerfil> {
  /*
   * ⚠️ Disparado ANTES do `await` do perfil, e colhido no fim. As tres chamadas
   * desta funcao nao dependem umas das outras; em serie, a tela esperaria a soma
   * de tres latencias da Meta, que nao e pequena nem previsivel.
   */
  const publicacoes = publicacoesDoPerfil(igUserId, token, periodo);

  const perfil = await pedir<{ followers_count?: number; media_count?: number }>(
    `/${igUserId}?fields=followers_count,media_count`,
    token,
  );

  /*
   * ⚠️ `follower_count` (singular) e o GANHO do dia, e nao o total. O nome quase
   * igual a `followers_count` do perfil e uma armadilha da propria API: trocar um
   * pelo outro faz o grafico mostrar dezenas de milhares onde deveria mostrar
   * dezenas.
   */
  /*
   * ⚠️ Separadas pela mesma razao das metricas de Pagina: pedidas juntas, uma
   * metrica que a Meta aposentou derruba a outra junto. E `follower_count` e a
   * mais fragil das duas, porque nao existe abaixo de 100 seguidores — pedida no
   * mesmo pacote, ela levava o alcance embora em todo perfil pequeno.
   */
  const umaMetrica = async (nome: string): Promise<PontoDaSerie[]> => {
    const corpo = await pedir<{ data?: LinhaDeMetrica[] }>(
      `/${igUserId}/insights?metric=${nome}&period=day` +
        `&since=${periodo.de}&until=${periodo.ate}`,
      token,
    ).catch(() => ({ data: [] as LinhaDeMetrica[] }));

    return serieDe(corpo.data ?? [], nome);
  };

  const [ganhoPorDia, alcancePorDia] = await Promise.all([
    umaMetrica("follower_count"),
    umaMetrica("reach"),
  ]);

  return {
    publicacoesDoPeriodo: await publicacoes,
    alcancePorDia,
    igUsername,
    seguidores: Math.round(perfil.followers_count ?? 0),
    publicacoes: Math.round(perfil.media_count ?? 0),
    ganhoNoPeriodo: ganhoPorDia.reduce((s, p) => s + p.valor, 0),
    alcanceNoPeriodo: alcancePorDia.reduce((s, p) => s + p.valor, 0),
    ganhoPorDia,
    /*
     * ⚠️ A tela precisa saber se a serie veio CORTADA, e nao so quantos pontos
     * chegaram. Sem isso, um mes de dados faltando parece conta parada em vez de
     * limite da API.
     *
     * ⚠️ O motivo do corte NAO esta confirmado. A documentacao da Meta atribui a
     * janela de 30 dias ao `online_followers`, e do `follower_count` diz apenas
     * que ele nao existe abaixo de 100 seguidores e que dado indisponivel volta
     * como conjunto VAZIO, sem erro. Por isso a deteccao e por comparacao com o
     * inicio pedido, e nao por uma regra de 30 dias escrita no codigo: assim ela
     * continua certa qualquer que seja o limite real.
     */
    serieCortada: ganhoPorDia.length > 0 && ganhoPorDia[0].dia > periodo.de,
  };
}

type LinhaDeMidia = {
  id?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

/** Quantas publicacoes o painel mostra. Uma grade, e nao um acervo. */
const PUBLICACOES_NO_PAINEL = 6;

/**
 * ⚠️ A legenda e cortada AQUI, no servidor.
 *
 * Legenda de Instagram passa de dois mil caracteres com facilidade, e cinquenta
 * publicacoes viriam com todas elas na resposta. O painel mostra duas linhas: o
 * resto so engordaria o JSON que atravessa a rede para ser escondido por CSS.
 */
function legendaCurta(bruta: string | undefined): string | null {
  const limpa = (bruta ?? "").replace(/\s+/g, " ").trim();
  if (limpa.length === 0) return null;
  return limpa.length <= 180 ? limpa : `${limpa.slice(0, 180)}…`;
}

/**
 * As publicacoes do perfil no periodo, das mais reagidas para as menos.
 *
 * ⚠️ A previa de VIDEO vem em `thumbnail_url`, e nao em `media_url`. Naquele vem
 * o arquivo do video: usado como imagem, ele nao pinta nada e a grade fica com
 * buracos. Carrossel entrega a capa em `media_url`, entao a ordem certa e
 * miniatura primeiro e arquivo depois.
 *
 * ⚠️ Ordenado por curtida mais comentario, e nao por data. A pergunta desta
 * grade e "o que funcionou", e nao "o que saiu": a ordem cronologica ja esta no
 * proprio Instagram, e repeti-la aqui nao acrescentaria nada.
 *
 * ⚠️ As URLs de imagem sao do CDN da Meta e EXPIRAM em algumas horas. Elas
 * servem para pintar a tela agora e nao podem ser guardadas: uma copia no banco
 * viraria imagem quebrada sem ninguem ter mexido em nada.
 */
async function publicacoesDoPerfil(
  igUserId: string,
  token: string,
  periodo: Periodo,
): Promise<Publicacao[]> {
  const corpo = await pedir<{ data?: LinhaDeMidia[] }>(
    `/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,` +
      `timestamp,like_count,comments_count` +
      `&since=${periodo.de}&until=${periodo.ate}&limit=50`,
    token,
  ).catch(() => ({ data: [] as LinhaDeMidia[] }));

  return (corpo.data ?? [])
    .filter((m) => m.id && m.permalink)
    .map((m) => {
      const curtidas = Math.round(m.like_count ?? 0);
      const comentarios = Math.round(m.comments_count ?? 0);

      return {
        id: m.id!,
        legenda: legendaCurta(m.caption),
        tipo:
          m.media_type === "VIDEO"
            ? ("VIDEO" as const)
            : m.media_type === "CAROUSEL_ALBUM"
              ? ("CARROSSEL" as const)
              : ("IMAGEM" as const),
        imagem: m.thumbnail_url ?? m.media_url ?? null,
        link: m.permalink!,
        data: (m.timestamp ?? "").slice(0, 10),
        curtidas,
        comentarios,
        // ⚠️ O Instagram NAO expoe compartilhamento por publicacao. Nulo diz
        // "nao existe aqui"; zero diria "ninguem compartilhou", que e mentira.
        compartilhamentos: null,
      };
    })
    .sort((a, b) => b.curtidas + b.comentarios - (a.curtidas + a.comentarios))
    .slice(0, PUBLICACOES_NO_PAINEL);
}

type LinhaDePost = {
  id?: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  attachments?: { data?: { media_type?: string }[] };
};

/**
 * As publicacoes da PAGINA no periodo.
 *
 * ⚠️ Consulta PROPRIA, e nao a lista do Instagram reaproveitada. O
 * cross-posting do Instagram para o Facebook e uma opcao por publicacao, e nao
 * um espelho: mostrar a lista do Instagram aqui apresentaria como publicacao do
 * Facebook coisas que talvez nunca tenham saido la, com as curtidas do outro
 * lado no rodape. Isso e inventar dado, e ninguem percebe numa reuniao.
 *
 * ⚠️ `reactions` e `comments` vem com `summary(total_count)` e `limit(0)`. Sem o
 * limite zero, a Meta manda a lista inteira de quem reagiu junto do total: e o
 * total que a tela usa, e a lista so engordaria a resposta.
 */
async function publicacoesDaPagina(
  pageId: string,
  token: string,
  periodo: Periodo,
): Promise<Publicacao[]> {
  const corpo = await pedir<{ data?: LinhaDePost[] }>(
    `/${pageId}/posts?fields=id,message,created_time,permalink_url,full_picture,shares,` +
      `attachments{media_type},reactions.summary(total_count).limit(0),` +
      `comments.summary(total_count).limit(0)` +
      `&since=${periodo.de}&until=${periodo.ate}&limit=50`,
    token,
  ).catch(() => ({ data: [] as LinhaDePost[] }));

  return (corpo.data ?? [])
    .filter((p) => p.id && p.permalink_url)
    .map((p) => {
      const midia = p.attachments?.data?.[0]?.media_type;

      return {
        id: p.id!,
        legenda: legendaCurta(p.message),
        tipo:
          midia === "video"
            ? ("VIDEO" as const)
            : midia === "album"
              ? ("CARROSSEL" as const)
              : ("IMAGEM" as const),
        // ⚠️ `full_picture` e a previa que a propria Meta monta, inclusive de
        // video. Nao ha `thumbnail_url` do lado da Pagina.
        imagem: p.full_picture ?? null,
        link: p.permalink_url!,
        data: (p.created_time ?? "").slice(0, 10),
        curtidas: Math.round(p.reactions?.summary?.total_count ?? 0),
        comentarios: Math.round(p.comments?.summary?.total_count ?? 0),
        compartilhamentos: Math.round(p.shares?.count ?? 0),
      };
    })
    .sort(
      (a, b) =>
        b.curtidas +
        b.comentarios +
        (b.compartilhamentos ?? 0) -
        (a.curtidas + a.comentarios + (a.compartilhamentos ?? 0)),
    )
    .slice(0, PUBLICACOES_NO_PAINEL);
}

/**
 * Pagina e perfil de uma vez.
 *
 * ⚠️ O token de Pagina e derivado UMA vez e serve as duas. Chamando as duas
 * metades separadamente, cada uma varreria `/me/accounts` de novo — duas idas a
 * Meta so para reencontrar a mesma credencial.
 *
 * ⚠️ `perfil` nulo e caso normal, e nao erro: Pagina sem Instagram comercial
 * existe e continua tendo metricas proprias. Recusar a Pagina inteira por causa
 * disso esconderia dado que a pessoa tem.
 */
export async function painelDaPagina(
  pageId: string,
  igUserId: string | null,
  igUsername: string | null,
  tokenDoAcesso: string,
  periodo: Periodo,
): Promise<{ pagina: MetricasDaPagina; perfil: MetricasDoPerfil | null }> {
  const token = await tokenDaPagina(pageId, tokenDoAcesso);

  const [pagina, publicacoes, perfil] = await Promise.all([
    metricasDaPagina(pageId, token, periodo),
    publicacoesDaPagina(pageId, token, periodo),
    igUserId ? metricasDoPerfil(igUserId, igUsername, token, periodo) : Promise.resolve(null),
  ]);

  return { pagina: { ...pagina, publicacoes }, perfil };
}
