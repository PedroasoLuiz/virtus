import type { FamiliaDeResultado } from "@/shared/domain/insights";

/**
 * O vocabulario do painel, escrito para quem PAGA o anuncio.
 *
 * ⚠️ Fora da tela porque e texto de produto, e nao codigo de tela: mudar uma
 * definicao nao deveria exigir abrir o arquivo que desenha os cartoes.
 */

/**
 * O que cada medida quer dizer, em uma frase.
 *
 * ⚠️ Escrito para quem PAGA o anúncio, e não para quem o opera. Esta tela é a
 * que se mostra ao cliente, e "razão entre cliques e impressões" não explica
 * nada a quem nunca viu a sigla. Cada texto diz o que é e o que um número alto
 * ou baixo significa, que é a pergunta seguinte de quem acabou de aprender.
 */
export const GLOSSARIO = {
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


/** O singular de cada família, para o rótulo do custo. */
export const UNIDADE: Record<FamiliaDeResultado, string> = {
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


export function ajudaDaFamilia(familia: FamiliaDeResultado | null): string {
  return familia == null ? GLOSSARIO.resultados : AJUDA_DA_FAMILIA[familia];
}
