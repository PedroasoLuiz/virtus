/**
 * Triagem de quem chama no WhatsApp.
 *
 * O atendimento e o que VIRA tarefa ou e recusado. Ele nao tem projeto e nao
 * exige cliente: quem escreve pode nao ser nenhum dos dois, e exigir cadastro
 * antes de saber o que a pessoa quer inverteria a ordem das coisas.
 */

/**
 * `ABANDONADO` e encerramento por falta de retorno do cliente, e nao decisao de
 * ninguem. Fica separado de `RECUSADO` porque sao coisas diferentes de medir:
 * um diz quanta gente desiste no meio da triagem, o outro diz quanto pedido a
 * equipe nao aceitou.
 *
 * ⚠️ Nao silencia o bot: se a pessoa voltar a escrever, ela e atendida de novo,
 * num atendimento novo.
 */
export type SituacaoAtendimento =
  | "TRIAGEM"
  | "ENCAMINHADO"
  | "ACEITO"
  | "RECUSADO"
  | "ABANDONADO";

/** O que o bot precisa saber antes de decidir se fala. */
export type ContextoDoBot = {
  empresaId: number;
  telefone: string;
  nome: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  /*
   * ⚠️ Tudo daqui para baixo vale para a JANELA de 24 horas, nao para a conversa
   * inteira. A conversa nunca acaba; o atendimento acaba. Escopo de conversa
   * fazia o bot emudecer de vez no primeiro atendimento encerrado.
   */
  atendimentoId: number | null;
  atendimentoSituacao: SituacaoAtendimento | null;
  /** Para onde ja foi encaminhado, para o bot nao encaminhar duas vezes. */
  atendimentoSetor: string | null;
  /** ⚠️ QUAL era o assunto. Sem isso o bot nao percebe quando ele muda. */
  atendimentoIntencao: string | null;
  /** Uma pessoa pegou o atendimento na fila. */
  atendimentoAceito: boolean;
  /** Quantas vezes o bot ja falou nesta janela. */
  tentativas: number;
  /** ⚠️ A trava do silencio: uma pessoa respondeu depois do inicio da janela. */
  humanoRespondeu: boolean;
};

export type SetorDoBot = {
  id: number;
  nome: string;
  quandoUsar: string | null;
};

export type MensagemDoBot = {
  direcao: "entrada" | "saida";
  tipo: string;
  texto: string | null;
  /** Saida com `fkUser` nulo e o bot; com usuario e uma pessoa. */
  doBot: boolean;
  enviadaEm: string;
};

export type Atendimento = {
  id: number;
  conversaId: number;
  clienteId: number | null;
  clienteNome: string | null;
  setorId: number | null;
  setorNome: string | null;
  responsavelId: string | null;
  intencao: string | null;
  resumo: string | null;
  confianca: number | null;
  situacao: SituacaoAtendimento;
  demandaId: number | null;
  motivoRecusa: string | null;
  criadoEm: string;
  encerradoEm: string | null;
  /** Do contato, para a fila mostrar de quem e sem abrir a conversa. */
  telefone: string;
  contato: string | null;
};

export type Setor = {
  id: number;
  nome: string;
  descricao: string | null;
  quandoUsar: string | null;
  ativo: boolean;
};
