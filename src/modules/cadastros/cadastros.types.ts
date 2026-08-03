import type { Centavos } from "@/shared/utils/money";

/** Cadastros simples da empresa. */

export type Servico = {
  id: number;
  descricao: string;
  valor: Centavos;
  cnae: string | null;
  centroCustoId: number | null;
  ativo: boolean;
};

export type ServicoNovo = {
  descricao: string;
  valor: Centavos;
  cnae?: string | null;
  centroCustoId?: number | null;
  ativo?: boolean;
};

export type CentroCusto = {
  id: number;
  descricao: string;
  tipo: TipoCentroCusto;
  ativo: boolean;
};

/**
 * O banco guarda `tipo` como texto livre. Os valores em uso sao estes dois; o
 * dominio normaliza para nao depender de maiuscula/acento do registro antigo.
 */
export const TIPOS_CENTRO_CUSTO = ["RECEITA", "DESPESA"] as const;
export type TipoCentroCusto = (typeof TIPOS_CENTRO_CUSTO)[number];

export type CentroCustoNovo = {
  descricao: string;
  tipo: TipoCentroCusto;
  ativo?: boolean;
};

export function normalizarTipo(bruto: string | null): TipoCentroCusto {
  const t = (bruto ?? "").trim().toUpperCase();
  return t.startsWith("REC") ? "RECEITA" : "DESPESA";
}
