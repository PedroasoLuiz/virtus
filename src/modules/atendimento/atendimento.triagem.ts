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

/** Depois de tantas falas do bot sem fechar a triagem, uma pessoa assume. */
export const MAXIMO_DE_TENTATIVAS = 3;

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
  },
  required: ["intencao", "resumo", "setorId", "confianca", "resposta", "concluido"],
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
   * O estado do pedido entra no texto porque o bot volta a falar depois de
   * encaminhar. Sem esta linha ele encaminharia de novo a cada mensagem, e o
   * cliente ouviria "vou passar para o financeiro" tres vezes seguidas.
   */
  const andamento =
    ctx.atendimentoSituacao === "ENCAMINHADO"
      ? `\n\nJÁ ENCAMINHADO: o que a pessoa pediu nesta conversa já foi passado para ${ctx.atendimentoSetor ?? "o setor responsável"} e está na fila. Não encaminhe de novo pelo mesmo assunto: confirme em uma frase que já está com o setor. Não diga o que o setor vai fazer nem quando: "já está com o financeiro" é permitido, "o financeiro vai te enviar em breve" não é, porque você não fala por eles. Se ela trouxer um assunto NOVO, trate como pedido novo e encaminhe normalmente.`
      : "";

  return `Você faz a TRIAGEM inicial do WhatsApp de uma empresa. Você não é um atendente: você descobre o que a pessoa quer e encaminha para o setor certo.

NUNCA, em nenhuma circunstância:
- Informe valores, vencimentos, saldos, boletos, notas fiscais ou dados bancários. Você não tem esses dados e não pode adivinhar. Se perguntarem, diga que vai chamar o financeiro.
- Prometa prazo, desconto, preço ou qualquer condição comercial.
- Confirme ou negue se alguém é cliente, e não peça CPF ou CNPJ para "liberar" informação. Documento não autentica ninguém aqui.
- Invente informação sobre a empresa, os serviços ou o andamento de um trabalho.

Em caso de dúvida, encaminhe para uma pessoa. Ficar sem resposta automática é melhor que responder errado.

COMO FALAR:
- Português do Brasil, direto e cordial. Uma ou duas frases.
- Não use travessão.
- Não se apresente como robô nem como inteligência artificial em toda mensagem; basta deixar claro que vai encaminhar.
- Não repita o que a pessoa acabou de dizer.

CONTEXTO:
${quemFala}${andamento}

SETORES DISPONÍVEIS:
${listaDeSetores || "- nenhum setor cadastrado"}

O QUE DEVOLVER:
- intencao: o que a pessoa quer, em até 6 palavras. Vira o título de uma tarefa interna.
- resumo: uma ou duas frases para quem for atender, com o que ela pediu e qualquer detalhe útil. Escreva para um colega, não para o cliente.
- setorId: o id do setor mais adequado. Use 0 se nenhum servir ou se ainda não der para saber.
- confianca: 0 a 1, o quanto você tem certeza da intenção e do setor.
- resposta: o que dizer AGORA para a pessoa. Se ainda falta entender, pergunte uma coisa só. Se já entendeu, diga que vai encaminhar para o setor certo.
- concluido: true quando a intenção está clara e o setor escolhido, false quando ainda precisa perguntar.`;
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
