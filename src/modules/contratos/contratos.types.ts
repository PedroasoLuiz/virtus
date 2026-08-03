import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * Contrato — o compromisso recorrente que gera cobranca periodica.
 *
 * Cada periodo gerado vira uma COMPETENCIA, e cada competencia vira um ticket.
 * Contrato nao aponta para uma fatura: `contratos.fkFatura` foi removida porque
 * cabia uma so, que e exatamente o que recorrencia nao e. Ver docs/11.
 */

export const PERIODICIDADES = ["MENSAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

export const MESES_DA_PERIODICIDADE: Record<Periodicidade, number> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

export type Competencia = {
  id: number;
  /** Primeiro dia do periodo. Guardar o mes inteiro deixaria "marco" e "01/03"
   *  como coisas diferentes na hora de conferir duplicidade. */
  competencia: DataISO;
  ticketId: number | null;
  valor: Centavos;
  geradaEm: string;
};

export type ContratoResumo = {
  id: number;
  numero: string | null;
  descricao: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  valor: Centavos;
  periodicidade: Periodicidade;
  diaVencimento: number | null;
  inicio: DataISO | null;
  fim: DataISO | null;
  proximaCompetencia: DataISO | null;
  ativo: boolean;
  qtdCompetencias: number;
};

export type Contrato = ContratoResumo & {
  competencias: Competencia[];
};

export type ContratoNovo = {
  numero?: string | null;
  descricao?: string | null;
  clienteId?: number | null;
  valor: Centavos;
  periodicidade: Periodicidade;
  diaVencimento?: number | null;
  inicio?: DataISO | null;
  fim?: DataISO | null;
};

/**
 * Da para gerar a proxima competencia agora?
 *
 * Nao basta o contrato estar ativo: a competencia nao pode passar do mes
 * corrente. Sem isso, dois cliques seguidos geravam o mes que vem e tres o
 * subsequente — cobranca adiantada que so aparece quando o cliente reclama.
 *
 * Pura e neste arquivo porque a tela usa para desabilitar o botao, e o banco
 * repete a regra em `gerar_competencia_do_contrato`. A tela evita a viagem; o
 * banco e quem garante.
 */
export function podeGerarCompetencia(
  c: { ativo: boolean; proximaCompetencia: DataISO | null; inicio: DataISO | null; fim: DataISO | null },
  hoje: DataISO,
): { pode: boolean; motivo?: string } {
  if (!c.ativo) return { pode: false, motivo: "Contrato inativo" };

  const alvo = (c.proximaCompetencia ?? c.inicio ?? hoje).slice(0, 7);
  const mesAtual = hoje.slice(0, 7);

  if (alvo > mesAtual) {
    const [ano, mes] = alvo.split("-");
    return { pode: false, motivo: `Próxima competência é ${mes}/${ano}` };
  }

  if (c.fim && `${alvo}-01` > c.fim) return { pode: false, motivo: "Contrato encerrado" };

  return { pode: true };
}
