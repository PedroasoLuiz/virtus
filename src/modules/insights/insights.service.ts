import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import * as repo from "@/modules/insights/insights.repository";
import {
  anunciosDaConta,
  campanhasDaConta,
  contasDoToken,
  desempenhoDaConta,
  fecharResumo,
} from "@/modules/insights/meta.client";
import { precisaRenovar, trocarPorLongoPrazo } from "@/modules/insights/meta.token";
import { painelComCache } from "@/modules/insights/insights.cache";
import { paginasDoToken, painelDaPagina } from "@/modules/insights/meta.instagram";
import {
  alvosDoPainel,
  chaveEmTexto,
  origensDoAlvo,
  type AlvoDoPainel,
  type ChaveDeCliente,
  type FamiliaDeResultado,
} from "@/shared/domain/insights";
import { diffEmDias } from "@/shared/utils/datas";
import type { Centavos } from "@/shared/utils/money";
import type {
  Acesso,
  AnuncioDoPeriodo,
  CampanhaDoPeriodo,
  Conexao,
  ContaDisponivel,
  Pagina,
  PaginaDisponivel,
  PainelDoCliente,
  Periodo,
  PontoDaSerie,
} from "@/modules/insights/insights.types";

/** Regra de negocio do painel de anuncios. */

/** Ate onde a Meta guarda insight de Pagina. Ver `painelDoCliente`. */
const DIAS_NO_MAXIMO = 730;

export async function listarConexoes(empresaId: number): Promise<Conexao[]> {
  return repo.listar(empresaId);
}

export async function listarAcessos(empresaId: number): Promise<Acesso[]> {
  return repo.listarAcessos(empresaId);
}

/**
 * O token bruto de uma origem: colado na tela ou lido de um acesso ja ligado.
 *
 * ⚠️ Existe uma vez so porque as duas portas (buscar contas e ligar contas)
 * precisam da mesma decisao. Duplicando, uma delas ganharia a checagem de tenant
 * e a outra nao.
 */
async function tokenDaOrigem(
  empresaId: number,
  origem: { token?: string | null; acessoId?: number | null },
): Promise<string> {
  const colado = origem.token?.trim();
  if (colado) return colado;

  if (origem.acessoId == null) {
    throw new BusinessRuleError("Informe o token ou escolha um acesso já ligado");
  }

  // ⚠️ Confere o tenant ANTES de ler o segredo: sem isto, um id de outra empresa
  // faria a funcao do vault ser chamada com um acesso alheio.
  const dono = await repo.buscarAcesso(empresaId, origem.acessoId);
  if (!dono) throw new NotFoundError("Acesso não encontrado");

  const guardado = await repo.tokenDoAcesso(origem.acessoId);
  if (!guardado) throw new BusinessRuleError("Não foi possível ler o token desse acesso");

  return guardado;
}

/**
 * O que este acesso enxerga na Meta, e o que dele ja esta ligado aqui.
 *
 * ⚠️ Se uma conta do cliente NAO aparecer, o problema e acesso no Business
 * Manager dele, e nao no Vpay. Saber disso pela propria tela evita procurar bug
 * onde nao ha.
 */
export async function contasDisponiveis(
  empresaId: number,
  origem: { token?: string | null; acessoId?: number | null },
): Promise<{ contas: ContaDisponivel[]; jaConectadas: string[] }> {
  const token = await tokenDaOrigem(empresaId, origem);
  const contas = await contasDoToken(token);
  const existentes = await repo.listar(empresaId);

  return { contas, jaConectadas: existentes.map((c) => c.adAccountId) };
}

/**
 * Liga contas de anuncio, todas sob o MESMO acesso.
 *
 * ⚠️ O acesso e gravado UMA vez, antes do laco. Guardando por conta, o token
 * viraria N copias no vault — que era o modelo antigo, e fazia a renovacao
 * alcancar so a conta que alguem abrisse.
 *
 * ⚠️ Colando token novo, ele e trocado por um de 60 dias antes de guardar. O
 * token do Graph API Explorer dura cerca de uma hora: gravado como veio, a
 * ligacao nasce quebrada antes do fim do expediente.
 */
