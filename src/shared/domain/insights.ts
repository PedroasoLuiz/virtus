/**
 * Quem é o assunto do painel de Insights.
 *
 * ⚠️ O eixo é o CLIENTE, e não a API. Conta de anúncio, Página do Facebook e
 * perfil do Instagram são três origens de dado sobre a mesma pessoa; separar a
 * tela por origem organiza o problema para quem escreve o código e desorganiza
 * para quem apresenta o resultado.
 *
 * ⚠️ Funções puras, lidas pela tela E pelo servidor. A tela monta o seletor com
 * elas e o servidor decide o que buscar na Meta com as mesmas: duplicadas, uma
 * das duas passaria a listar cliente que a outra não atende.
 */

/**
 * O QUE a campanha entregou, e não só quanto.
 *
 * ⚠️ "Resultado" não é um número solto: ele é do tipo que a campanha buscava.
 * Cem conversas no WhatsApp e cem compras são a mesma contagem e valem coisas
 * muito diferentes, e mostrar "100 resultados" nos dois casos apaga justamente o
 * que distingue uma campanha da outra.
 *
 * ⚠️ Isto vive no domínio porque as DUAS pontas precisam: o servidor decide qual
 * família contar, e a tela escreve o nome e escolhe o ícone. Duplicado, um lado
 * contaria compra e o outro escreveria "conversas".
 */
export type FamiliaDeResultado =
  | "COMPRA"
  | "CADASTRO"
  | "CONVERSA"
  | "VISITA"
  | "ENGAJAMENTO"
  | "CLIQUE";

/**
 * ⚠️ A Meta usa NOMES DIFERENTES para a mesma coisa conforme a origem da
 * conversão. Compra pelo pixel do site é `offsite_conversion.fb_pixel_purchase`,
 * e compra medida pela própria Meta é `purchase`. Contadas em separado, uma
 * conta que usa as duas apareceria com metade do resultado em cada linha.
 */
const ACOES_DA_FAMILIA: Record<FamiliaDeResultado, string[]> = {
  COMPRA: ["purchase", "offsite_conversion.fb_pixel_purchase"],
  CADASTRO: [
    "lead",
    "offsite_conversion.fb_pixel_lead",
    "complete_registration",
    "offsite_conversion.fb_pixel_complete_registration",
  ],
  CONVERSA: [
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.total_messaging_connection",
  ],
  VISITA: ["landing_page_view"],
  /*
   * ⚠️ Existe porque campanha DE ENGAJAMENTO existe, e sem esta família ela
   * aparecia como zero resultados. Fica embaixo na prioridade porque toda
   * campanha gera reação: como família mais numerosa, ela venceria até numa
   * conta que só busca venda.
   */
  ENGAJAMENTO: ["post_engagement", "page_engagement", "post_reaction", "comment"],
  CLIQUE: ["link_click"],
};

/**
 * Da mais específica para a mais genérica.
 *
 * ⚠️ A ordem É a regra, e não uma preferência de exibição. Toda campanha gera
 * clique no link, inclusive a que busca compra: escolhendo a família mais
 * numerosa, "cliques" ganharia de "compras" em praticamente toda conta, e o
 * painel passaria a medir a coisa mais barata que aconteceu em vez do que foi
 * contratado. A mais específica que existir é a que a campanha estava buscando.
 */
const PRIORIDADE: FamiliaDeResultado[] = [
  "COMPRA",
  "CADASTRO",
  "CONVERSA",
  "VISITA",
  "ENGAJAMENTO",
  "CLIQUE",
];

const ROTULOS: Record<FamiliaDeResultado, string> = {
  COMPRA: "Compras",
  CADASTRO: "Cadastros",
  CONVERSA: "Conversas iniciadas",
  VISITA: "Visitas à página",
  ENGAJAMENTO: "Engajamentos",
  CLIQUE: "Cliques no link",
};

export function familiaDaAcao(acao: string): FamiliaDeResultado | null {
  for (const familia of PRIORIDADE) {
    if (ACOES_DA_FAMILIA[familia].includes(acao)) return familia;
  }
  return null;
}

