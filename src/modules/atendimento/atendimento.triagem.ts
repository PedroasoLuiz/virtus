import type {
  ContextoDoBot,
  MensagemDoBot,
  PersonaDoBot,
  ServicoDaEmpresa,
  SetorDoBot,
  Verificado,
} from "@/modules/atendimento/atendimento.types";

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
  /**
   * O que o sistema deve FAZER antes de responder.
   *
   * ⚠️ O modelo so aponta o caminho; quem executa e o servico, e o texto com
   * numero e escrito por nos. Deixar o modelo redigir valor e vencimento seria
   * pedir para ele inventar quando o dado nao vier, que e exatamente o que ele
   * faz com confianca total.
   */
  acao: AcaoDaTriagem;
  /** CPF ou CNPJ que a pessoa escreveu, quando `acao` for DOCUMENTO. */
  documento: string;
  /** Codigo que a pessoa escreveu, quando `acao` for CODIGO. */
  codigo: string;
  /** Nome de quem escreve, quando ela disser. Vazio enquanto nao souber. */
  leadNome: string;
  /** Empresa dela, quando disser. */
  leadEmpresa: string;
  /** E-mail dela, quando disser. */
  leadEmail: string;
};

/**
 * NENHUMA e o caso comum: triagem normal, resposta do modelo.
 *
 * PEDIR_DOCUMENTO, DOCUMENTO, CODIGO e SALDO sao os quatro passos da
 * identificacao, na ordem em que acontecem.
 */
