import { z } from "zod";
import { centavosSchema, dataISOSchema, idSchema } from "@/shared/validators/comuns";

/**
 * Contratos de entrada e saida do modulo contas.
 */

const texto = z.string().trim().max(120).nullish();

/** Taxa em porcentagem, com duas casas. Ver `contaBodySchema`. */
const percentual = z.number().min(0).max(100).nullish();

export const idParamSchema = z.object({ id: idSchema });

export const contaBodySchema = z.object({
  apelido: texto,
  banco: texto,
  agencia: texto,
  conta: texto,
  tipo: texto,
  /** Conta que nao se usa mais e desativada, nunca excluida. */
  ativo: z.boolean().default(true),
  limite: centavosSchema.default(0),
  /**
   * Saldo de partida. Muda o saldo de hoje inteiro, porque a view soma ele com
   * tudo que passou — por isso e campo de cadastro, e nao um lancamento.
   */
  saldoInicial: centavosSchema.default(0),

  /**
   * O contrato de recebimento desta conta.
   *
   * ⚠️ Percentual com teto de 100: taxa de adquirente vive entre 0,5% e 6%, e um
   * digito a mais — 35 no lugar de 3,5 — passaria e viraria despesa de um terco
   * da venda em todo lancamento seguinte.
   */
  aceitaCartao: z.boolean().default(false),
  taxaDebito: percentual,
  taxaCredito: percentual,
  taxaParcelado: percentual,
  /** Ate um ano: prazo maior que isso e erro de digitacao, nao contrato. */
  prazoCreditoDias: z.number().int().min(0).max(365).nullish(),
  tarifaBoleto: centavosSchema.nullish(),
});

export const extratoQuerySchema = z.object({
  de: dataISOSchema,
  ate: dataISOSchema,
});

// ── Saida ───────────────────────────────────────────────────────────────────

export const contaSchema = z.object({
  id: z.number(),
  apelido: z.string().nullable(),
  banco: z.string().nullable(),
  agencia: z.string().nullable(),
  conta: z.string().nullable(),
  tipo: z.string().nullable(),
  ativo: z.boolean(),
  limite: z.number(),
  saldoInicial: z.number(),
  saldo: z.number(),
  nome: z.string(),
});

export const extratoSchema = z.object({
  contaId: z.number(),
  contaNome: z.string(),
  de: z.string(),
  ate: z.string(),
  saldoInicial: z.number(),
  saldoFinal: z.number(),
  entradas: z.number(),
  saidas: z.number(),
  saldoAtual: z.number(),
  /* Quantos lancamentos da conta inteira ainda esperam conferencia. */
  semConciliar: z.number(),
  movimentos: z.array(
    z.object({
      id: z.number(),
      data: z.string().nullable(),
      nome: z.string().nullable(),
      tipo: z.enum(["ENTRADA", "SAIDA"]),
      valor: z.number(),
      origem: z.string().nullable(),
      descricao: z.string().nullable(),
      formaPagamento: z.string().nullable(),
      conciliado: z.boolean(),
      /* A que titulo a linha pertence, e o que a tela precisa para abri-lo. */
      documento: z
        .object({
          rotulo: z.string(),
          tipo: z.enum(["CR", "CP", "MOV"]),
          contaId: z.number().nullable(),
          parcela: z.number().nullable(),
        })
        .nullable(),
      saldoApos: z.number(),
    }),
  ),
});

export const conciliacaoParamSchema = z.object({
  id: idSchema,
  pagamentoId: idSchema,
});

export const conciliacaoBodySchema = z.object({ conciliado: z.boolean() });

export type ConciliacaoParam = z.infer<typeof conciliacaoParamSchema>;
export type ConciliacaoBody = z.infer<typeof conciliacaoBodySchema>;

export type ContaBody = z.infer<typeof contaBodySchema>;
export type ExtratoQuery = z.infer<typeof extratoQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
