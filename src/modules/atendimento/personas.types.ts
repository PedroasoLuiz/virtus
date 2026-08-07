/**
 * Persona: o que a IA pode resolver sozinha num setor, e com que voz.
 *
 * ⚠️ Nao amplia o que a IA sabe do banco. Valor, vencimento e dado de cliente
 * continuam saindo so das consultas verificadas. Persona muda o tom e a lista
 * de assuntos que a IA pode fechar sem chamar ninguem.
 */
export type Persona = {
  id: number;
  /** Nulo vale para todos os numeros da empresa. */
  contaId: number | null;
  /** Nulo e a persona geral, usada quando o setor nao tem uma propria. */
  setorId: number | null;
  nome: string;
  descricao: string | null;
  podeResolver: string | null;
  /**
   * O que ela pode CONSULTAR no sistema. Ver `permissoes.ts`.
   *
   * ⚠️ Marcar aqui nao dispensa a identificacao: consulta que toca dado de
   * cliente continua exigindo CPF ou CNPJ e o codigo do e-mail. A permissao diz
   * o que a persona pode oferecer, e nao a quem.
   */
  permissoes: string[];
  ativo: boolean;
};
