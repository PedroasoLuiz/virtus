import { z } from "zod";
import { serverClient } from "@/infra/supabase/client";
import { deReais } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import type {
  CicloDeCartao,
  LadoDoRelatorio,
  ParcelaDoRelatorio,
} from "@/modules/relatorios/relatorios.types";

/**
 * As parcelas em aberto saem do banco pela funcao `relatorio_de_parcelas`.
 *
 * ⚠️ A conta do SALDO EM ABERTO mora no Postgres, e nao aqui. Ela depende de
 * somar as baixas de cada parcela: em TypeScript seriam duas listas inteiras
 * trazidas pela rede para cruzar em memoria, e uma consulta a mais por parcela
 * se fosse pedida sob demanda.
 *
 * ⚠️ UMA funcao para os dois lados, com o lado como parametro. A pergunta e a
 * mesma em tabelas diferentes; duas funcoes gemeas divergiriam no primeiro
 * ajuste, que foi como o legado acabou com tres relatorios que nao batiam.
 */

const linhaSchema = z.object({
  vencimento: z.string(),
  documento_id: z.number(),
  documento_numero: z.number(),
  parcela_id: z.number(),
  parcela_numero: z.number(),
  parcelas_total: z.number(),
  pessoa: z.string(),
  descricao: z.string().nullable(),
  valor: z.coerce.number(),
  ja_pago: z.coerce.number(),
  em_aberto: z.coerce.number(),
  dias_atraso: z.number(),
});

export async function parcelasEmAberto(
  empresaId: number,
  lado: LadoDoRelatorio,
  de: DataISO,
  ate: DataISO,
): Promise<ParcelaDoRelatorio[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("relatorio_de_parcelas", {
    pde: de,
    pate: ate,
    pfkempresa: empresaId,
    plado: lado === "receber" ? "RECEBER" : "PAGAR",
  });

  if (error) throw error;

  return z
    .array(linhaSchema)
    .parse(data ?? [])
    .map((l) => ({
      vencimento: l.vencimento.slice(0, 10) as DataISO,
      documentoId: l.documento_id,
      documentoNumero: l.documento_numero,
      parcelaId: l.parcela_id,
      numero: l.parcela_numero,
      deQuantas: l.parcelas_total,
      pessoa: l.pessoa,
      descricao: l.descricao,
      valor: deReais(l.valor),
      jaPago: deReais(l.ja_pago),
      emAberto: deReais(l.em_aberto),
      diasDeAtraso: l.dias_atraso,
    }));
}

/**
 * ⚠️ A resposta e conferida por Zod, como a das parcelas: `jsonb` e `TABLE` de
 * RPC chegam como `unknown`, e uma mudanca na funcao apareceria na tela como
 * `undefined` no meio de uma coluna de dinheiro em vez de erro.
 */
const cicloSchema = z.object({
  fatura_id: z.number(),
  cartao_id: z.number(),
  cartao: z.string(),
  competencia: z.string(),
  vencimento: z.string(),
  compras: z.number(),
  total: z.coerce.number(),
  dias_atraso: z.number(),
});

/**
 * Os ciclos de cartao ainda ABERTOS que vencem no periodo.
 *
 * ⚠️ So os sem conta a pagar. A fatura fechada ja virou titulo e ja esta nas
 * parcelas a pagar; trazer as duas contaria o cartao duas vezes — e e o defeito
 * que a projecao de caixa do legado tinha.
 */
export async function ciclosDeCartao(
  empresaId: number,
  de: DataISO,
  ate: DataISO,
): Promise<CicloDeCartao[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("relatorio_de_ciclos_de_cartao", {
    pde: de,
    pate: ate,
    pfkempresa: empresaId,
  });

  if (error) throw error;

  return z
    .array(cicloSchema)
    .parse(data ?? [])
    .map((c) => ({
      faturaId: c.fatura_id,
      cartaoId: c.cartao_id,
      cartao: c.cartao,
      competencia: c.competencia.slice(0, 10) as DataISO,
      vencimento: c.vencimento.slice(0, 10) as DataISO,
      compras: c.compras,
      total: deReais(c.total),
      diasDeAtraso: c.dias_atraso,
    }));
}
