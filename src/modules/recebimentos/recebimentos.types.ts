import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import { TIPOS_DE_RECEBIMENTO, type TipoDeRecebimento } from "@/modules/faturas/faturas.types";

/**
 * Recebimento: UM dinheiro que entrou, repartido entre as parcelas que ele paga.
 *
 * Existe separado de faturas porque a pergunta e outra. `faturas` responde
 * "quanto este cliente deve e por que"; aqui a pergunta e "o que caiu na conta
 * hoje, e de quem". Um PIX de 5.000 que quita parcelas de tres contas diferentes
 * e UM lancamento no extrato e tres destinos — modelar isso como tres baixas,
 * uma por conta, produzia tres linhas de 1.666 que o extrato do banco nunca
 * reconhece, e a conciliacao empacava exatamente onde deveria ser trivial.
 */

export { TIPOS_DE_RECEBIMENTO, type TipoDeRecebimento };

/**
 * Uma parcela esperando dinheiro, vista de fora da conta dela.
 *
 * Carrega o numero da conta porque na tela de recebimento o usuario esta olhando
 * o cliente, nao a conta: sem isso, "parcela 1" apareceria tres vezes na lista
 * sem nada que as distinga.
 */
export type ParcelaEmAberto = {
  parcelaId: number;
  faturaId: number;
  /** Numero da conta a receber. Interno: nunca vai para o cliente. */
  faturaNumero: number;
  numero: number;
  totalParcelas: number;
  vencimento: DataISO | null;
  total: Centavos;
  recebido: Centavos;
  emAberto: Centavos;
  /**
   * E a proxima da fila DA CONTA dela.
   *
   * A ordem vale por conta, e nao entre contas: sao acordos independentes, e
   * travar a conta 220 porque a 214 esta atrasada impediria de receber um
   * dinheiro que o cliente esta pagando de verdade.
   */
  liberada: boolean;
};

export type DestinoNovo = {
  parcelaId: number;
  valor: Centavos;
  juros: Centavos;
  multa: Centavos;
  /** Fecha a parcela mesmo recebendo menos: a diferenca vira desconto. */
  quitar: boolean;
};

export type RecebimentoNovo = {
  clienteId: number;
  /** Quando o CLIENTE pagou. E este dia que fecha a parcela. */
  data: DataISO;
  tipo: TipoDeRecebimento;
  contaBancariaId: number;
  /**
   * Quando o dinheiro CAI na conta.
   *
   * ⚠️ Outro dia, e nao um detalhe. O cartao credita em D+30: o cliente nao deve
   * mais desde o dia 20, mas o dinheiro so existe no extrato em setembro. Omitido,
   * o servico calcula pela forma de recebimento.
   */
  dataCredito?: DataISO | null;
  /**
   * O que a adquirente ou o banco reteve.
   *
   * ⚠️ NAO e desconto. Desconto e abatimento dado ao cliente; aqui ele pagou o
   * valor cheio e a diferenca ficou com quem processou. Ela vira lancamento de
   * despesa proprio, senao a receita encolhe e o custo some.
   */
  taxa?: Centavos;
  observacoes?: string | null;
  destinos: DestinoNovo[];
};

export type RecebimentoResumo = {
  id: number;
  data: DataISO | null;
  tipo: string | null;
  /** O que entrou no banco: parcelas + juros + multa. */
  valor: Centavos;
  /** Quanto do valor abateu divida. O resto e acrescimo. */
  abatido: Centavos;
  juros: Centavos;
  multa: Centavos;
  clienteNome: string | null;
  contaNome: string | null;
  conciliado: boolean;
  descricao: string | null;
  qtdParcelas: number;
  qtdContas: number;
};

export type DestinoDoRecebimento = {
  parcelaId: number;
  faturaId: number;
  faturaNumero: number;
  numero: number;
  vencimento: DataISO | null;
  valor: Centavos;
  juros: Centavos;
  multa: Centavos;
  /** Quanto esta baixa perdoou. E o que o estorno devolve ao saldo. */
  desconto: Centavos;
};

export type Recebimento = RecebimentoResumo & {
  observacoes: string | null;
  /** Quem lançou. Baixa é ato de alguém, e o extrato tem que dizer de quem. */
  registradoPor: string | null;
  registradoEm: string | null;
  destinos: DestinoDoRecebimento[];
};

export type FiltroRecebimentos = {
  clienteId?: number;
  de?: DataISO;
  ate?: DataISO;
};
