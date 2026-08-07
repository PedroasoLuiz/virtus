/**
 * Para que o sistema manda mensagem, e o que ele sabe preencher.
 *
 * ⚠️ Esta lista e NOSSA e e fechada. Ela nao descreve os modelos do cliente:
 * descreve o que cada parte do sistema tem em maos na hora de enviar. Cobranca
 * sabe nome, valor, vencimento, ticket e link porque a parcela tem esses dados;
 * nao ha como oferecer uma variavel que o dominio nao produz.
 *
 * ⚠️ O nome do modelo NAO mora aqui, e essa e a mudanca que faz a coisa
 * funcionar. Antes o codigo procurava um template chamado `cobranca`, o que
 * obrigava todo cliente a aprovar um com esse nome exato, naquela ordem exata de
 * variaveis, e sem poder reescrever o texto — que e justamente para o que
 * template serve. Agora o cliente aprova o modelo dele, com o nome e as palavras
 * dele, e VINCULA a esta finalidade dizendo qual `{{n}}` recebe o que.
 *
 * Modulo novo que passar a enviar pelo WhatsApp entra como mais uma entrada
 * aqui, sem tabela nova e sem migracao.
 */

export type ChaveDeFinalidade = "cobranca" | "ticket" | "contapagar" | "aniversario";

/** Uma variavel que a finalidade sabe preencher. */
export type VariavelDeFinalidade = {
  chave: string;
  rotulo: string;
  /** O que e, em uma linha, para quem esta mapeando na tela. */
  descricao: string;
  /** Como sai de verdade. E o que a previa usa. */
  exemplo: string;
};

export type Finalidade = {
  id: ChaveDeFinalidade;
  rotulo: string;
  descricao: string;
  /**
   * Onde o sistema dispara esta finalidade hoje. Nulo enquanto nao dispara em
   * lugar nenhum.
   *
   * ⚠️ Existe para a tela nao PROMETER. Vincular um modelo a uma finalidade que
   * nada aciona e util — deixa pronto e aprovado antes de a tela existir — mas
   * quem vincula precisa saber que nenhuma mensagem vai sair ainda, senao a
   * conclusao e que o envio quebrou.
   */
  origem: string | null;
  variaveis: VariavelDeFinalidade[];
  /**
   * A variavel do BOTAO de URL, quando o modelo tiver um.
   *
   * ⚠️ Separada das outras porque na Meta ela e outra coisa: nao entra na
   * contagem de `{{n}}` do corpo e vai num componente proprio do envio.
   */
  botao: VariavelDeFinalidade | null;
  /** Sugestao de corpo para quem for criar o modelo no painel da Meta. */
  corpoSugerido: string;
};

