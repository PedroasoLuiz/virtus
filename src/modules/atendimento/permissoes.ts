/**
 * O que uma persona pode FAZER no sistema.
 *
 * ⚠️ Lista nossa e fechada, como as finalidades. Ela nao descreve o setor do
 * cliente: descreve o que o sistema sabe responder. Setor e cadastro dele, com o
 * nome que ele quiser, e amarrar permissao a nome de setor faria "Financeiro" e
 * "financeiro " serem coisas diferentes. A `area` aqui e so agrupamento de
 * tela — quem escolhe o que cada persona pode e quem cadastra.
 *
 * ⚠️ Marcar aqui NAO dispensa a identificacao. Toda consulta que toca dado de
 * cliente continua exigindo CPF ou CNPJ e o codigo enviado ao e-mail do
 * cadastro — a permissao diz o que a persona pode oferecer, e nao a quem. Sem
 * isso, bastaria uma persona mal configurada para o saldo de um cliente sair
 * para quem escrevesse do telefone dele.
 */

export type AreaDePermissao = "financeiro" | "tickets" | "institucional" | "envio";

export type Permissao = {
  id: string;
  area: AreaDePermissao;
  rotulo: string;
  descricao: string;
  /**
   * Le dado de CLIENTE, e por isso passa pela identificacao verificada.
   *
   * ⚠️ E o que separa a persona geral das outras: a geral atende quem ainda nao
   * disse quem e, entao ela nao pode ter nenhuma destas.
   */
  exigeIdentificacao: boolean;
  /** Ainda nao existe do lado do bot. A tela mostra e avisa. */
  emBreve?: boolean;
};

export const AREAS: { id: AreaDePermissao; rotulo: string; legenda: string }[] = [
  {
    id: "financeiro",
    rotulo: "Financeiro",
    legenda:
      "Tudo aqui exige que o cliente se identifique com CPF ou CNPJ e o código enviado ao e-mail do cadastro. A permissão libera o assunto, nunca a verificação.",
  },
  {
    id: "tickets",
    rotulo: "Tickets",
    legenda: "Situação e andamento dos chamados do próprio cliente.",
  },
  {
    id: "institucional",
    rotulo: "Sobre a empresa",
    legenda: "O que não é dado de ninguém: horário, endereço, o que a empresa faz.",
  },
  {
    id: "envio",
    rotulo: "Envio de mensagens",
    legenda:
      "Deixa a persona disparar um modelo aprovado em vez de só escrever texto. Vale só para os modelos vinculados em Modelos, aba Sistema.",
  },
];

export const PERMISSOES: Permissao[] = [
  {
    id: "titulos",
    area: "financeiro",
    rotulo: "Consultar parcelas em aberto",
    descricao: "Quais parcelas estão abertas, com número da conta e vencimento.",
    exigeIdentificacao: true,
  },
  {
    id: "saldo",
    area: "financeiro",
    rotulo: "Consultar o total em aberto",
    descricao: "A soma do que está em aberto, sem detalhar parcela a parcela.",
    exigeIdentificacao: true,
  },
  {
    id: "fatura",
    area: "financeiro",
    rotulo: "Reenviar o link da cobrança",
    descricao: "Manda de novo o link da página da parcela, o mesmo que vai no e-mail.",
    exigeIdentificacao: true,
    emBreve: true,
  },
  {
    id: "ticket_situacao",
    area: "tickets",
    rotulo: "Informar a situação de um chamado",
    descricao: "Em que etapa está a ordem de serviço, pelo número que o cliente citar.",
    exigeIdentificacao: true,
    emBreve: true,
  },
  {
    id: "ticket_lista",
    area: "tickets",
    rotulo: "Listar os chamados abertos",
    descricao: "Quais ordens de serviço do cliente ainda estão em andamento.",
    exigeIdentificacao: true,
    emBreve: true,
  },
  {
    id: "servicos",
    area: "institucional",
    rotulo: "Falar do catálogo de serviços",
    descricao: "O que a empresa faz e como funciona a contratação. Não é dado de cliente.",
    exigeIdentificacao: false,
  },
  {
    id: "horarios",
    area: "institucional",
    rotulo: "Informar horário e endereço",
    descricao: "Onde a empresa fica e quando atende. Não é dado de cliente.",
    exigeIdentificacao: false,
  },
  {
    /*
     * ⚠️ Disparar modelo e permissao SEPARADA das consultas.
     *
     * Modelo aprovado sai da janela de 24 horas e e cobrado pela Meta por
     * conversa. Uma persona que consulta e outra que ENVIA sao riscos
     * diferentes, e juntar as duas numa marca so faria quem quer a primeira
     * pagar pela segunda sem perceber.
     */
    id: "modelos",
    area: "envio",
    rotulo: "Usar modelos de mensagem",
    descricao:
      "Deixa a persona disparar um modelo vinculado, como o link da cobrança. Cada disparo é cobrado pela Meta.",
    exigeIdentificacao: true,
    emBreve: true,
  },
];

export function permissaoPorId(id: string): Permissao | null {
  return PERMISSOES.find((p) => p.id === id) ?? null;
}

/**
 * As permissoes que uma persona GERAL pode ter.
 *
 * ⚠️ So as que nao tocam dado de cliente. A geral e quem atende quem chegou
 * agora, antes de qualquer identificacao: dar a ela uma consulta de saldo seria
 * oferecer o dado a quem ainda nao provou ser o dono dele.
 */
export function permissoesDaGeral(): Permissao[] {
  return PERMISSOES.filter((p) => !p.exigeIdentificacao);
}

/** O que impede este conjunto de permissoes, dada a natureza da persona. */
export function problemasDasPermissoes(setorId: number | null, ids: string[]): string[] {
  const desconhecida = ids.find((id) => !permissaoPorId(id));
  if (desconhecida) return [`Permissão desconhecida: ${desconhecida}`];

  if (setorId != null) return [];

  const proibida = ids.map(permissaoPorId).find((p) => p?.exigeIdentificacao);

  return proibida
    ? [`A persona geral não pode "${proibida.rotulo}": ela atende antes de saber quem é o cliente`]
    : [];
}