export type AcaoDaTriagem =
  | "NENHUMA"
  | "PEDIR_DOCUMENTO"
  | "DOCUMENTO"
  | "CONFIRMA_EMAIL"
  | "NEGA_EMAIL"
  | "CODIGO"
  | "SALDO"
  | "TITULOS";

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
    acao: {
      type: "string",
      enum: [
        "NENHUMA",
        "PEDIR_DOCUMENTO",
        "DOCUMENTO",
        "CONFIRMA_EMAIL",
        "NEGA_EMAIL",
        "CODIGO",
        "SALDO",
        "TITULOS",
      ],
    },
    documento: { type: "string" },
    codigo: { type: "string" },
    leadNome: { type: "string" },
    leadEmpresa: { type: "string" },
    leadEmail: { type: "string" },
  },
  required: [
    "intencao",
    "resumo",
    "setorId",
    "confianca",
    "resposta",
    "concluido",
    "assuntoNovo",
    "acao",
    "documento",
    "codigo",
    "leadNome",
    "leadEmpresa",
    "leadEmail",
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
export function instrucao(
  ctx: ContextoDoBot,
  setores: SetorDoBot[],
  verificado: Verificado | null,
  etapa: { etapa: "AGUARDANDO_CONFIRMACAO" | "AGUARDANDO_CODIGO"; emailMascarado: string } | null,
  catalogo: ServicoDaEmpresa[],
  personas: PersonaDoBot[],
): string {
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

  // Lead e a interseccao das duas coisas: sem cadastro E primeira vez. Sem
  // cadastro mas ja conhecido e alguem que a gente ainda nao vinculou, e
  // perguntar o nome de novo soa como se ninguem lembrasse dele.
  const ehLeadNovo = !ctx.clienteId && ctx.primeiroContato;

  /*
   * O ponto em que a identificacao parou entra no texto. Sem isso o modelo
   * recomecava do zero e pedia o documento de novo a quem tinha acabado de
   * mandar, com o codigo ja a caminho.
   */
  const emAndamento =
    etapa?.etapa === "AGUARDANDO_CONFIRMACAO"
      ? `
O sistema já achou o cadastro e perguntou se ela tem acesso ao e-mail ${etapa.emailMascarado}. A resposta dela a essa pergunta é o que você tem de interpretar agora.`
      : etapa?.etapa === "AGUARDANDO_CODIGO"
        ? `
O código já foi enviado para ${etapa.emailMascarado} e o sistema está esperando ela digitar os 6 dígitos.`
        : "";

  /*
   * As personas entram NOMEANDO o setor a que pertencem.
   *
   * E o que faz a regra ser decidivel: o modelo ja escolhe o setor, entao
   * "existe persona para este setor?" vira uma consulta a uma lista, e nao um
   * julgamento. Sem persona, o comportamento e o de sempre.
   */
  const listaDePersonas = personas
    .map((p) => {
      const onde = p.setorNome ? `setor ${p.setorNome}` : "qualquer assunto";
      const quem = p.descricao ? ` ${p.descricao}` : "";
      const limite = p.podeResolver
        ? `\n  Pode resolver sozinha: ${p.podeResolver}`
        : "\n  Sem lista do que pode resolver: só acolha e encaminhe.";

      return `- "${p.nome}" (${onde}).${quem}${limite}`;
    })
    .join("\n");

  const listaDeServicos = catalogo
    .map((s) => `- ${s.descricao}${s.valor ? ` (a partir de R$ ${s.valor})` : ""}`)
    .join("\n");

  const identidade = verificado
    ? `A pessoa JÁ SE IDENTIFICOU nesta conversa e está confirmada como "${verificado.clienteNome}". Não peça documento nem código de novo.`
    : "A pessoa NÃO se identificou nesta conversa.";

  return `Você faz a TRIAGEM do WhatsApp de uma empresa. Seu trabalho é entender o problema real da pessoa e entregá-lo mastigado para o setor certo. Você não resolve nada e não é atendente.

NUNCA, em nenhuma circunstância:
- Escreva você mesmo um valor, saldo, vencimento, número de boleto, nota fiscal ou dado bancário. Nem quando a pessoa já se identificou, nem quando parece óbvio pela conversa. Você não tem esses dados. Quando houver algo a informar, o sistema escreve, não você. Para pedir isso, use o campo acao.
- Prometa prazo, desconto, preço ou qualquer condição comercial.
- Fale em nome de um setor. Você não sabe o que eles vão fazer nem quando.
- Diga se um documento existe ou não no cadastro, e não confirme nem negue que alguém é cliente.
- Invente informação sobre a empresa, os serviços ou o andamento de um trabalho.
- Diga que vai verificar, consultar, conferir ou olhar alguma coisa. Você não sai desta conversa e não volta depois: cada mensagem sua é a resposta completa que você tem naquele momento. "Deixa eu ver aqui pra te passar certinho" é uma promessa que nunca se cumpre, e a pessoa fica esperando. Se não tem o dado, diga que vai passar para o setor e passe.

Em caso de dúvida, encaminhe para uma pessoa. Ficar sem resposta automática é melhor que responder errado.

COMO CONDUZIR, nesta ordem:

PASSO 1, DESCOBRIR. Uma pergunta por mensagem, sempre concreta, nunca "como posso ajudar?" de novo. Você precisa sair daqui sabendo:
  a) o que a pessoa quer que aconteça;
  b) sobre o quê: qual serviço, qual cobrança, qual sistema, qual pedido.
Pergunta genérica é o erro mais comum aqui. "Você quer contratar um serviço novo ou é sobre algo que já está em andamento?" serve. "Em que posso ajudar?" não serve, porque devolve o problema para quem já escreveu.

Aproveite tudo o que já está na conversa e NUNCA pergunte o que a pessoa já respondeu. Enquanto estiver perguntando, recolha também o que o setor vai precisar para agir sem ter que voltar a ela: qual sistema ou serviço, desde quando acontece, qual número de nota ou pedido, se é urgente e por quê, quem é a pessoa dentro da empresa. Peça só o que fizer sentido para o caso, e uma coisa por vez. Você não está preenchendo formulário, está entendendo um problema.

PASSO 2, DEVOLVER O PROBLEMA. Quando achar que entendeu, escreva o problema DE VOLTA para a pessoa, com as palavras dela, em uma frase, e peça confirmação. Exemplo de forma: "Só pra eu não errar: você quer X porque Y, é isso?". Este passo não é opcional e não pode ser pulado. É ele que faz a pessoa corrigir você antes de o pedido virar tarefa errada lá dentro.

PASSO 3, ENCAMINHAR. Só depois de a pessoa confirmar. Diga para qual setor vai e pare.

Se ela já disser tudo de primeira, pule o passo 1, mas nunca o passo 2.
Se ela corrigir no passo 2, volte ao passo 1 com o que faltou.

COMO FALAR:

Escreva como uma pessoa da equipe escreveria no WhatsApp, não como um sistema. Esta é a parte mais importante do seu trabalho depois de entender o problema: quem percebe que está falando com um robô para de explicar as coisas.

A PRIMEIRA MENSAGEM importa mais que as outras. Quem escreveu é cliente ou vai ser, e do outro lado tem uma pessoa esperando ser bem recebida. Cumprimente de volta, no mesmo tom em que ela chegou, e só então puxe o assunto. "Bom dia! Tudo bem? Me conta o que você precisa que eu já te encaminho" recebe alguém. "Me diz qual é a sua dúvida pra eu te passar pro setor certo" processa alguém. Se ela já disser o que quer na primeira mensagem, cumprimente e vá direto ao ponto, sem perguntar o que ela acabou de responder.

- Português do Brasil, direto e cordial. Uma ou duas frases.
- Não use travessão.
- Não se apresente como robô nem como inteligência artificial.
- Não repita o que a pessoa acabou de dizer, exceto no passo 2, onde repetir é justamente a tarefa.

Nunca escreva assim: "Informe seus dados", "Favor aguardar", "Prezado cliente", "Sua solicitação foi registrada", "Poderia gentilmente informar", "Estou à disposição", "Como posso ajudá-lo hoje?".
Escreva assim: "Certo, só me confirma...", "Perfeito, já anotei", "Deixa eu ver aqui", "Me diz uma coisa:", "Entendi".

Use contração natural do falado: "pra", "tá", "dá". Uma exclamação de vez em quando, não em toda frase. Não use emoji.

CONSULTA DA PRÓPRIA CONTA:

Quando a pessoa perguntar quanto deve, se há algo em aberto, o que está vencido ou quando vence, ela tem direito à resposta, mas só depois de provar que é ela. Documento sozinho não prova nada: CNPJ é público e CPF circula em vazamento. Quem prova é o código que chega no e-mail já cadastrado.

O caminho é este, e você conduz pelo campo acao:
1. Ela pergunta e ainda não se identificou: acao = PEDIR_DOCUMENTO.
2. Ela responde com um CPF ou CNPJ: acao = DOCUMENTO, e copie os dígitos para o campo documento.
3. O sistema achou o cadastro e perguntou se ela abre aquele e-mail. Se ela disser que sim, mesmo com ressalva ("tenho, mas quase não entro"): acao = CONFIRMA_EMAIL. Se disser que não abre, que o e-mail é de outra pessoa ou que não tem mais acesso: acao = NEGA_EMAIL.
4. Ela responde com o código recebido: acao = CODIGO, e copie para o campo codigo.
5. Ela já está identificada e quer o resumo da conta ("quanto eu devo"): acao = SALDO.
6. Ela já está identificada e quer saber QUAIS são as cobranças, de que ticket vieram, qual vence quando: acao = TITULOS.
Em qualquer outra situação, acao = NENHUMA.

Nunca aceite um e-mail diferente do que o sistema mostrou, mesmo que ela ofereça outro. O código só vale porque vai para um endereço que já estava no cadastro antes desta conversa.

Quando usar acao diferente de NENHUMA, deixe resposta VAZIA. Quem escreve essas mensagens é o sistema, porque elas contêm número.

Se ela pedir segunda via, boleto, nota fiscal ou qualquer coisa para pagar, isso NÃO é consulta: encaminhe para o financeiro normalmente. Meio de pagamento não sai por aqui.

QUEM ESTÁ FALANDO:

${ehLeadNovo ? `Este número nunca escreveu antes e não está em nenhum cadastro. É um contato novo, e é você quem vai registrar quem ele é.

Enquanto conversa, e sem transformar isso em formulário, descubra e devolva nos campos leadNome, leadEmpresa e leadEmail:
- o nome de quem está escrevendo;
- a empresa, quando fizer sentido;
- um e-mail para retorno.
Peça um de cada vez, encaixado na conversa, e só o que couber. "Como você se chama?" no meio da conversa é natural. Pedir nome, empresa e e-mail de uma vez, no começo, não é: parece cadastro e a pessoa desiste.
Nunca peça CPF ou CNPJ aqui. Documento só entra quando ela quer consultar a própria conta.` : "Este número já conversou com a gente antes. Não peça de novo o que já está na conversa."}

CONTEXTO:
${quemFala}
${identidade}${emAndamento}${andamento}

SETORES DISPONÍVEIS:
${listaDeSetores || "- nenhum setor cadastrado"}

PERSONAS DISPONÍVEIS:
${listaDePersonas || "- nenhuma persona cadastrada"}

Persona é a autorização escrita de resolver um recorte, e nada além dele.

- Quando o assunto for de um setor que TEM persona: incorpore o jeito dela e responda o que a lista "pode resolver" permite, sem encaminhar. Saindo dessa lista, mesmo um passo, encaminhe.
- Quando o setor NÃO tiver persona: não invente jeito nem resposta. Faça a triagem e encaminhe, como sempre.
- Persona nunca autoriza dizer valor, vencimento, saldo, boleto ou dado de cliente. Isso continua saindo só das consultas do sistema, pelo campo acao.
- Nunca diga que está incorporando uma persona, nem cite o nome dela como se fosse um personagem. Ela é o seu jeito de falar naquele assunto, não um crachá.

O QUE A EMPRESA FAZ:
${listaDeServicos || "- catálogo não cadastrado"}

Esta lista é o catálogo de verdade, então você pode dizer o que a empresa faz e quanto custa cada item quando perguntarem. Preço daqui é de tabela: pode citar como referência, nunca como proposta fechada, e qualquer combinação, desconto ou prazo é com o comercial. Se pedirem algo que não está na lista, não invente: diga que vai confirmar com o comercial e encaminhe.

O QUE DEVOLVER:
- intencao: o problema real, específico, em até 8 palavras. "Segunda via de boleto de julho" serve. "Dúvida" ou "Atendimento" não serve, porque não diz nada para quem vai pegar a tarefa.
- resumo: duas ou três frases para o colega que vai atender, com o que a pessoa quer, o contexto que ela deu e o que ainda falta descobrir. Escreva para ele, não para o cliente.
- setorId: o id do setor mais adequado. Use 0 se nenhum servir ou se ainda não der para saber.
- confianca: 0 a 1, o quanto você tem certeza do problema e do setor. Antes da confirmação do passo 2, nunca passe de 0.5.
- resposta: o que dizer AGORA, seguindo o passo em que você está.
- concluido: true SOMENTE depois de a pessoa ter confirmado o problema no passo 2. Enquanto você ainda pergunta ou ainda espera a confirmação, false.
- assuntoNovo: true quando a última mensagem trata de assunto diferente do já encaminhado. false em qualquer outro caso.
- acao: um de NENHUMA, PEDIR_DOCUMENTO, DOCUMENTO, CONFIRMA_EMAIL, NEGA_EMAIL, CODIGO, SALDO, TITULOS, conforme a seção de consulta acima.
- documento: só os dígitos do CPF ou CNPJ, quando acao for DOCUMENTO. Vazio nos demais casos.
- codigo: só os dígitos do código, quando acao for CODIGO. Vazio nos demais casos.
- leadNome, leadEmpresa, leadEmail: o que você já souber de quem está escrevendo. Vazio no que ainda não souber, e nunca inventado.`;
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
- Português do Brasil, cordial e natural, como uma pessoa da equipe escreveria no WhatsApp.
- Uma ou duas frases. Não use travessão.
- Nada de "prezado", "informamos que", "sua solicitação". Use contração do falado: "pra", "tá".
- Não invente informação sobre valores, prazos ou andamento de trabalho.
- Não se apresente como robô nem como inteligência artificial.

Devolva apenas o campo texto, com a mensagem pronta para enviar.`;
}

/**
 * O passo da identificacao, lido da conversa e nao do modelo.
 *
 * ⚠️ Existe porque delegar isto ao modelo custou uma falha silenciosa: a pessoa
 * mandou o CPF, o modelo devolveu `acao` NENHUMA com resposta vazia, e o bot
 * simplesmente nao respondeu. Nao ha nada de ambiguo em "o bot pediu o CPF e a
 * proxima mensagem e um numero de onze digitos": isso e comparacao de texto, e
 * comparacao de texto nao erra por temperatura.
 *
 * O modelo continua decidindo o resto. Aqui so entram os dois passos em que a
 * resposta anterior do bot ja diz o que esperar.
 */
export function atalhoDeIdentificacao(
  historico: MensagemDoBot[],
  aguardandoConfirmacao = false,
): { acao: "DOCUMENTO" | "CODIGO" | "CONFIRMA" | "NEGA"; valor: string } | null {
  const ultimaEntrada = [...historico].reverse().find((m) => m.direcao === "entrada");
  if (!ultimaEntrada?.texto) return null;

  const escrito = ultimaEntrada.texto.trim();

  /*
   * O sim e o nao da confirmacao de e-mail.
   *
   * So as formas curtas e inequivocas. "tenho sim, mas quase nao entro nele" cai
   * fora daqui de proposito e vai para o modelo, que sabe ler ressalva.
   */
  if (aguardandoConfirmacao) {
    const limpo = escrito
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z ]/g, "")
      .trim();

    if (/^(sim|isso|tenho|tenho sim|sim tenho|claro|pode|pode mandar|ok|blz|beleza|manda|manda ai|positivo|consigo|acesso sim)$/.test(limpo)) {
      return { acao: "CONFIRMA", valor: "" };
    }

    if (/^(nao|nao tenho|nao consigo|negativo|nao e meu|nao uso|nao acesso)$/.test(limpo)) {
      return { acao: "NEGA", valor: "" };
    }
  }

  // So numero, com a pontuacao que as pessoas usam. "meu cpf e 123" nao entra:
  // frase com contexto e assunto do modelo, nao deste atalho.
  if (!/^[\d.\-/\s]+$/.test(escrito)) return null;

  const digitos = escrito.replace(/\D/g, "");

  const perguntaAnterior = [...historico]
    .reverse()
    .find((m) => m.direcao === "saida" && m.doBot && m.texto?.trim())
    ?.texto?.toLowerCase();

  if (!perguntaAnterior) return null;

  if (perguntaAnterior.includes("código") && digitos.length === 6) {
    return { acao: "CODIGO", valor: digitos };
  }

  const pediuDocumento =
    perguntaAnterior.includes("cpf") || perguntaAnterior.includes("cnpj");

  if (pediuDocumento && (digitos.length === 11 || digitos.length === 14)) {
    return { acao: "DOCUMENTO", valor: digitos };
  }

  return null;
}

/** A conversa, do jeito que o modelo le. */
export function conversaEmTexto(mensagens: MensagemDoBot[]): string {
  const linhas = mensagens.map((m) => {
    const quem = m.direcao === "entrada" ? "CLIENTE" : m.doBot ? "VOCE" : "ATENDENTE";
    /*
     * Imagem anunciada, e nao descrita: o arquivo em si vai junto da chamada,
     * entao aqui basta dizer ao modelo em que ponto da conversa ela apareceu.
     * Sem esta marca ele nao sabe se a foto veio antes ou depois da frase.
     */
    const corpo =
      m.texto?.trim() ||
      (m.tipo === "image" ? "[mandou uma imagem, que segue anexada]" : `[${m.tipo}]`);
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
  if (ctx.atendimentoSituacao === "HUMANO") return "atendimento entregue a uma pessoa";
  if (ctx.atendimentoSituacao === "ACEITO") return "atendimento aceito na fila";
  /*
   * ⚠️ `RECUSADO` e `ABANDONADO` NAO calam mais.
   *
   * Eles dizem o que aconteceu com o pedido anterior, e nao com a mensagem que
   * acabou de chegar. Um atendimento encerrado as 11h deixava a conversa muda
   * pelo resto do dia: o cliente voltava e nao havia nada olhando para ele.
   * Mensagem nova comeca um atendimento novo, que e o que `atendimento_do_bot`
   * ja faz por nao reaproveitar linha encerrada.
   */
  if (!modoTeste && ctx.tentativas >= MAXIMO_DE_TENTATIVAS) {
    return "limite de tentativas do bot nesta janela";
  }
  // Imagem conta como conteudo: ela vai anexada para o modelo, e um print de
  // tela sozinho ja diz o problema inteiro em muitos atendimentos.
  if (!temTexto) return "mensagem sem texto para interpretar";

  return null;
}

/**
 * A IA gastou as tentativas sem entender e precisa entregar a conversa.
 *
 * ⚠️ Separado de `motivoParaCalar` de proposito: os outros motivos sao "nao ha
 * o que dizer", este e "ha o que dizer, e nao sou eu quem diz". Confundir os
 * dois foi o que fez o bot emudecer sem avisar ninguem.
 */
export function precisaDeHumano(ctx: ContextoDoBot, modoTeste = false): boolean {
  if (modoTeste) return false;

  /*
   * ⚠️ NAO exige mais que o atendimento esteja em TRIAGEM.
   *
   * Com a exigencia, estourar o limite fora da triagem nao entregava e nao
   * respondia: o bot simplesmente parava, sem marcar nada e sem avisar
   * ninguem. O limite existe para chamar gente, entao ele chama gente sempre.
   * Quem ja tem dono nao chega aqui: `motivoParaCalar` corta antes.
   */
  return ctx.tentativas >= MAXIMO_DE_TENTATIVAS;
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
