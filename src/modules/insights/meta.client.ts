import "server-only";
import { AppError } from "@/shared/errors/app-error";
import { deReais, type Centavos } from "@/shared/utils/money";
import {
  familiaDaAcao,
  familiaDominante,
  type FamiliaDeResultado,
} from "@/shared/domain/insights";
import type {
  AnuncioDoPeriodo,
  CampanhaDoPeriodo,
  ContaDisponivel,
  DesempenhoDeAnuncios,
  Periodo,
  PontoDaSerie,
  ResumoDeAnuncios,
} from "@/modules/insights/insights.types";

/**
 * Cliente da Graph API da Meta.
 *
 * ⚠️ `server-only`. O token nunca chega ao navegador: a tela chama a NOSSA rota,
 * e é ela que chama a Meta. Um `fetch` para a Graph API a partir do componente
 * cliente exporia o token de anúncio do cliente no DevTools de qualquer pessoa
 * com a tela aberta.
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

/**
 * As métricas que pedimos.
 *
 * ⚠️ Lista explícita, e não tudo. A Graph API cobra tempo por campo: pedir o
 * conjunto inteiro multiplica a latência e ainda traz dezenas de colunas que a
 * tela não mostra.
 *
 * ⚠️ `ctr` NÃO é pedido, apesar de existir. Ele é derivado aqui a partir de
 * cliques e impressões, e precisa ser: com uma linha por dia, o CTR do período é
 * a razão das somas, e a coluna da Meta traria a razão de cada dia.
 */
const CAMPOS = "spend,impressions,clicks,actions";

/** O que a Meta devolve por linha. Tudo texto, inclusive número. */
type LinhaDaApi = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  /** Só vem com `time_increment`: o dia daquela linha. */
  date_start?: string;
};

/**
 * "1234.56" vira centavos.
 *
 * ⚠️ Passa por `deReais`, que é a porta única do double para centavos no
 * sistema. Fazer `Math.round(n * 100)` aqui abriria um segundo caminho, e é
 * exatamente esse tipo de duplicação que produziu o `-0,00` do saldo.
 */
function paraCentavos(bruto: string | undefined): Centavos {
  const n = Number(bruto ?? 0);
  return deReais(Number.isFinite(n) ? n : 0);
}

function paraInteiro(bruto: string | undefined): number {
  const n = Number(bruto ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Quanto a linha gerou de cada FAMÍLIA de resultado.
 *
 * ⚠️ "Resultado" não é um campo, e também não é uma soma. É o que a conta está
 * otimizando, e cada uma otimiza uma coisa. Antes somávamos compra, cadastro e
 * conversa juntos num número só: cem conversas e cem compras viravam duzentos
 * "resultados", que é uma quantidade sem unidade. Agora cada família é contada
 * em separado e o painel mostra a que a campanha estava buscando.
 *
 * ⚠️ Ação fora das cinco famílias é IGNORADA, e continua sendo de propósito:
 * curtida, visualização de vídeo e comentário são vaidade, e entram no total só
 * para inflá-lo.
 */
function contarPorFamilia(
  acoes: LinhaDaApi["actions"],
): Partial<Record<FamiliaDeResultado, number>> {
  const porFamilia: Partial<Record<FamiliaDeResultado, number>> = {};
  if (!acoes) return porFamilia;

  for (const a of acoes) {
    const familia = familiaDaAcao(a.action_type);
    if (familia == null) continue;
    porFamilia[familia] = (porFamilia[familia] ?? 0) + paraInteiro(a.value);
  }

  return porFamilia;
}

function somarFamilias(
  destino: Partial<Record<FamiliaDeResultado, number>>,
  parcela: Partial<Record<FamiliaDeResultado, number>>,
): void {
  for (const [familia, valor] of Object.entries(parcela)) {
    const f = familia as FamiliaDeResultado;
    destino[f] = (destino[f] ?? 0) + (valor ?? 0);
  }
}

/**
 * ⚠️ Genérica porque nem toda resposta da Graph API é `{ data: [...] }`.
 *
 * O multi-get (`/?ids=`) devolve um objeto com um id por chave. Uma segunda
 * função de requisição para atender esse formato duplicaria o tratamento de erro
 * — que é onde mora a regra de nunca vazar o token.
 */
async function pedirBruto<T>(caminho: string, token: string): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
    // ⚠️ Sem cache do Next: a resposta depende do token, e um cache
    // compartilhado serviria dado de uma conta para outra.
    cache: "no-store",
  });

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    /*
     * ⚠️ A mensagem da Meta é repassada, mas o token NUNCA.
     *
     * Ela costuma dizer o que fazer ("token expirado", "sem permissão
     * ads_read"), e esconder isso deixaria quem usa sem saída. O que não pode
     * vazar é a credencial, e ela não está na mensagem.
     */
    const detalhe = corpo?.error?.message ?? "A Meta recusou a consulta";
    throw new AppError("EXTERNAL_ERROR", 502, `Meta: ${detalhe}`);
  }

  return (corpo ?? {}) as T;
}