export async function conectarContas(
  empresaId: number,
  origem: { token?: string | null; acessoId?: number | null },
  contas: { adAccountId: string; nome: string | null; clienteId: number | null }[],
): Promise<{ acessoId: number; ligadas: number }> {
  if (contas.length === 0) throw new BusinessRuleError("Escolha ao menos uma conta");

  const colando = !!origem.token?.trim();
  let acessoId: number;

  if (colando) {
    const trocado = await trocarPorLongoPrazo(origem.token!.trim());
    acessoId = await repo.guardarAcesso(empresaId, {
      acessoId: origem.acessoId ?? null,
      nome: null,
      token: trocado.token,
      expiraEm: trocado.expiraEm,
    });
  } else {
    if (origem.acessoId == null) {
      throw new BusinessRuleError("Informe o token ou escolha um acesso já ligado");
    }
    const dono = await repo.buscarAcesso(empresaId, origem.acessoId);
    if (!dono) throw new NotFoundError("Acesso não encontrado");
    acessoId = origem.acessoId;
  }

  for (const conta of contas) {
    /*
     * ⚠️ O `act_` e normalizado aqui. A Graph API so aceita a conta com esse
     * prefixo, e quem cola do Gerenciador traz ora `act_123`, ora `123`.
     */
    const bruta = conta.adAccountId.trim();
    const normalizada = bruta.startsWith("act_")
      ? bruta
      : `act_${bruta.replace(/\D/g, "")}`;

    await repo.ligarConta(empresaId, acessoId, {
      adAccountId: normalizada,
      nome: conta.nome?.trim() || null,
      clienteId: conta.clienteId,
    });
  }

  return { acessoId, ligadas: contas.length };
}

/**
 * Renova o token de um acesso com um token colado na mao.
 *
 * ⚠️ Vale para TODAS as contas daquele acesso de uma vez, porque o segredo e um
 * so. Era exatamente isso que o modelo anterior nao conseguia fazer.
 */
export async function renovarAcesso(
  empresaId: number,
  acessoId: number,
  token: string,
): Promise<Acesso> {
  const atual = await repo.buscarAcesso(empresaId, acessoId);
  if (!atual) throw new NotFoundError("Acesso não encontrado");

  const trocado = await trocarPorLongoPrazo(token.trim());

  await repo.guardarAcesso(empresaId, {
    acessoId,
    nome: atual.nome,
    token: trocado.token,
    expiraEm: trocado.expiraEm,
  });

  const depois = await repo.buscarAcesso(empresaId, acessoId);
  if (!depois) throw new NotFoundError("Acesso não encontrado");
  return depois;
}

/**
 * Renova sozinho, se estiver perto de vencer.
 *
 * ⚠️ Acontece na consulta, e nao num agendador. O sistema nao tem cron, e um job
 * so para isto seria uma peca de infraestrutura inteira para uma chamada. Acesso
 * que alguem usa continua vivo sozinho.
 *
 * ⚠️ Falha aqui NAO derruba o painel. Renovar e manutencao; se a Meta recusar, o
 * token atual ainda vale por dias, e o certo e mostrar os numeros e deixar a
 * tela avisar do vencimento que se aproxima.
 */
async function renovarSePreciso(
  empresaId: number,
  acesso: Acesso,
  token: string,
): Promise<string> {
  if (!precisaRenovar(acesso.expiraEm)) return token;

  try {
    const trocado = await trocarPorLongoPrazo(token);
    if (trocado.expiraEm == null) return token;

    await repo.guardarAcesso(empresaId, {
      acessoId: acesso.id,
      nome: acesso.nome,
      token: trocado.token,
      expiraEm: trocado.expiraEm,
    });

    return trocado.token;
  } catch {
    return token;
  }
}

