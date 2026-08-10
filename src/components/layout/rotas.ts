import type { Modulo } from "@/modules/plataforma/plataforma.types";

/**
 * Mapa de navegacao — fonte unica.
 *
 * A barra lateral e a busca global leem daqui. Duplicar essa lista faria a
 * busca encontrar telas com rotulo diferente do item de menu.
 *
 * Tres niveis: grupo -> (item | subgrupo) -> item. O subgrupo existe para
 * assuntos que sao um bloco coeso dentro de um modulo maior — "Caixas e Bancos"
 * dentro de Financeiro, por exemplo. Nao ha quarto nivel de proposito: menu
 * mais fundo que isso vira labirinto.
 */

export type Item = { label: string; href: string };
export type Subgrupo = { key: string; label: string; items: Item[] };
export type Filho = Item | Subgrupo;
export type Grupo = { key: string; label: string; icon: string; items: Filho[] };

export function ehSubgrupo(filho: Filho): filho is Subgrupo {
  return !("href" in filho);
}

/**
 * Menu por MODULO do plano, nao por produto.
 *
 * O plano da empresa (Free/Starter/Pro/Enterprise) liga as flags `modulo_*`, e
 * cada modulo traz seus grupos.
 */
export const GRUPOS_POR_MODULO: Partial<Record<Modulo, Grupo[]>> = {
  /*
   * ⚠️ Social e MODULO PROPRIO, e nao um grupo dentro do financeiro.
   *
   * Morando no financeiro, ele era vendido junto: quem nao tinha financeiro
   * ficava sem Social, e quem tinha ganhava Social de graca. Num SaaS isso nao e
   * detalhe de organizacao, e sim o que a empresa consegue ou nao cobrar — e o
   * Insights consome API de terceiro, entao ele tem custo por uso.
   */
  social: [
    {
      /*
       * Social fica no fim: nao participa do fluxo do dinheiro, e sim mostra o
       * resultado da midia que o cliente paga. E consulta, e nao operacao.
       *
       * ⚠️ A rede e o NIVEL DO MEIO, e o assunto vem embaixo dela. Meta,
       * TikTok e Google nao compartilham metrica, permissao nem token: cada uma
       * e um bloco fechado. Agrupando por assunto ("Insights" no topo, com as
       * redes dentro), a proxima rede teria de se espalhar por varios itens em
       * vez de nascer como um so.
       */
      key: "social",
      label: "Social",
      icon: "social",
      items: [
        {
          key: "social-meta",
          label: "Meta",
          /*
           * ⚠️ Uma entrada so, e o painel dentro dela e por CLIENTE.
           *
           * Antes eram "Anuncios" e "Perfis", separados porque sao APIs,
           * permissoes e tokens diferentes. Isso e verdade para quem escreve o
           * codigo e falso para quem apresenta o resultado: falar de um cliente
           * exigia abrir as duas telas e somar de cabeca. A falha de uma origem
           * nao contamina a outra porque o painel diz o que faltou, em vez de
           * uma tarja de erro cobrindo tudo.
           */
          items: [{ label: "Painel", href: "/insights" }],
        },
      ],
    }
  ],
  financeiro: [
    {
      // Ticket e a origem do fluxo: orcamento nasce nele e vira conta a
      // receber. Por isso aparece antes de quem consome.
      key: "tickets",
      label: "Serviços",
      icon: "ticket",
      // Projeto e contrato vem ANTES do ticket: os dois acontecem antes dele
      // na operacao — projeto organiza a execucao, contrato cria a recorrencia,
      // e o ticket e o que sobra para faturar.
      items: [
        { label: "Projetos", href: "/projetos" },
        { label: "Contratos", href: "/contratos" },
        { label: "Tickets", href: "/tickets" },
      ],
    },
    {
      /*
       * Suprimentos vem ANTES do financeiro porque e a ordem em que a despesa
       * acontece: alguem pede, cota, compra — e so entao ha o que pagar. O menu
       * conta a mesma historia que o processo.
       */
      key: "suprimentos",
      label: "Suprimentos",
      icon: "operacional",
      items: [
        { label: "Requisições", href: "/suprimentos/requisicoes" },
        { label: "Cotações", href: "/suprimentos/cotacoes" },
        { label: "Pedidos de compra", href: "/suprimentos/pedidos" },
      ],
    },
    {
      key: "financeiro",
      label: "Financeiro",
      icon: "faturas",
      items: [
        {
          // O titulo e o recebimento sao o mesmo assunto visto dos dois lados:
          // o que o cliente deve, e o que ele pagou. Separados no primeiro
          // nivel, a pessoa precisava saber de antemao em qual dos dois procurar.
          key: "financeiro-receber",
          label: "Contas a receber",
          items: [
            { label: "Títulos", href: "/faturas" },
            /*
             * "Baixas" e nao "Recebimentos": e o nome que o financeiro usa para o
             * gesto de dar por recebido. "Recebimento" descreve o dinheiro; a tela
             * e sobre a acao de baixar o titulo.
             */
            { label: "Baixas", href: "/recebimentos" },
          ],
        },
        {
          /*
           * Espelho exato do lado que recebe: o titulo e a baixa sao o mesmo
           * assunto visto dos dois lados — o que a empresa deve, e o que ela
           * pagou. Solto no primeiro nivel, "Contas a pagar" prometia a divida e
           * nao levava a lugar nenhum quando a pergunta era "o que ja saiu".
           */
          key: "financeiro-pagar",
          label: "Contas a pagar",
          items: [
            { label: "Títulos", href: "/contas-pagar" },
            // "Baixas" pelo mesmo motivo do outro lado: e o nome que o
            // financeiro usa para o gesto de dar por pago.
            { label: "Baixas", href: "/contas-pagar/baixas" },
            /*
             * A despesa que se repete: aluguel, contador, energia, licenca.
             * Fica AQUI e nao junto de "Contratos", que e do lado que recebe:
             * quem cuida do que a empresa paga nao vai procurar a conta de luz
             * na tela de contrato com cliente.
             */
            { label: "Recorrentes", href: "/contas-pagar/recorrentes" },
          ],
        },
        {
          key: "financeiro-caixas",
          label: "Caixas e Bancos",
          // No legado esses tres viviam juntos em `cadastro/caixase_bancos`.
          // Manter o agrupamento poupa o usuario de reaprender onde as coisas
          // estao.
          //
          // O extrato saiu daqui: ele e a segunda tela de "Contas e saldo", nao
          // um destino proprio. Extrato sem conta escolhida e uma pergunta pela
          // metade, e o item de menu obrigava a escolher a conta duas vezes.
          items: [
            { label: "Contas e saldo", href: "/contas" },
            { label: "Inicialização de saldo", href: "/contas/inicializacao" },
            { label: "Movimentações", href: "/movimentacoes" },
            { label: "Cartões", href: "/cartoes" },
          ],
        },
        {
          // "Analitico" e um subgrupo que se repete: cada modulo tem o seu.
          // Por isso a chave leva o nome do grupo — duas chaves iguais fariam
          // os dois abrirem e fecharem juntos.
          key: "financeiro-analitico",
          label: "Analítico",
          items: [
            { label: "DRE", href: "/dre" },
            { label: "Fluxo de caixa", href: "/fluxo-caixa" },
            { label: "Relatórios", href: "/relatorios" },
          ],
        },
      ],
    },
    {
      key: "cadastros",
      label: "Cadastros",
      icon: "pessoas",
      items: [
        { label: "Pessoas", href: "/pessoas" },
        { label: "Serviços", href: "/servicos" },
        { label: "Centro de custo", href: "/centro-custo" },
        /*
         * Integracoes e cadastro, e nao configuracao de plataforma.
         *
         * O que se liga aqui e conta de fora que pertence a EMPRESA e se associa
         * a um CLIENTE dela — mesma natureza de pessoa, servico e centro de
         * custo. Plataforma guarda o que a Vpay vende (plano, modulos), que e
         * outro assunto e outro dono.
         */
        { label: "Integrações", href: "/configuracoes" },
      ],
    },
  ],
  estoque: [
    {
      key: "estoque",
      label: "Estoque",
      icon: "caixa",
      items: [{ label: "Produtos", href: "/produtos" }],
    },
  ],
};