/**
 * Qual família o painel deve contar, dado tudo que a conta gerou.
 *
 * ⚠️ Devolve nulo quando não houve NADA das cinco, e não a família de menor
 * contagem. Conta sem conversão nenhuma no período existe, e inventar uma
 * família para ela faria a tela escrever "0 compras" numa conta que nunca vendeu
 * pela Meta.
 */
export function familiaDominante(
  porFamilia: Partial<Record<FamiliaDeResultado, number>>,
): FamiliaDeResultado | null {
  return PRIORIDADE.find((f) => (porFamilia[f] ?? 0) > 0) ?? null;
}

export function rotuloDaFamilia(familia: FamiliaDeResultado | null): string {
  return familia == null ? "Resultados" : ROTULOS[familia];
}

/**
 * O cliente escolhido no painel.
 *
 * ⚠️ `"sem"` é um alvo legítimo, e não ausência de alvo. Existe conta ligada sem
 * cliente atribuído, e no eixo cliente ela sumiria da tela sem deixar rastro.
 * Aparecendo no fim da lista, ela é o próprio lembrete de ir atribuir.
 */
export type ChaveDeCliente = number | "sem";

/** O mínimo que uma origem precisa ter para ser atribuída a um cliente. */
export type OrigemLigada = {
  clienteId: number | null;
  clienteNome: string | null;
  ativo: boolean;
};

/** Uma entrada do seletor. */
export type AlvoDoPainel = {
  chave: ChaveDeCliente;
  nome: string;
  temAnuncio: boolean;
  temPerfil: boolean;
};

/** A chave de uma origem: o cliente dela, ou o balde dos não atribuídos. */
export function chaveDaOrigem(origem: OrigemLigada): ChaveDeCliente {
  return origem.clienteId ?? "sem";
}

/** `"12"` e `"sem"` da URL viram a chave. Devolve nulo em texto que não serve. */
export function chaveDeTexto(bruto: string | null | undefined): ChaveDeCliente | null {
  if (bruto == null) return null;
  const limpo = bruto.trim();
  if (limpo === "sem") return "sem";

  const n = Number(limpo);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function chaveEmTexto(chave: ChaveDeCliente): string {
  return chave === "sem" ? "sem" : String(chave);
}

/**
 * As origens daquele cliente.
 *
 * ⚠️ Só as ATIVAS. Desativar existe para tirar do painel sem perder o vínculo;
 * trazer a desativada aqui faria o número voltar a somar e ninguém entenderia de
 * onde.
 */
export function origensDoAlvo<T extends OrigemLigada>(origens: T[], chave: ChaveDeCliente): T[] {
  return origens.filter((o) => o.ativo && chaveDaOrigem(o) === chave);
}

/**
 * Os clientes que têm alguma coisa ligada, prontos para o seletor.
 *
 * ⚠️ A união dos dois lados, e não a interseção. Há cliente com conta de anúncio
 * e sem Página, e há o contrário: exigir os dois deixaria os dois de fora da tela
 * em vez de mostrar a metade que existe.
 */
export function alvosDoPainel(
  conexoes: OrigemLigada[],
  paginas: OrigemLigada[],
): AlvoDoPainel[] {
  const mapa = new Map<ChaveDeCliente, AlvoDoPainel>();

  function acumular(origem: OrigemLigada, lado: "anuncio" | "perfil") {
    if (!origem.ativo) return;

    const chave = chaveDaOrigem(origem);
    const atual = mapa.get(chave) ?? {
      chave,
      nome: chave === "sem" ? "Sem cliente" : (origem.clienteNome ?? "Cliente sem nome"),
      temAnuncio: false,
      temPerfil: false,
    };

    if (lado === "anuncio") atual.temAnuncio = true;
    else atual.temPerfil = true;

    mapa.set(chave, atual);
  }

  for (const c of conexoes) acumular(c, "anuncio");
  for (const p of paginas) acumular(p, "perfil");

  /*
   * ⚠️ "Sem cliente" vai para o FIM, sempre. Ordenado junto pelo nome ele cairia
   * no meio dos clientes de verdade, e a tela sugeriria que existe um cliente
   * chamado assim.
   */
  return [...mapa.values()].sort((a, b) => {
    if (a.chave === "sem") return 1;
    if (b.chave === "sem") return -1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
