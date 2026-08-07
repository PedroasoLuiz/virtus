import type { PersonaDoBot } from "@/modules/atendimento/atendimento.types";

/**
 * A persona que atende quando a empresa nao configurou nenhuma.
 *
 * ⚠️ Existe porque a maioria nunca vai abrir a tela de personas. Sem ela, quem
 * assina o contrato e liga o numero recebe um bot sem nome, sem tom e sem
 * autorizacao para nada — e conclui que "a IA nao funciona". O padrao entrega um
 * atendimento inteiro no primeiro dia, e quem quiser mais mexe depois.
 *
 * ⚠️ Ela CEDE o lugar. Cadastrada uma persona geral da empresa, esta some: o
 * padrao e piso, nao teto. Persona de setor continua vencendo as duas.
 *
 * ⚠️ As permissoes dela nao sao um risco novo. Consulta de cadastro passa pela
 * identificacao verificada de qualquer jeito — documento mais o codigo enviado
 * ao e-mail do cadastro — e e ESSA a trava. A permissao decide o assunto; a
 * verificacao decide a quem. Deixar o padrao sem consulta nenhuma so faria o
 * cliente leigo ter um bot que nao resolve nada.
 */
export const PERSONA_PADRAO: PersonaDoBot = {
  nome: "Atendimento",
  descricao:
    "Recebe bem, escuta antes de resolver e fala como gente. É objetiva sem ser seca, confirma o que entendeu antes de encaminhar e nunca deixa a pessoa sem saber o próximo passo.",
  evitar:
    "prometer prazo ou valor\nusar linguagem de call center\nrepetir o que a pessoa acabou de dizer\nencerrar sem confirmar que ficou resolvido",
  saudacao: null,
  podeResolver: null,
  permissoes: ["titulos", "saldo", "servicos", "horarios"],
  setorId: null,
  setorNome: null,
};

/**
 * A saudacao pronta, para o "oi" nao custar uma chamada ao provedor.
 *
 * ⚠️ Texto FIXO, e nao gerado. Um "bom dia" solto nao tem nada a decidir: o
 * modelo leria a conversa inteira, pensaria, e devolveria a mesma frase. Numa
 * base com milhares de conversas isso e uma chamada paga por cumprimento, todo
 * dia, para produzir o que ja se sabia escrever.
 *
 * ⚠️ Varia com a hora e com o nome porque saudacao identica em toda conversa e
 * o jeito mais rapido de a pessoa perceber que fala com um robo — que e
 * exatamente o que a primeira mensagem nao pode entregar.
 */
export function saudacaoPronta(
  primeiroNome: string | null,
  agora: Date,
  contexto: { conhecido: boolean; modelo: string | null },
): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(agora),
  );

  const periodo = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const nome = primeiroNome?.trim() ?? "";

  /*
   * O texto da empresa vence o nosso.
   *
   * ⚠️ `{nome}` sai antes do `{periodo}` de proposito: quem escreve costuma
   * comecar a frase com o periodo, e trocar na ordem inversa deixaria um
   * "Bom dia, {nome}" com o nome vazio virando "Bom dia, !".
   */
  if (contexto.modelo?.trim()) {
    return contexto.modelo
      .replace(/\{periodo\}/gi, periodo)
      .replace(/,?\s*\{nome\}/gi, nome ? `, ${nome}` : "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const abertura = nome ? `${periodo}, ${nome}!` : `${periodo}!`;

  /*
   * ⚠️ Quem NAO tem cadastro recebe outra frase.
   *
   * Numero desconhecido em primeiro contato quase sempre e alguem chegando pela
   * primeira vez, e "me conta o que voce precisa" trata isso como protocolo. E
   * a mensagem que decide se essa pessoa vira cliente: ela merece ser recebida,
   * e nao processada.
   */
  return contexto.conhecido
    ? `${abertura} Tudo bem? Me conta o que você precisa.`
    : `${abertura} Que bom ter você por aqui. Me conta o que você procura que eu te ajudo.`;
}

/**
 * A mensagem e SO um cumprimento?
 *
 * ⚠️ Curta e sem pergunta. "Bom dia, preciso da segunda via" tem assunto e vai
 * para a triagem normal; "bom dia" sozinho nao tem o que triar. O limite de
 * tamanho existe porque a lista de cumprimentos aparece dentro de frases
 * inteiras, e casar por conter faria qualquer texto que comece com "oi" pular a
 * triagem.
 */
const CUMPRIMENTOS = [
  "oi",
  "ola",
  "opa",
  "eai",
  "e ai",
  "bom dia",
  "boa tarde",
  "boa noite",
  "oi tudo bem",
  "ola tudo bem",
  "boa",
  "salve",
];

export function ehSoCumprimento(texto: string): boolean {
  const limpo = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!limpo || limpo.length > 30) return false;

  return CUMPRIMENTOS.includes(limpo);
}
