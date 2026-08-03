import { hoje, type DataISO } from "@/shared/utils/datas";
import type { Centavos } from "@/shared/utils/money";

/** Contratos de dominio de contas a pagar. */

export type ContaPagarResumo = {
  id: number;
  descricao: string;
  fornecedorId: number | null;
  fornecedorNome: string | null;
  emissao: DataISO | null;
  proximoVencimento: DataISO | null;
  total: Centavos;
  pago: boolean;
  cancelada: boolean;
  qtdParcelas: number;
  parcelasPagas: number;
};

/**
 * Situacao derivada, nao coluna.
 *
 * A tabela guarda `pago` e `cancelada` como booleanos separados; o que o
 * usuario quer ver e um estado unico.
 */
export type SituacaoConta = "ABERTA" | "PARCIAL" | "PAGA" | "CANCELADA" | "VENCIDA";

export type FiltroContas = {
  situacao?: SituacaoConta;
  fornecedorId?: number;
  incluirCanceladas?: boolean;
};

/**
 * Situacao a partir das flags e das parcelas.
 *
 * Funcao pura, e por isso mora aqui e nao no service: a tabela (client
 * component) precisa dela, e importar o service arrastaria o repositorio — e
 * com ele o client do Supabase — para o bundle do navegador.
 *
 * A ordem importa: cancelada vence tudo, e "vencida" so vale para conta que
 * ainda tem saldo em aberto.
 */
export function situacaoDaConta(conta: ContaPagarResumo): SituacaoConta {
  if (conta.cancelada) return "CANCELADA";
  if (conta.pago || (conta.qtdParcelas > 0 && conta.parcelasPagas === conta.qtdParcelas)) {
    return "PAGA";
  }
  if (conta.proximoVencimento && conta.proximoVencimento < hoje()) return "VENCIDA";
  if (conta.parcelasPagas > 0) return "PARCIAL";
  return "ABERTA";
}
