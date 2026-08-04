import type { Centavos } from "@/shared/utils/money";

/**
 * Multa e juros por atraso.
 *
 * Funcao pura: nao toca banco, nao conhece HTTP, nao le relogio — a data de hoje
 * entra por parametro. E o unico lugar do sistema que decide quanto se cobra a
 * mais por um pagamento em atraso, e por isso o alvo natural dos testes.
 *
 * O resultado e uma SUGESTAO. A tela preenche e mostra; quem esta recebendo pode
 * sobrescrever, porque acordo com cliente nem sempre segue a tabela e um numero
 * aplicado sozinho vira cobranca indevida.
 */

export type ParametrosDeCobranca = {
  /** Percentual unico sobre o valor em atraso, cobrado uma vez. */
  multaPercentual: number;
  /** Percentual que corre. O periodo diz se por mes ou por dia. */
  jurosPercentual: number;
  jurosPeriodo: "MES" | "DIA";
  /** Dias de atraso tolerados antes de qualquer cobranca. */
  carenciaDias: number;
};

export const SEM_COBRANCA: ParametrosDeCobranca = {
  multaPercentual: 0,
  jurosPercentual: 0,
  jurosPeriodo: "MES",
  carenciaDias: 0,
};

const DIA_EM_MS = 24 * 60 * 60 * 1000;

/**
 * Dias corridos entre o vencimento e a data de referencia. Negativo quando ainda
 * nao venceu.
 *
 * Corridos e nao uteis: juros de mora corre todo dia, inclusive domingo. Dia util
 * importa para AGENDAR vencimento, que e outra conta e vive em `parcelas.ts`.
 */
export function diasDeAtraso(vencimento: string, referencia: string): number {
  return Math.floor(
    (Date.parse(referencia.slice(0, 10)) - Date.parse(vencimento.slice(0, 10))) / DIA_EM_MS,
  );
}

export type AcrescimoSugerido = {
  dias: number;
  multa: Centavos;
  juros: Centavos;
};

/**
 * Quanto cobrar a mais por esta parcela, nesta data.
 *
 * A multa incide UMA vez e o juros corre por dia. Os dois sobre o valor em
 * aberto, nunca sobre o total da parcela: quem ja pagou metade nao deve juros
 * sobre a metade que quitou.
 *
 * Dentro da carencia nao ha nada a cobrar, e isso inclui a multa — carencia que
 * so perdoasse o juros faria o primeiro dia de atraso custar quase tanto quanto
 * o trigesimo.
 */
export function acrescimoPorAtraso(
  emAberto: Centavos,
  vencimento: string | null,
  referencia: string,
  parametros: ParametrosDeCobranca,
): AcrescimoSugerido {
  const dias = vencimento ? diasDeAtraso(vencimento, referencia) : 0;

  if (dias <= 0 || dias <= parametros.carenciaDias || emAberto <= 0) {
    return { dias: Math.max(dias, 0), multa: 0 as Centavos, juros: 0 as Centavos };
  }

  const multa = arredondar((emAberto * parametros.multaPercentual) / 100);

  // O juros ao mes vira taxa diaria por trinta, que e a convencao comercial e o
  // que o cliente confere na calculadora. Mes de calendario daria valores
  // diferentes para o mesmo atraso conforme o mes, e ninguem conseguiria repetir
  // a conta.
  const taxaDiaria =
    parametros.jurosPeriodo === "DIA"
      ? parametros.jurosPercentual
      : parametros.jurosPercentual / 30;

  const juros = arredondar((emAberto * taxaDiaria * dias) / 100);

  return { dias, multa, juros };
}

/** Centavo inteiro. Dinheiro nao tem fracao de centavo em nenhum lugar do sistema. */
function arredondar(valor: number): Centavos {
  return Math.round(valor) as Centavos;
}