/**
 * Muda cliente ou situacao de uma conexao.
 *
 * ⚠️ Desativar NAO apaga, e e por isso que existe. A conta some do painel e para
 * de consultar a Meta, mas o vinculo com o cliente continua. Apagar perderia
 * isso, e religar depois nao traria de volta a quem aquelas metricas pertenciam.
 */
export async function atualizarConexao(
  empresaId: number,
  id: number,
  mudancas: { clienteId?: number | null; ativo?: boolean },
): Promise<Conexao> {
  const atual = await repo.buscarPorId(empresaId, id);
  if (!atual) throw new NotFoundError("Conexão não encontrada");

  await repo.atualizar(empresaId, id, mudancas);

  const depois = await repo.buscarPorId(empresaId, id);
  if (!depois) throw new NotFoundError("Conexão não encontrada");
  return depois;
}

/** Os clientes que tem alguma origem ligada, para o seletor do painel. */
export async function alvosDoCliente(empresaId: number): Promise<AlvoDoPainel[]> {
  const [conexoes, paginas] = await Promise.all([
    repo.listar(empresaId),
    repo.listarPaginas(empresaId),
  ]);

  return alvosDoPainel(conexoes, paginas);
}

/** Junta as series de varias contas somando o que cai no mesmo dia. */
function somarPorDia(series: PontoDaSerie[][]): PontoDaSerie[] {
  const mapa = new Map<string, number>();

  for (const serie of series) {
    for (const ponto of serie) {
      mapa.set(ponto.dia, (mapa.get(ponto.dia) ?? 0) + ponto.valor);
    }
  }

  return [...mapa.entries()]
    .map(([dia, valor]) => ({ dia, valor }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

/**
 * O painel de um CLIENTE: conta de anuncio, Pagina e Instagram dele, juntos.
 *
 * ⚠️ Este e o eixo da tela, e substituiu um painel por conta de anuncio e outro
 * por perfil. Aquele recorte era o da API, e nao o do negocio: quem apresenta o
 * resultado apresenta o cliente, e ter que abrir duas telas para falar da mesma
 * pessoa era o sintoma.
 *
 * ⚠️ TUDO em paralelo. Sao varias idas a Meta e elas nao dependem umas das
 * outras; em serie, a tela esperaria a soma de latencias de uma API de fora, que
 * nao e pequena nem previsivel.
 *
 * ⚠️ Uma origem que falha NAO derruba as outras. Cada uma cai em `falhas` e o
 * painel mostra o que respondeu: um token sem permissao numa conta so nao pode
 * apagar o investimento das outras nem os seguidores.
 */
export async function painelDoCliente(
  empresaId: number,
  chave: ChaveDeCliente,
  periodo: Periodo,
): Promise<PainelDoCliente> {
  /*
   * ⚠️ A validacao acontece ANTES do cache, e nao dentro dele. Periodo invertido
   * e erro de quem pediu, e deve responder na hora; passando pelo cache, ele
   * viraria uma promessa rejeitada guardada e depois apagada, de graca.
   */
  if (periodo.ate < periodo.de) {
    throw new BusinessRuleError("O fim do período não pode ser antes do início");
  }

  /*
   * ⚠️ TETO no tamanho do periodo, e o motivo nao e a tela: e custo e disponi-
   * bilidade.
   *
   * O periodo vem da URL e nada o limitava. Os insights de Pagina sao fatiados
   * em janelas de 90 dias, entao pedir dez anos vira mais de quarenta janelas
   * vezes tres metricas, mais as chamadas de anuncio, tudo numa requisicao. Um
   * unico usuario com a URL na mao — ou um laco distraido — multiplicava por
   * cem as chamadas a uma API de terceiro que tem cota, e derrubava o painel de
   * TODAS as empresas quando a cota estourasse.
   *
   * Dois anos e o limite util de verdade: e ate onde a Meta guarda insight de
   * Pagina.
   */
  if (diffEmDias(periodo.de, periodo.ate) > DIAS_NO_MAXIMO) {
    throw new BusinessRuleError(
      "O período não pode passar de 2 anos, que é o limite do que a Meta guarda",
    );
  }

  return painelComCache(empresaId, chaveEmTexto(chave), periodo.de, periodo.ate, () =>
    montarPainelDoCliente(empresaId, chave, periodo),
  );
}

async function montarPainelDoCliente(
  empresaId: number,
  chave: ChaveDeCliente,
  periodo: Periodo,
): Promise<PainelDoCliente> {
  const [conexoes, paginas] = await Promise.all([
    repo.listar(empresaId),
    repo.listarPaginas(empresaId),
  ]);

  const alvo = alvosDoPainel(conexoes, paginas).find((a) => a.chave === chave);
  if (!alvo) throw new NotFoundError("Este cliente não tem nada ligado à Meta");

  const minhasContas = origensDoAlvo(conexoes, chave);
  const minhasPaginas = origensDoAlvo(paginas, chave);

  /*
   * ⚠️ O token e resolvido uma vez POR ACESSO, dentro desta funcao, e morre com
   * ela. Seis contas do mesmo acesso fariam seis leituras do vault e seis
   * tentativas de renovar a mesma credencial. E o mapa e local de proposito: em
   * variavel de modulo, ele viveria entre requisicoes de empresas diferentes.
   */
  const tokens = new Map<number, string | null>();

  async function tokenDoAcesso(acessoId: number): Promise<string | null> {
    const guardado = tokens.get(acessoId);
    if (guardado !== undefined) return guardado;

    const bruto = await repo.tokenDoAcesso(acessoId);
    if (!bruto) {
      tokens.set(acessoId, null);
      return null;
    }

    const acesso = await repo.buscarAcesso(empresaId, acessoId);
    const vigente = acesso ? await renovarSePreciso(empresaId, acesso, bruto) : bruto;

    tokens.set(acessoId, vigente);
    return vigente;
  }

  const falhas: string[] = [];

  function rotuloDaConta(conexao: Conexao): string {
    return conexao.nome ?? conexao.adAccountId;
  }

  /*
   * ⚠️ Os anuncios e a Pagina saem JUNTOS, e nao um depois do outro.
   *
   * A Pagina esperava a rodada inteira de anuncios terminar para so entao
   * comecar a dela: com uma conta de anuncio, isso somava a latencia das duas
   * origens em vez de pagar a maior das duas. Sao APIs diferentes, com tokens
   * diferentes, e nenhuma depende do resultado da outra.
   */
  const buscaDosAnuncios = Promise.all(
    minhasContas.map(async (conexao) => {
      const token = await tokenDoAcesso(conexao.acessoId);
      if (!token) {
        falhas.push(`Não foi possível ler o token de ${rotuloDaConta(conexao)}. Renove o acesso.`);
        return null;
      }

      try {
        const [desempenho, campanhas, anuncios] = await Promise.all([
          desempenhoDaConta(conexao.adAccountId, token, periodo),
          campanhasDaConta(conexao.adAccountId, rotuloDaConta(conexao), token, periodo),
          anunciosDaConta(conexao.adAccountId, rotuloDaConta(conexao), token, periodo),
        ]);

        if (anuncios.aviso) falhas.push(anuncios.aviso);

        return { conexao, desempenho, campanhas, anuncios: anuncios.anuncios };
      } catch (e) {
        const detalhe = e instanceof Error ? e.message : "erro desconhecido";
        falhas.push(`${rotuloDaConta(conexao)}: ${detalhe}`);
        return null;
      }
    }),
  );

  /*
   * ⚠️ A PRIMEIRA Pagina ativa do cliente, e as demais entram em `falhas`.
   * Somar duas Paginas daria um numero de fas sem dono, e escolher em silencio
   * esconderia que existe outra. Ninguem tem duas hoje; quando tiver, a tela
   * avisa em vez de mentir.
   */
  const pagina = minhasPaginas[0] ?? null;

  const buscaDaPagina = (async () => {
    if (!pagina) return null;

    const token = await tokenDoAcesso(pagina.acessoId);
    if (!token) {
      falhas.push("Não foi possível ler o token da Página. Renove o acesso.");
      return null;
    }

    try {
      return await painelDaPagina(
        pagina.pageId,
        pagina.igUserId,
        pagina.igUsername,
        token,
        periodo,
      );
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : "erro desconhecido";
      falhas.push(`${pagina.nome ?? pagina.pageId}: ${detalhe}`);
      return null;
    }
  })();

  const [anuncios, dadosDaPagina] = await Promise.all([buscaDosAnuncios, buscaDaPagina]);

  for (const extra of minhasPaginas.slice(1)) {
    falhas.push(`A Página ${extra.nome ?? extra.pageId} não está no painel: o cliente tem mais de uma.`);
  }

  const metricasPagina = dadosDaPagina?.pagina ?? null;
  const metricasPerfil = dadosDaPagina?.perfil ?? null;

  const vivos = anuncios.filter((a) => a != null);

  /*
   * ⚠️ Os totais do cliente sao refeitos pela MESMA funcao que fecha os de uma
   * conta. Somar `custoPorResultado` de duas contas daria um numero que nao
   * significa nada: a razao do todo nao e a soma das razoes.
   */
  const resumo =
    vivos.length === 0
      ? null
      : fecharResumo(
          vivos.reduce((s, a) => s + a.desempenho.resumo.investido, 0) as Centavos,
          vivos.reduce((s, a) => s + a.desempenho.resumo.impressoes, 0),
          vivos.reduce((s, a) => s + a.desempenho.resumo.cliques, 0),
          /*
           * ⚠️ As FAMÍLIAS são somadas uma a uma, e a dominante é escolhida
           * depois, sobre o total do cliente. Somando o `resultados` já fechado
           * de cada conta, uma conta de compras e outra de conversas dariam um
           * número que mistura as duas unidades — que é exatamente o problema
           * que a família veio resolver.
           */
          vivos.reduce<Partial<Record<FamiliaDeResultado, number>>>((total, a) => {
            for (const [familia, valor] of Object.entries(
              a.desempenho.resumo.resultadosPorFamilia,
            )) {
              const f = familia as FamiliaDeResultado;
              total[f] = (total[f] ?? 0) + (valor ?? 0);
            }
            return total;
          }, {}),
        );

  const familiaDoCliente = resumo?.familiaDeResultado ?? null;

  /*
   * ⚠️ A coluna "Resultados" da tabela conta a MESMA familia em todas as linhas.
   *
   * Cada campanha vinha com a familia dominante DELA: numa conta com campanha de
   * venda e campanha de engajamento, a coluna tinha compras numa linha e
   * engajamentos na outra, com o mesmo cabecalho e sem nada avisando. Somar
   * aquela coluna dava um numero de unidade nenhuma, e comparar duas linhas
   * comparava coisas diferentes. Agora todas contam o que o cartao do topo
   * conta, e zero na linha quer dizer "esta campanha nao entregou disso".
   */
  const campanhas: CampanhaDoPeriodo[] = vivos
    .flatMap((a) => a.campanhas)
    .map((c) => ({
      ...c,
      resultados: familiaDoCliente == null ? 0 : (c.porFamilia[familiaDoCliente] ?? 0),
    }))
    .sort((a, b) => b.investido - a.investido);

  /*
   * ⚠️ O custo por resultado divide o investimento das campanhas que GERARAM
   * aquele resultado, e nao o da conta inteira.
   *
   * Caso real: uma conta com campanhas de engajamento e duas conversas soltas
   * dividia o gasto inteiro pelas duas conversas e anunciava R$ 101,82 por
   * conversa. O numero estava aritmeticamente certo e era imprestavel: o
   * dinheiro das campanhas de engajamento nunca esteve perseguindo conversa
   * nenhuma. Recortando pelas campanhas que produziram a familia, o custo passa
   * a descrever o que aconteceu de fato.
   */
  const investidoDoResultado = (
    familiaDoCliente == null
      ? (resumo?.investido ?? 0)
      : campanhas
          .filter((c) => (c.porFamilia[familiaDoCliente] ?? 0) > 0)
          .reduce((s, c) => s + c.investido, 0)
  ) as Centavos;

  /*
   * ⚠️ Recalculado aqui, e nao dentro de `fecharResumo`. Aquela funcao fecha os
   * numeros de UMA linha, e nao sabe de campanha nenhuma: so o painel do cliente
   * enxerga o conjunto todo e consegue fazer esse recorte.
   */
  const resumoFinal =
    resumo == null
      ? null
      : {
          ...resumo,
          custoPorResultado: (resumo.resultados > 0
            ? Math.round(investidoDoResultado / resumo.resultados)
            : 0) as Centavos,
        };

  /*
   * ⚠️ Os seis maiores DO CLIENTE, e nao seis por conta. Cada conta ja devolveu
   * os seis dela; juntando duas contas sem cortar de novo, a grade viraria doze
   * e deixaria de responder "quais foram os principais".
   */
  const melhoresAnuncios: AnuncioDoPeriodo[] = vivos
    .flatMap((a) => a.anuncios)
    .sort((a, b) => b.investido - a.investido)
    .slice(0, 6);

  return {
    cliente: { chave: chaveEmTexto(alvo.chave), nome: alvo.nome },
    periodo,
    contas: vivos.map((a) => rotuloDaConta(a.conexao)),
    resumo: resumoFinal,
    investidoDoResultado,
    investidoPorDia: somarPorDia(vivos.map((a) => a.desempenho.investidoPorDia)),
    resultadosPorDia: somarPorDia(vivos.map((a) => a.desempenho.resultadosPorDia)),
    impressoesPorDia: somarPorDia(vivos.map((a) => a.desempenho.impressoesPorDia)),
    cliquesPorDia: somarPorDia(vivos.map((a) => a.desempenho.cliquesPorDia)),
    campanhas,
    anuncios: melhoresAnuncios,
    paginaNome: pagina?.nome ?? null,
    pagina: metricasPagina,
    perfil: metricasPerfil,
    falhas,
  };
}

export async function listarPaginas(empresaId: number): Promise<Pagina[]> {
  return repo.listarPaginas(empresaId);
}

/** As Paginas que um acesso enxerga, e as que dele ja estao ligadas aqui. */
export async function paginasDisponiveis(
  empresaId: number,
  origem: { token?: string | null; acessoId?: number | null },
): Promise<{ paginas: PaginaDisponivel[]; jaLigadas: string[] }> {
  const token = await tokenDaOrigem(empresaId, origem);
  const paginas = await paginasDoToken(token);
  const existentes = await repo.listarPaginas(empresaId);

  return { paginas, jaLigadas: existentes.map((p) => p.pageId) };
}

/**
 * Liga Paginas a um acesso.
 *
 * ⚠️ Nao aceita token colado, so `acessoId`. Pagina so faz sentido pendurada num
 * acesso que ja existe, e o token de Pagina e derivado dele a cada consulta —
 * criar acesso por aqui abriria um segundo caminho para gravar segredo.
 */
export async function ligarPaginas(
  empresaId: number,
  acessoId: number,
  paginas: {
    pageId: string;
    nome: string | null;
    igUserId: string | null;
    igUsername: string | null;
    clienteId: number | null;
  }[],
): Promise<number> {
  if (paginas.length === 0) throw new BusinessRuleError("Escolha ao menos uma Página");

  const dono = await repo.buscarAcesso(empresaId, acessoId);
  if (!dono) throw new NotFoundError("Acesso não encontrado");

  for (const pagina of paginas) {
    await repo.ligarPagina(empresaId, acessoId, pagina);
  }

  return paginas.length;
}