export const FINALIDADES: Finalidade[] = [
  {
    id: "cobranca",
    /*
     * "Parcela em aberto" dizia o ESTADO, e nao de onde a mensagem sai. Ao lado
     * de "Parcela a pagar", as duas se pareciam demais para quem so bate o olho.
     */
    rotulo: "Disparo de conta a receber",
    descricao:
      "A cobrança de uma parcela de contas a receber. Quase sempre vai para quem não escreveu naquele dia, e por isso precisa de modelo aprovado.",
    origem: "Contas a receber, no botão de enviar por WhatsApp",
    variaveis: [
      {
        chave: "nome",
        rotulo: "Nome do cliente",
        descricao: "A razão social ou o nome fantasia do cadastro.",
        exemplo: "Padaria do Bairro",
      },
      {
        chave: "valor",
        rotulo: "Valor da parcela",
        descricao: "O total da parcela, sem o símbolo da moeda.",
        exemplo: "1.250,00",
      },
      {
        chave: "vencimento",
        rotulo: "Vencimento",
        descricao: "A data de vencimento da parcela, em dia/mês/ano.",
        exemplo: "10/09/2026",
      },
      {
        chave: "ticket",
        rotulo: "Tickets da conta",
        descricao:
          "O número do ticket da conta. Quando ela tem mais de um, todos saem juntos. Sem ticket nenhum, vai o número da própria conta.",
        exemplo: "154 ou 155",
      },
    ],
    botao: {
      chave: "link",
      rotulo: "Link da cobrança",
      descricao:
        "O trecho final da URL do botão. O começo do endereço já fica fixo no modelo aprovado, e é o mesmo link que vai no e-mail.",
      exemplo: "a3f9c2e1b7…",
    },
    /*
     * ⚠️ Os marcadores sobem em ORDEM de aparicao: `{{1}}`, `{{2}}`, `{{3}}`,
     * `{{4}}` na sequencia em que se le. A Meta exige numeracao sequencial, e
     * um texto que comeca no `{{1}}` e pula para o `{{4}}` e recusado na
     * aprovacao — por isso a sugestao nao amarra numero a significado: quem
     * decide o que entra em cada campo e o vinculo, na tela ao lado.
     */
    corpoSugerido:
      "Olá, {{1}}! 👋\n\n" +
      "Sua fatura referente ao *ticket nº {{2}}*, no valor de *R$ {{3}}*, com vencimento em {{4}}, já está disponível.\n\n" +
      "Para visualizar os detalhes, acesse pelo botão abaixo.\n\n" +
      "Em caso de dúvidas, estamos à disposição!",
  },
  {
    id: "ticket",
    rotulo: "Ticket para o cliente",
    descricao:
      "Avisa o cliente sobre uma ordem de serviço: que abriu, que andou, que fechou. O texto do modelo é que decide qual desses é.",
    origem: null,
    variaveis: [
      {
        chave: "cliente",
        rotulo: "Nome do cliente",
        descricao: "A razão social ou o nome fantasia do cadastro.",
        exemplo: "Padaria do Bairro",
      },
      {
        chave: "numero",
        rotulo: "Número do ticket",
        descricao: "O número que identifica a ordem de serviço.",
        exemplo: "154",
      },
      {
        chave: "titulo",
        rotulo: "Título do ticket",
        descricao: "O assunto da ordem de serviço, como está cadastrado.",
        exemplo: "Manutenção do compressor",
      },
      {
        chave: "status",
        rotulo: "Situação",
        descricao: "A coluna em que o ticket está no quadro.",
        exemplo: "Em execução",
      },
      {
        chave: "abertura",
        rotulo: "Data de abertura",
        descricao: "Quando o ticket foi aberto, em dia/mês/ano.",
        exemplo: "02/09/2026",
      },
    ],
    botao: null,
    corpoSugerido:
      "Olá {{1}}, seu chamado {{2}} ({{3}}) está com a situação: {{4}}. Aberto em {{5}}. Qualquer dúvida, é só responder por aqui.",
  },
  {
    id: "contapagar",
    rotulo: "Disparo de conta a pagar",
    descricao:
      "Uma parcela do contas a pagar, para o fornecedor. O destinatário aqui não é o seu cliente: é quem você paga.",
    origem: null,
    variaveis: [
      {
        chave: "fornecedor",
        rotulo: "Nome do fornecedor",
        descricao: "A razão social ou o nome fantasia do cadastro.",
        exemplo: "Distribuidora Sul",
      },
      {
        chave: "valor",
        rotulo: "Valor da parcela",
        descricao: "O total da parcela, sem o símbolo da moeda.",
        exemplo: "980,00",
      },
      {
        chave: "vencimento",
        rotulo: "Vencimento",
        descricao: "A data de vencimento da parcela, em dia/mês/ano.",
        exemplo: "15/09/2026",
      },
      {
        chave: "documento",
        rotulo: "Documento",
        descricao: "A nota ou o número do documento da conta.",
        exemplo: "NF 4471",
      },
    ],
    botao: null,
    corpoSugerido:
      "Olá {{1}}, sobre a parcela de R$ {{2}} com vencimento em {{3}}, referente a {{4}}. Segue nosso comprovante.",
  },
  {
    id: "aniversario",
    rotulo: "Aniversário do cliente",
    descricao:
      "A mensagem de parabéns. Sai sozinha, sem ninguém clicar, e por isso o texto do modelo precisa valer para qualquer cliente.",
    origem: null,
    variaveis: [
      {
        chave: "nome",
        rotulo: "Nome do cliente",
        descricao: "O nome de quem faz aniversário, como está no cadastro.",
        exemplo: "Marina",
      },
      {
        chave: "empresa",
        rotulo: "Nome da sua empresa",
        descricao: "Quem está mandando os parabéns.",
        exemplo: "Vpay Serviços",
      },
    ],
    botao: null,
    corpoSugerido: "Feliz aniversário, {{1}}! Um abraço de toda a equipe da {{2}}.",
  },
];

