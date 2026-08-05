import type { ContextoDoBot, MensagemDoBot, SetorDoBot } from "@/modules/atendimento/atendimento.types";

/**
 * O que o bot le e o que ele devolve.
 *
 * Separado do servico de proposito: aqui e texto e formato, sem rede e sem
 * banco. E a parte que muda toda semana enquanto se afina a triagem, e a que da
 * para ler inteira antes de mudar.
 */

/**
 * O numero da conversa e o numero de teste sao a mesma pessoa?
 *
 * Compara os 8 ultimos digitos, pelo mesmo motivo do vinculo com o cadastro: o
 * nono digito do celular entra e sai, e o `wa_id` da Meta as vezes vem sem ele.
 */
export function ehONumeroDeTeste(telefone: string, numerosDeTeste: string): boolean {
  const alvo = telefone.replace(/\D/g, "");
  if (alvo.length < 8) return false;

  // Aceita virgula, ponto e virgula ou quebra de linha: quem cola tres numeros
  // nao vai lembrar qual separador o campo espera.
  return numerosDeTeste
    .split(/[,;\n]/)
    .map((n) => n.replace(/\D/g, ""))
    .filter((n) => n.length >= 8)
    .some((n) => n.slice(-8) === alvo.slice(-8));
}

/** Abaixo disto o bot nao encaminha sozinho: entrega para uma pessoa decidir. */
export const CONFIANCA_MINIMA = 0.6;

/**
 * Depois de tantas falas do bot sem fechar a triagem, uma pessoa assume.
 *
 * Eram tres, e tres nao davam: a triagem passou a exigir descobrir, devolver o
 * entendimento e esperar a confirmacao. So o roteiro certo ja gasta as tres, e
 * o bot desistia justamente na mensagem em que ia encaminhar.
 */
export const MAXIMO_DE_TENTATIVAS = 6;

export type Triagem = {
  /** O que a pessoa quer, em poucas palavras. Vira o titulo da tarefa. */
  intencao: string;
  /** O que ela disse, para quem atender nao precisar reler a conversa. */
  resumo: string;
  /** Id do setor, ou 0 quando o bot nao soube. */
  setorId: number;
  confianca: number;
  /** O que responder agora. Vazio quando nao ha o que dizer. */
  resposta: string;
  /** True quando ja da para entregar a uma pessoa. */
  concluido: boolean;
  /**
   * A pessoa mudou de assunto em relacao ao que ja foi encaminhado.
   *
   * ⚠️ Sem este campo o pedido novo sobrescrevia o antigo. Um cliente que pede
   * boleto e depois pede orcamento tem DOIS pedidos, e o segundo nao pode
   * apagar o primeiro da fila do financeiro.
   */
  assuntoNovo: boolean;
};

/**
 * Esquema que o provedor e obrigado a cumprir.
 *
 * `required` em tudo de proposito: campo faltando vira `undefined` no meio da
 * regra, e o erro aparece longe daqui.
 */
export const ESQUEMA_DA_TRIAGEM = {
  type: "object",
  properties: {
    intencao: { type: "string" },
    resumo: { type: "string" },
    setorId: { type: "integer" },
    confianca: { type: "number" },
    resposta: { type: "string" },
    concluido: { type: "boolean" },
    assuntoNovo: { type: "boolean" },
  },
  required: [
    "intencao",
    "resumo",
    "setorId",
    "confianca",
    "resposta",
    "concluido",
    "assuntoNovo",
  ],
};

/**
 * A instrucao do sistema.
 *
 * ⚠️ Este texto vai ACENTUADO, ao contrario dos comentarios do projeto. Ele nao
 * e comentario: e conteudo que o modelo le, e portugues sem acento e portugues
 * pior — muda a leitura de palavra e piora a resposta que volta.
 *
 * ⚠️ As proibicoes vem ANTES das tarefas, e sao explicitas.
 *
 * O modelo tem acesso ao nome do cliente e ao historico da conversa. Sem a
 * proibicao escrita, ele inventa valor de fatura e data de vencimento com toda
 * a confianca do mundo — e o cliente acredita, porque veio do numero oficial da
 * empresa. Um numero errado de cobranca e pior que nenhuma resposta.
 *
 * O mesmo vale para identidade: CNPJ e quase publico no Brasil. Ele serve para
 * ACHAR o cadastro, nunca para liberar informacao.
 */