/** O formato comum: uma lista de linhas de insight. */
function pedir(caminho: string, token: string): Promise<{ data?: LinhaDaApi[] }> {
  return pedirBruto<{ data?: LinhaDaApi[] }>(caminho, token);
}

/** O `time_range` que a Graph API espera, como JSON na query. */
function janela(periodo: Periodo): string {
  return encodeURIComponent(JSON.stringify({ since: periodo.de, until: periodo.ate }));
}

/**
 * As contas de anúncio que este token alcança.
 *
 * ⚠️ É o que o token vê, e não o que a Meta tem. Se uma conta do cliente não
 * aparecer aqui, o problema é acesso no Business Manager dele, e não no Vpay —
 * saber disso antes evita procurar bug onde não há.
 */
export async function contasDoToken(token: string): Promise<ContaDisponivel[]> {
  const resposta = await fetch(
    `${BASE}/me/adaccounts?fields=id,name,account_status,currency&limit=200`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const detalhe = corpo?.error?.message ?? "A Meta recusou a consulta";
    throw new AppError("EXTERNAL_ERROR", 502, `Meta: ${detalhe}`);
  }

  type LinhaDeConta = {
    id?: string;
    name?: string;
    account_status?: number;
    currency?: string;
  };

  return ((corpo?.data ?? []) as LinhaDeConta[])
    .map((c) => ({
      adAccountId: c.id ?? "",
      nome: c.name ?? "Sem nome",
      /*
       * ⚠️ 1 é ACTIVE no vocabulário da Meta, e o resto é desativada, fechada ou
       * com pendência de pagamento. A tela mostra todas mesmo assim: conta
       * pausada tem histórico, e escondê-la faria alguém concluir que perdeu o
       * acesso quando só parou de veicular.
       */
      ativa: c.account_status === 1,
      moeda: c.currency ?? null,
    }))
    .filter((c) => c.adAccountId.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Fecha os totais a partir das partes já somadas.
 *
 * ⚠️ Existe uma vez só porque a conta e a campanha precisam da MESMA regra de
 * derivação. Duplicada, um dos dois lados acabaria com uma fórmula levemente
 * diferente e a soma das campanhas deixaria de bater com o topo da tela.
 */
export function fecharResumo(
  investido: Centavos,
  impressoes: number,
  cliques: number,
  porFamilia: Partial<Record<FamiliaDeResultado, number>>,
): ResumoDeAnuncios {
  /*
   * ⚠️ A família é escolhida uma vez, sobre o TOTAL, e não linha a linha. Por
   * dia, um dia sem compra escolheria "cliques" e o gráfico trocaria de unidade
   * no meio da série.
   */
  const familia = familiaDominante(porFamilia);
  const resultados = familia == null ? 0 : (porFamilia[familia] ?? 0);

  return {
    investido,
    impressoes,
    cliques,
    familiaDeResultado: familia,
    resultadosPorFamilia: porFamilia,
    /*
     * ⚠️ Derivados calculados sobre os TOTAIS, nunca pela média dos dias.
     *
     * Média de razão não é a razão das somas: um dia com 1 impressão e 1 clique
     * vale 100% de CTR e puxaria o mês inteiro sozinho. O mesmo vale para custo
     * por resultado, onde um dia barato com um resultado só distorce tudo.
     *
     * ⚠️ Divisão por zero tratada: conta sem clique no período é o caso normal
     * de quem acabou de subir campanha, e `Infinity` chegaria à tela.
     */
    custoPorClique: (cliques > 0 ? Math.round(investido / cliques) : 0) as Centavos,
    ctr: impressoes > 0 ? Number(((cliques / impressoes) * 100).toFixed(1)) : 0,
    resultados,
    custoPorResultado: (resultados > 0 ? Math.round(investido / resultados) : 0) as Centavos,
  };
}

/**
 * O desempenho de uma conta no período, dia a dia e no total.
 *
 * ⚠️ `time_increment=1` é o que faz a Meta devolver uma linha POR DIA. Sem ele
 * ela devolve uma linha só, com o total do período, e não existe série temporal
 * do lado do dinheiro — que é justamente o gráfico de investimento.
 *
 * ⚠️ Os totais saem da SOMA das linhas diárias, e não de uma segunda chamada
 * sem `time_increment`. Duas consultas dariam dois números para o mesmo fato, e
 * eles divergem: a Meta atribui conversão à data do clique, e o recorte diário
 * arredonda diferente do recorte cheio. Um topo que não bate com o gráfico logo
 * abaixo é pior que qualquer imprecisão.
 *
 * ⚠️ Dia sem veiculação NÃO vem na resposta. A série fica com buracos de
 * propósito: inventar zero aqui afirmaria que a conta rodou e não gastou, que é
 * outra coisa. Quem desenha decide como mostrar a falta.
 */
export async function desempenhoDaConta(
  adAccountId: string,
  token: string,
  periodo: Periodo,
): Promise<DesempenhoDeAnuncios> {
  const corpo = await pedir(
    `/${adAccountId}/insights?fields=${CAMPOS}` +
      `&time_range=${janela(periodo)}&time_increment=1&limit=500`,
    token,
  );

  const linhas = corpo.data ?? [];

  let investido = 0;
  let impressoes = 0;
  let cliques = 0;
  const porFamilia: Partial<Record<FamiliaDeResultado, number>> = {};
  const familiasPorDia: { dia: string; porFamilia: Partial<Record<FamiliaDeResultado, number>> }[] =
    [];

  /*
   * ⚠️ QUATRO series da MESMA resposta, e nao quatro consultas.
   *
   * A linha diaria ja traz gasto, impressao, clique e acoes: separar cada uma
   * numa serie custa uma passada no laco e nenhuma ida a mais a Meta. Pedir um
   * grafico por metrica multiplicaria a latencia da tela por quatro para
   * desenhar dado que ja estava na mao.
   */
  const investidoPorDia: PontoDaSerie[] = [];
  const impressoesPorDia: PontoDaSerie[] = [];
  const cliquesPorDia: PontoDaSerie[] = [];

  for (const l of linhas) {
    const gasto = paraCentavos(l.spend);
    const vistas = paraInteiro(l.impressions);
    const toques = paraInteiro(l.clicks);
    const rendeu = contarPorFamilia(l.actions);

    investido += gasto;
    impressoes += vistas;
    cliques += toques;
    somarFamilias(porFamilia, rendeu);

    if (l.date_start) {
      investidoPorDia.push({ dia: l.date_start, valor: gasto });
      impressoesPorDia.push({ dia: l.date_start, valor: vistas });
      cliquesPorDia.push({ dia: l.date_start, valor: toques });
      familiasPorDia.push({ dia: l.date_start, porFamilia: rendeu });
    }
  }

  const resumo = fecharResumo(investido as Centavos, impressoes, cliques, porFamilia);

  /*
   * ⚠️ A série diária conta a MESMA família do total, e não o que cada dia teve
   * de mais numeroso. Escolhendo por dia, um dia sem compra cairia para cliques
   * e a linha trocaria de unidade no meio do gráfico, sem nada dizendo isso.
   */
  const resultadosPorDia: PontoDaSerie[] = familiasPorDia.map((d) => ({
    dia: d.dia,
    valor: resumo.familiaDeResultado == null ? 0 : (d.porFamilia[resumo.familiaDeResultado] ?? 0),
  }));

  // Ordenado aqui: a ordem da resposta da Meta não é contrato dela.
  const porDia = (serie: PontoDaSerie[]) =>
    serie.sort((a, b) => a.dia.localeCompare(b.dia));

  return {
    resumo,
    investidoPorDia: porDia(investidoPorDia),
    resultadosPorDia: porDia(resultadosPorDia),
    impressoesPorDia: porDia(impressoesPorDia),
    cliquesPorDia: porDia(cliquesPorDia),
  };
}

/**
 * As campanhas do período, com o total de cada uma.
 *
 * ⚠️ SEM `time_increment` aqui, e é de propósito. A tabela compara campanhas
 * entre si, e por isso quer o total de cada uma; pedindo por dia, a mesma
 * campanha viraria trinta linhas que alguém teria de somar de novo.
 *
 * ⚠️ `nomeDaConta` viaja junto porque um cliente pode ter mais de uma conta de
 * anúncio, e o painel soma as duas. Sem a coluna, duas campanhas de mesmo nome
 * em contas diferentes ficam indistinguíveis na tela.
 */
export async function campanhasDaConta(
  adAccountId: string,
  nomeDaConta: string,
  token: string,
  periodo: Periodo,
): Promise<CampanhaDoPeriodo[]> {
  const corpo = await pedir(
    `/${adAccountId}/insights?fields=${CAMPOS},campaign_id,campaign_name` +
      `&level=campaign&time_range=${janela(periodo)}&limit=100`,
    token,
  );

  return (corpo.data ?? [])
    .map((l) => {
      const porFamilia = contarPorFamilia(l.actions);

      const fechado = fecharResumo(
        paraCentavos(l.spend),
        paraInteiro(l.impressions),
        paraInteiro(l.clicks),
        porFamilia,
      );

      return {
        id: l.campaign_id ?? "",
        nome: l.campaign_name ?? "Sem nome",
        conta: nomeDaConta,
        investido: fechado.investido,
        impressoes: fechado.impressoes,
        cliques: fechado.cliques,
        resultados: fechado.resultados,
        ctr: fechado.ctr,
        porFamilia,
      };
    })
    // Maior investimento primeiro: é por onde se começa a olhar uma conta.
    .sort((a, b) => b.investido - a.investido);
}

/** Quantos anúncios entram na grade de criativos. */
const ANUNCIOS_NO_PAINEL = 6;

type LinhaDeCriativo = {
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    object_story_spec?: {
      video_data?: { image_url?: string; picture?: string };
      link_data?: { picture?: string };
    };
  };
};

/**
 * Onde a arte de um criativo pode estar, em ordem de qualidade.
 *
 * ⚠️ São quatro lugares porque a Meta guarda a imagem em campos diferentes
 * conforme o TIPO do anúncio, e nenhum deles existe sempre. Anúncio de imagem
 * tem `image_url`; o de vídeo não tem imagem nenhuma ali, e a capa vive dentro
 * de `object_story_spec.video_data`; o de link traz `picture`. Lendo só o
 * primeiro campo, metade da grade nasceria vazia — e vazia justamente nos vídeos,
 * que são a maioria hoje.
 *
 * ⚠️ `thumbnail_url` é o último recurso, e não o primeiro. Ela é a miniatura que
 * a Meta gera, e vem em 64 pixels por padrão: numa grade de 180, fica borrada.
 * Por isso a consulta pede 400 por 400 nela.
 */
function arteDoCriativo(linha: LinhaDeCriativo | undefined): string | null {
  const c = linha?.creative;
  if (!c) return null;

  return (
    c.image_url ??
    c.object_story_spec?.video_data?.image_url ??
    c.object_story_spec?.video_data?.picture ??
    c.object_story_spec?.link_data?.picture ??
    c.thumbnail_url ??
    null
  );
}

/**
 * Os anúncios que mais consumiram, com a arte de cada um.
 *
 * ⚠️ Duas chamadas, e nas duas a ordem importa. A primeira traz o desempenho por
 * anúncio; só depois de saber quais são os seis maiores é que a segunda busca a
 * arte deles. Pedindo o criativo junto, a conta traria a imagem de todos os
 * anúncios do período para a tela mostrar meia dúzia.
 *
 * ⚠️ A segunda usa `?ids=`, o multi-get da Graph API: uma requisição para os
 * seis, e não seis requisições. Em série, a grade sozinha custaria mais que o
 * resto do painel inteiro.
 *
 * ⚠️ `image_url` primeiro, `thumbnail_url` depois. A miniatura da Meta tem 64
 * pixels de lado e fica borrada em qualquer grade; ela é o reserva de quando o
 * criativo não expõe a imagem cheia.
 */
export async function anunciosDaConta(
  adAccountId: string,
  nomeDaConta: string,
  token: string,
  periodo: Periodo,
): Promise<{ anuncios: AnuncioDoPeriodo[]; aviso: string | null }> {
  const corpo = await pedir(
    `/${adAccountId}/insights?fields=${CAMPOS},ad_id,ad_name,campaign_name` +
      `&level=ad&time_range=${janela(periodo)}&limit=100`,
    token,
  ).catch(() => ({ data: [] as LinhaDaApi[] }));

  const melhores = (corpo.data ?? [])
    .filter((l) => l.ad_id)
    .map((l) => {
      const fechado = fecharResumo(
        paraCentavos(l.spend),
        paraInteiro(l.impressions),
        paraInteiro(l.clicks),
        contarPorFamilia(l.actions),
      );

      return {
        id: l.ad_id!,
        nome: l.ad_name ?? "Sem nome",
        campanha: l.campaign_name ?? "Sem campanha",
        conta: nomeDaConta,
        imagem: null as string | null,
        investido: fechado.investido,
        impressoes: fechado.impressoes,
        cliques: fechado.cliques,
        resultados: fechado.resultados,
        ctr: fechado.ctr,
      };
    })
    .sort((a, b) => b.investido - a.investido)
    .slice(0, ANUNCIOS_NO_PAINEL);

  if (melhores.length === 0) return { anuncios: [], aviso: null };

  /*
   * ⚠️ Falha aqui devolve os anúncios SEM arte, e não uma lista vazia. O número
   * de cada anúncio é o dado; a imagem é o que ajuda a reconhecê-lo. Perder os
   * dois porque o criativo não veio seria trocar uma falta pequena por uma
   * grande.
   */
  /*
   * ⚠️ NÃO usamos o endpoint de preview do anúncio (`/{ad_id}/previews`), que
   * renderiza a peça exatamente como ela apareceu.
   *
   * Ele devolve um `iframe` cujo `src` carrega o ACCESS TOKEN na própria URL.
   * Pôr esse iframe na tela entregaria a credencial do cliente ao navegador, ao
   * histórico e ao `Referer` — que é exatamente o que as quatro camadas do
   * módulo existem para impedir. A imagem do criativo responde à mesma pergunta
   * sem abrir essa porta.
   */
  /*
   * ⚠️ Uma requisição POR ANÚNCIO, e não o multi-get `?ids=`.
   *
   * O `?ids=` foi DESCONTINUADO pela Meta a partir da v26: ele respondia
   * "The ids query parameter is deprecated in v26.0+" e derrubava a busca
   * inteira das artes, deixando a grade com seis quadros cinza. Seis pedidos
   * pequenos em paralelo custam praticamente o mesmo que um, e não dependem de
   * um atalho que a plataforma já removeu uma vez.
   *
   * ⚠️ Sem modificadores de tamanho no campo (`thumbnail_width(400)`): eles são
   * válidos na borda `adcreatives`, e recusar um campo derruba a requisição
   * toda. Miniatura pequena é um problema menor que grade sem imagem.
   */
  let aviso: string | null = null;

  /*
   * ⚠️ DUAS tentativas, da mais rica para a mínima, e isso não é excesso de
   * zelo.
   *
   * A Graph API recusa a requisição INTEIRA quando um campo pedido não existe
   * naquele tipo de criativo: `video_data{picture}` não existe, e derrubou a
   * busca das seis artes com "(#100) Tried accessing nonexisting field". A forma
   * do criativo muda com o tipo do anúncio e com a versão da API, então a lista
   * rica é um palpite bem informado — e o `thumbnail_url` sozinho é o que a Meta
   * devolve para qualquer criativo, em qualquer versão. Preferir a rica e cair
   * para a mínima dá a melhor imagem possível sem apostar tudo num campo.
   */
  const CAMPOS_RICOS =
    "creative{thumbnail_url,image_url,object_story_spec{video_data{image_url},link_data{picture}}}";
  const CAMPOS_MINIMOS = "creative{thumbnail_url,image_url}";

  async function arteDe(adId: string): Promise<LinhaDeCriativo> {
    try {
      return await pedirBruto<LinhaDeCriativo>(`/${adId}?fields=${CAMPOS_RICOS}`, token);
    } catch {
      return pedirBruto<LinhaDeCriativo>(`/${adId}?fields=${CAMPOS_MINIMOS}`, token);
    }
  }

  const artes = await Promise.all(
    melhores.map((a) =>
      arteDe(a.id).catch(
        (e: unknown) => {
          /*
           * ⚠️ A falha vira AVISO, e não silêncio.
           *
           * Antes ela era engolida para não derrubar os números do anúncio, o
           * que está certo — mas sem dizer nada, uma grade de quadros cinza
           * parecia anúncio sem arte, e não consulta recusada. Qualquer palpite
           * sobre a causa feito daqui é chute; a mensagem da Meta diz.
           *
           * ⚠️ Só a PRIMEIRA falha vira aviso. Seis anúncios recusados pelo
           * mesmo motivo escreveriam a mesma frase seis vezes na tela.
           */
          aviso ??= `${nomeDaConta}: a Meta não devolveu a arte dos anúncios. ${
            e instanceof Error ? e.message : "Erro desconhecido"
          }`;
          return {} as LinhaDeCriativo;
        },
      ),
    ),
  );

  const anuncios = melhores.map((a, i) => ({ ...a, imagem: arteDoCriativo(artes[i]) }));

  /*
   * ⚠️ Resposta OK e nenhuma arte também é sintoma, e precisa avisar. A Graph
   * API responde 200 com `creative` reduzido a `{ id }` quando o token não
   * alcança o criativo, e aí não há erro nenhum para reportar — só o vazio.
   */
  if (aviso == null && anuncios.length > 0 && anuncios.every((a) => a.imagem == null)) {
    aviso =
      `${nomeDaConta}: a Meta respondeu sem a arte de nenhum anúncio. ` +
      `O criativo veio vazio para todos os ${anuncios.length}.`;
  }

  return { anuncios, aviso };
}
