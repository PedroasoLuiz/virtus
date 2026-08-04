import { z } from "zod";
import {
  centavosSchema,
  centavosPositivoSchema,
  dataISOSchema,
  idSchema,
  textoLongoSchema,
} from "@/shared/validators/comuns";
import { paginacaoSchema } from "@/shared/utils/paginacao";
import { TIPOS_DE_RECEBIMENTO } from "@/modules/faturas/faturas.types";

/**
 * Contratos de entrada e saida do modulo recebimentos.
 *
 * Validado aqui, na borda. Service e repository confiam no que recebem.
 */

// ── Entrada ─────────────────────────────────────────────────────────────────

export const listarQuerySchema = paginacaoSchema.extend({
  clienteId: idSchema.optional(),
  de: dataISOSchema.optional(),
  ate: dataISOSchema.optional(),
});

export const parcelasAbertasQuerySchema = z.object({ clienteId: idSchema });

export const idParamSchema = z.object({ id: idSchema });

/**
 * Juros e multa sao `centavosSchema` e nao `centavosPositivoSchema`: zero e o
 * caso normal, e exigir positivo obrigaria a tela a omitir os campos em toda
 * baixa em dia.
 */
const destinoSchema = z.object({
  parcelaId: idSchema,
  valor: centavosPositivoSchema,
  juros: centavosSchema.default(0),
  multa: centavosSchema.default(0),
  quitar: z.boolean().default(false),
});

export const criarRecebimentoBodySchema = z.object({
  /**
   * O pagador. Obrigatorio mesmo dando para deduzir das parcelas: e ele que
   * define quais parcelas a tela oferece, e mandar explicito faz o servidor
   * recusar um `parcelaId` de outro cliente em vez de baixa-lo em silencio.
   */
  clienteId: idSchema,
  data: dataISOSchema,
  tipo: z.enum(TIPOS_DE_RECEBIMENTO),
  contaBancariaId: idSchema,
  observacoes: textoLongoSchema.nullish(),
  destinos: z.array(destinoSchema).min(1, "Escolha ao menos uma parcela").max(200),
});

// ── Saida ───────────────────────────────────────────────────────────────────

/**
 * O contrato de saida e explicito para que uma coluna nova no banco nao vaze
 * para a API sem alguem decidir que ela deve vazar.
 *
 * ⚠️ Zod de saida DESCARTA o que nao declara: ao acrescentar campo no tipo de
 * dominio, este schema e o lugar que costuma ficar para tras, e o sintoma e o
 * campo sumir da tela sem erro nenhum.
 */
export const parcelaEmAbertoSchema = z.object({
  parcelaId: z.number(),
  faturaId: z.number(),
  faturaNumero: z.number(),
  numero: z.number(),
  totalParcelas: z.number(),
  vencimento: z.string().nullable(),
  total: z.number(),
  recebido: z.number(),
  emAberto: z.number(),
  liberada: z.boolean(),
});

export const carteiraSchema = z.object({
  parcelas: z.array(parcelaEmAbertoSchema),
  cobranca: z.object({
    multaPercentual: z.number(),
    jurosPercentual: z.number(),
    jurosPeriodo: z.enum(["MES", "DIA"]),
    carenciaDias: z.number(),
  }),
});

export const recebimentoResumoSchema = z.object({
  id: z.number(),
  data: z.string().nullable(),
  tipo: z.string().nullable(),
  valor: z.number(),
  abatido: z.number(),
  juros: z.number(),
  multa: z.number(),
  clienteNome: z.string().nullable(),
  contaNome: z.string().nullable(),
  conciliado: z.boolean(),
  descricao: z.string().nullable(),
  qtdParcelas: z.number(),
  qtdContas: z.number(),
});

export const recebimentoSchema = recebimentoResumoSchema.extend({
  observacoes: z.string().nullable(),
  registradoPor: z.string().nullable(),
  registradoEm: z.string().nullable(),
  destinos: z.array(
    z.object({
      parcelaId: z.number(),
      faturaId: z.number(),
      faturaNumero: z.number(),
      numero: z.number(),
      vencimento: z.string().nullable(),
      valor: z.number(),
      juros: z.number(),
      multa: z.number(),
      desconto: z.number(),
    }),
  ),
});

export type ListarQuery = z.infer<typeof listarQuerySchema>;
export type ParcelasAbertasQuery = z.infer<typeof parcelasAbertasQuerySchema>;
export type CriarRecebimentoBody = z.infer<typeof criarRecebimentoBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