/**
 * Menu do PORTAL — quem entra e pessoa do cliente, nao da casa.
 *
 * Lista propria e nao um recorte de `GRUPOS_POR_MODULO`: o menu do sistema e
 * organizado pelo que a EMPRESA administra, e o cliente nao administra nada. Ele
 * consulta o que deve e, em breve, abre chamado.
 *
 * Fica aqui junto com os outros para continuar valendo a regra do arquivo: mapa
 * de navegacao tem uma fonte so.
 */
export const GRUPOS_DO_PORTAL: Grupo[] = [
  {
    key: "portal",
    label: "Financeiro",
    icon: "faturas",
    items: [{ label: "Minhas cobranças", href: "/portal" }],
  },
];

export const GRUPO_PLATAFORMA: Grupo = {
  key: "plataforma",
  label: "Plataforma",
  icon: "config",
  items: [{ label: "Plano e módulos", href: "/plano" }],
};

/** Rotas que existem fora dos grupos do menu. */
const AVULSAS: Item[] = [{ label: "Visão geral", href: "/dashboard" }];

/** Achata grupo e subgrupo numa lista de telas. */
function itensDe(grupo: Grupo): Item[] {
  return grupo.items.flatMap((f) => (ehSubgrupo(f) ? f.items : [f]));
}

export const TODAS_AS_ROTAS: Item[] = [
  ...AVULSAS,
  ...Object.values(GRUPOS_POR_MODULO).flatMap((g) => g?.flatMap(itensDe) ?? []),
  ...itensDe(GRUPO_PLATAFORMA),
];

/**
 * De quem a rota e filha: o subgrupo quando ha um, senao o grupo.
 *
 * ⚠️ Existe para os FAVORITOS. "Titulos" existe em contas a receber e em contas
 * a pagar, e favoritando os dois o menu mostrava "Titulos" duas vezes, sem dizer
 * qual era qual. Com o pai, viram "Contas a receber > Titulos" e "Contas a pagar
 * > Titulos".
 */
export function paiDaRota(href: string): string | null {
  for (const grupos of [
    ...Object.values(GRUPOS_POR_MODULO).map((g) => g ?? []),
    [GRUPO_PLATAFORMA],
  ]) {
    for (const grupo of grupos) {
      for (const filho of grupo.items) {
        if (ehSubgrupo(filho)) {
          if (filho.items.some((i) => i.href === href)) return filho.label;
        } else if (filho.href === href) {
          return grupo.label;
        }
      }
    }
  }
  return null;
}

export function rotuloDaRota(href: string): string | null {
  return TODAS_AS_ROTAS.find((i) => i.href === href)?.label ?? null;
}

export function gruposDosModulos(modulos: Modulo[]): Grupo[] {
  return modulos.flatMap((m) => GRUPOS_POR_MODULO[m] ?? []).concat(GRUPO_PLATAFORMA);
}

/** Telas de um grupo, incluindo as dentro de subgrupos. Usado para "ativo". */
export function telasDoGrupo(grupo: Grupo): Item[] {
  return itensDe(grupo);
}