export function instrucao(ctx: ContextoDoBot, setores: SetorDoBot[]): string {
  const listaDeSetores = setores
    .map((s) => `- id ${s.id} | ${s.nome}: ${s.quandoUsar ?? "sem descrição"}`)
    .join("\n");

  const quemFala = ctx.clienteNome
    ? `A pessoa escreve de um número ligado ao cadastro "${ctx.clienteNome}".`
    : "Não sabemos de quem é este número: não há cadastro com ele.";

  /*
   * O assunto ja encaminhado entra NOMEADO, e nao como "o que ela pediu".
   *
   * Dizer so "ja foi encaminhado" fazia o modelo tratar qualquer mensagem
   * seguinte como sendo do mesmo assunto: um "quero um serviço" recebeu de
   * volta a frase sobre o financeiro. Sem saber QUAL era o assunto anterior,
   * nao ha como perceber que mudou.
   */
  const andamento =
    ctx.atendimentoSituacao === "ENCAMINHADO"
      ? `

JÁ ENCAMINHADO NESTA CONVERSA: "${ctx.atendimentoIntencao ?? "um pedido anterior"}", que está com ${ctx.atendimentoSetor ?? "o setor responsável"}.
Antes de responder, decida: a última mensagem é sobre ESSE assunto ou sobre outro?
- Mesmo assunto (cobrando andamento, perguntando se chegou): responda que já está com o setor e nada mais. Não diga o que o setor vai fazer nem quando. "Já está com o financeiro" é permitido, "o financeiro vai te enviar em breve" não é, porque você não fala por eles. Marque assuntoNovo como false.
- Assunto diferente: esqueça o pedido anterior por completo e faça a triagem do novo do zero, começando pelo PASSO 1. Não mencione o pedido antigo. Marque assuntoNovo como true.`
      : "";

  return `Você faz a TRIAGEM do WhatsApp de uma empresa. Seu trabalho é entender o problema real da pessoa e entregá-lo mastigado para o setor certo. Você não resolve nada e não é atendente.

NUNCA, em nenhuma circunstância:
- Informe valores, vencimentos, saldos, boletos, notas fiscais ou dados bancários. Você não tem esses dados e não pode adivinhar. Se perguntarem, diga que vai chamar o financeiro.
- Prometa prazo, desconto, preço ou qualquer condição comercial.
- Fale em nome de um setor. Você não sabe o que eles vão fazer nem quando.
- Confirme ou negue se alguém é cliente, e não peça CPF ou CNPJ para "liberar" informação. Documento não autentica ninguém aqui.
- Invente informação sobre a empresa, os serviços ou o andamento de um trabalho.

Em caso de dúvida, encaminhe para uma pessoa. Ficar sem resposta automática é melhor que responder errado.

COMO CONDUZIR, nesta ordem:

PASSO 1, DESCOBRIR. Uma pergunta por mensagem, sempre concreta, nunca "como posso ajudar?" de novo. Você precisa sair daqui sabendo:
  a) o que a pessoa quer que aconteça;
  b) sobre o quê: qual serviço, qual cobrança, qual sistema, qual pedido.
Pergunta genérica é o erro mais comum aqui. "Você quer contratar um serviço novo ou é sobre algo que já está em andamento?" serve. "Em que posso ajudar?" não serve, porque devolve o problema para quem já escreveu.

PASSO 2, DEVOLVER O PROBLEMA. Quando achar que entendeu, escreva o problema DE VOLTA para a pessoa, com as palavras dela, em uma frase, e peça confirmação. Exemplo de forma: "Só pra eu não errar: você quer X porque Y, é isso?". Este passo não é opcional e não pode ser pulado. É ele que faz a pessoa corrigir você antes de o pedido virar tarefa errada lá dentro.

PASSO 3, ENCAMINHAR. Só depois de a pessoa confirmar. Diga para qual setor vai e pare.

Se ela já disser tudo de primeira, pule o passo 1, mas nunca o passo 2.
Se ela corrigir no passo 2, volte ao passo 1 com o que faltou.

COMO FALAR:
- Português do Brasil, direto e cordial. Uma ou duas frases.
- Não use travessão.
- Não se apresente como robô nem como inteligência artificial.
- Não repita o que a pessoa acabou de dizer, exceto no passo 2, onde repetir é justamente a tarefa.

CONTEXTO:
${quemFala}${andamento}

SETORES DISPONÍVEIS:
${listaDeSetores || "- nenhum setor cadastrado"}

O QUE DEVOLVER:
- intencao: o problema real, específico, em até 8 palavras. "Segunda via de boleto de julho" serve. "Dúvida" ou "Atendimento" não serve, porque não diz nada para quem vai pegar a tarefa.
- resumo: duas ou três frases para o colega que vai atender, com o que a pessoa quer, o contexto que ela deu e o que ainda falta descobrir. Escreva para ele, não para o cliente.
- setorId: o id do setor mais adequado. Use 0 se nenhum servir ou se ainda não der para saber.
- confianca: 0 a 1, o quanto você tem certeza do problema e do setor. Antes da confirmação do passo 2, nunca passe de 0.5.
- resposta: o que dizer AGORA, seguindo o passo em que você está.
- concluido: true SOMENTE depois de a pessoa ter confirmado o problema no passo 2. Enquanto você ainda pergunta ou ainda espera a confirmação, false.
- assuntoNovo: true quando a última mensagem trata de assunto diferente do já encaminhado. false em qualquer outro caso.`;
}

