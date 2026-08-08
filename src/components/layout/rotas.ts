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
        { label: "Contas a pagar", href: "/contas-pagar" },
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