export function finalidadePorId(id: string): Finalidade | null {
  return FINALIDADES.find((f) => f.id === id) ?? null;
}

/**
 * Um vinculo: qual modelo do cliente atende a finalidade, e o que cada `{{n}}`
 * recebe.
 *
 * `parametros` e POSICIONAL: o indice 0 e o `{{1}}`. E a unica forma que a Meta
 * aceita, e por isso a tela mapeia marcador a marcador em vez de pedir ordem.
 */
export type VinculoDeModelo = {
  finalidade: ChaveDeFinalidade;
  modeloNome: string;
  idioma: string;
  parametros: string[];
  /** A chave que preenche a URL do botao. Nulo quando o modelo nao tem botao. */
  botaoParam: string | null;
  /**
   * O texto do modelo no momento do vinculo, e quantos `{{n}}` ele tinha.
   *
   * ⚠️ Guardados para o envio NAO precisar perguntar a Meta. Ler a lista de
   * modelos a cada mensagem multiplica por empresa, por usuario e por parcela
   * disparada, e a Meta limita chamadas: um lote de 200 cobrancas gastava 200
   * leituras so para reconferir o que ja fora conferido ao salvar.
   */
  corpo: string | null;
  campos: number;
  /** Quando a conferencia contra a Meta aconteceu. Nulo em vinculo antigo. */
  validadoEm: string | null;
  /**
   * O que a Meta respondeu na ultima recusa. Nulo enquanto vai bem.
   *
   * ⚠️ E o que substitui a reconferencia constante: em vez de perguntar sempre,
   * o sistema confia no que validou e so muda de ideia quando um envio de
   * verdade falha. Salvar de novo limpa isto.
   */
  erro: string | null;
  erroEm: string | null;
};

/**
 * O que impede o vinculo de valer, em portugues.
 *
 * ⚠️ Confere contra o modelo LIDO DA META, e nao contra o que a tela mandou. A
 * quantidade de `{{n}}` muda quando alguem edita o template no painel, e um
 * vinculo que era valido ontem passa a mandar parametro a mais — que a Meta
 * recusa no momento do envio, com o cliente esperando.
 */
export function problemasDoVinculo(
  v: VinculoDeModelo,
  modelo: { parametros: number } | null,
): string[] {
  const erros: string[] = [];
  const finalidade = finalidadePorId(v.finalidade);

  if (!finalidade) return ["Finalidade desconhecida"];
  if (!v.modeloNome) return ["Escolha o modelo aprovado que atende esta finalidade"];
  if (!modelo) return [`O modelo "${v.modeloNome}" não está aprovado neste número`];

  if (v.parametros.length !== modelo.parametros) {
    erros.push(
      `Este modelo tem ${modelo.parametros} campo(s) e o vínculo preencheu ${v.parametros.length}`,
    );
  }

  const conhecidas = new Set(finalidade.variaveis.map((x) => x.chave));

  if (v.parametros.some((p) => !conhecidas.has(p))) {
    erros.push("Escolha o que entra em cada campo do modelo");
  }

  if (v.botaoParam && v.botaoParam !== finalidade.botao?.chave) {
    erros.push("O botão só aceita o link desta finalidade");
  }

  return erros;
}

/** Troca os `{{n}}` pelos exemplos, para a previa da tela. */
export function previaDoCorpo(corpo: string, valores: string[]): string {
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (bruto, n: string) => {
    const v = valores[Number(n) - 1];
    return v ?? bruto;
  });
}