/** Uma frase e nada mais. Usado no lembrete e no encerramento. */
export const ESQUEMA_DA_MENSAGEM = {
  type: "object",
  properties: { texto: { type: "string" } },
  required: ["texto"],
};

/**
 * O texto de quem some no meio da conversa.
 *
 * Era frase fixa, e frase fixa se denuncia: chega igualzinha para quem parou no
 * "oi" e para quem descreveu um problema inteiro. Aqui o modelo escreve olhando
 * o que a pessoa ja tinha dito, entao o lembrete retoma o assunto dela em vez
 * de perguntar de novo o que ela ja respondeu.
 */
export function instrucaoDeFechamento(
  ctx: ContextoDoBot,
  tipo: "lembrete" | "encerramento",
): string {
  const assunto = ctx.atendimentoIntencao
    ? `O assunto que estava sendo tratado: "${ctx.atendimentoIntencao}".`
    : "Ainda não se sabia o que a pessoa queria.";

  const tarefa =
    tipo === "lembrete"
      ? `Escreva UMA mensagem curta retomando a conversa. Ela precisa:
- retomar o assunto pelo nome, para a pessoa saber do que você está falando;
- deixar fácil responder, sugerindo o que falta você saber;
- não cobrar, não reclamar da demora e não dizer que vai encerrar.`
      : `Escreva UMA mensagem curta encerrando o atendimento por falta de retorno. Ela precisa:
- deixar claro que está encerrando por aqui, sem soar como porta fechada;
- dizer que é só chamar de novo quando quiser, e que a conversa é retomada;
- não cobrar a pessoa pelo silêncio e não pedir desculpa por encerrar.`;

  return `Você cuida do WhatsApp de uma empresa. A pessoa parou de responder no meio de um atendimento.

${assunto}

${tarefa}

COMO FALAR:
- Português do Brasil, cordial e natural, como uma pessoa escreveria.
- Uma ou duas frases. Não use travessão.
- Não invente informação sobre valores, prazos ou andamento de trabalho.
- Não se apresente como robô nem como inteligência artificial.

Devolva apenas o campo texto, com a mensagem pronta para enviar.`;
}

/** A conversa, do jeito que o modelo le. */
export function conversaEmTexto(mensagens: MensagemDoBot[]): string {
  const linhas = mensagens.map((m) => {
    const quem = m.direcao === "entrada" ? "CLIENTE" : m.doBot ? "VOCE" : "ATENDENTE";
    const corpo = m.texto?.trim() || `[${m.tipo}]`;
    return `${quem}: ${corpo}`;
  });

  return linhas.join("\n");
}

/**
 * O bot deve falar nesta conversa?
 *
 * ⚠️ Tudo aqui e por JANELA de 24 horas, nao por conversa. O contexto ja chega
 * recortado do banco: fora da janela nao existe atendimento corrente, entao a
 * mensagem nova comeca do zero.
 *
 * `ENCAMINHADO` deixou de calar o bot, e essa foi a mudanca que importa. Ele
 * calava, e a conversa morria ali: o pedido ficava na fila, ninguem tinha pego
 * ainda, o cliente perguntava "e ai?" e nao vinha nada. Encaminhado significa
 * que o assunto tem dono, nao que a conversa acabou. Quem cala e a pessoa que
 * assume, que e o unico evento em que responder por cima atrapalha.
 */
export function motivoParaCalar(
  ctx: ContextoDoBot,
  temTexto: boolean,
  modoTeste = false,
): string | null {
  /*
   * Em modo de teste, duas travas saem do caminho.
   *
   * `humanoRespondeu` porque TODA conversa existente ja tem resposta de gente, e
   * o bot ficaria mudo em todas elas — nao haveria como testar. `tentativas`
   * porque testar e justamente repetir.
   */
  if (!modoTeste && ctx.humanoRespondeu) return "uma pessoa ja assumiu esta conversa";
  if (ctx.atendimentoAceito) return "atendimento aceito por uma pessoa";
  if (ctx.atendimentoSituacao === "ACEITO" || ctx.atendimentoSituacao === "RECUSADO") {
    return "atendimento ja encerrado nesta janela";
  }
  if (!modoTeste && ctx.tentativas >= MAXIMO_DE_TENTATIVAS) {
    return "limite de tentativas do bot nesta janela";
  }
  if (!temTexto) return "mensagem sem texto para interpretar";

  return null;
}

/**
 * A triagem fecha aqui, e nao no modelo.
 *
 * Confianca baixa encaminha para uma pessoa mesmo que o modelo diga
 * `concluido: true` — quem decide o corte e o codigo, porque o numero vem de
 * quem esta sendo avaliado.
 */
export function situacaoFinal(t: Triagem): "TRIAGEM" | "ENCAMINHADO" {
  const seguro = t.concluido && t.confianca >= CONFIANCA_MINIMA && t.setorId > 0;
  return seguro ? "ENCAMINHADO" : "TRIAGEM";
}
