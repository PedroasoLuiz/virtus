import { z } from "zod";
import {
  centavosPositivoSchema,
  dataISOSchema,
  idSchema,
  textoLongoSchema,
} from "@/shared/validators/comuns";
import { paginacaoSchema } from "@/shared/utils/paginacao";

/**
 * Contratos de entrada e saida do modulo faturas.
 *
 * Validado aqui, na borda. Service e repository confiam no que recebem — nada
 * de revalidar "por garantia" camada adentro.
 */

import { STATUS_FATURA, TIPOS_DE_RECEBIMENTO } from "@/modules/faturas/faturas.types";

/** Espelha os valores realmente gravados no banco. */
export const statusFaturaSchema = z.enum(STATUS_FATURA);

// ── Entrada ─────────────────────────────────────────────────────────────────

export const listarQuerySchema = paginacaoSchema.extend({
  status: statusFaturaSchema.optional(),
  clienteId: idSchema.optional(),
  incluirCanceladas: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  busca: z.string().trim().max(120).optional(),
});


const origemSchema = z.object({
  ticketId: idSchema,
  valor: centavosPositivoSchema,
});

export const criarFaturaBodySchema = z
  .object({
    clienteId: idSchema,
    apuracaoInicio: dataISOSchema,
    apuracaoFim: dataISOSchema,
    /**
     * De quais tickets vem o dinheiro, e quanto de cada um.
     *
     * E a composicao da conta: o total sai da soma daqui. A fatura nao tem mais
     * itens proprios — o servico vive no ticket, e copia-lo para ca criava um
     * segundo detalhamento que divergia no primeiro ajuste.
     */
    origens: z.array(origemSchema).min(1, "Escolha ao menos um ticket").max(200),
    parcelamento: z.object({
      quantidade: z.number().int().min(1).max(360),
      primeiroVencimento: dataISOSchema,
      intervaloDias: z.number().int().min(1).max(365).optional(),
    }),
    observacoes: textoLongoSchema.nullish(),
    rodape: textoLongoSchema.nullish(),
    /** false cria como rascunho; true ja emite. */
    emitir: z.boolean().default(false),
  })
  .refine((v) => v.apuracaoFim >= v.apuracaoInicio, {
    message: "Fim da competencia nao pode ser anterior ao inicio",
    path: ["apuracaoFim"],
  });

export const idParamSchema = z.object({ id: idSchema });

export const ticketParamSchema = z.object({ id: idSchema, ticketId: idSchema });

export const anexoParamSchema = z.object({ id: idSchema, anexoId: idSchema });

export const parcelaParamSchema = z.object({
  id: idSchema,
  parcelaId: idSchema,
});

/** Qual documento da parcela — os dois campos que o legado ja tinha. */
export const tipoDocumentoQuerySchema = z.object({
  tipo: z.enum(["nfs", "boleto", "comprovante"]),
});

/** Permite mandar para outro endereco sem mexer no cadastro do cliente. */
export const enviarParcelaBodySchema = z.object({
  para: z.string().trim().email("E-mail invalido").nullish(),
});

export const baixaBodySchema = z.object({
  data: dataISOSchema,
  tipo: z.enum(TIPOS_DE_RECEBIMENTO),
  contaBancariaId: idSchema,
  descricao: textoLongoSchema.nullish(),
  observacoes: textoLongoSchema.nullish(),
  destinos: z
    .array(z.object({ parcelaId: idSchema, valor: centavosPositivoSchema, quitar: z.boolean().default(false) }))
    .min(1, "Escolha ao menos uma parcela"),
});

export const alterarStatusBodySchema = z.object({
  status: statusFaturaSchema,
});

// ── Saida ───────────────────────────────────────────────────────────────────

/**
 * O contrato de saida e explicito para que uma coluna nova no banco nao vaze
 * para a API sem alguem decidir que ela deve vazar.
 */
export const faturaResumoSchema = z.object({
  id: z.number(),
  numero: z.number(),
  clienteId: z.number().nullable(),
  clienteNome: z.string().nullable(),
  apuracaoInicio: z.string().nullable(),
  apuracaoFim: z.string().nullable(),
  proximoVencimento: z.string().nullable(),
  status: statusFaturaSchema,
  cancelada: z.boolean(),
  situacao: z.string(),
  total: z.number(),
  qtdParcelas: z.number(),
  qtdTickets: z.number(),
  pago: z.number(),
});

export const faturaSchema = faturaResumoSchema.extend({
  observacoes: z.string().nullable(),
  rodape: z.string().nullable(),
  parcelas: z.array(
    z.object({
      id: z.number(),
      numero: z.number(),
      vencimento: z.string().nullable(),
      valor: z.number(),
      acrescimo: z.number(),
      desconto: z.number(),
      total: z.number(),
      pago: z.boolean(),
      pagamentoId: z.number().nullable(),
      pagoEm: z.string().nullable(),
      recebido: z.number(),
      nfs: z.string().nullable(),
      boleto: z.string().nullable(),
      comprovante: z.string().nullable(),
    }),
  ),
  tickets: z.array(
    z.object({
      ticketId: z.number(),
      /*
       * O numero por tenant, que e o que aparece na tela — o `ticketId` e
       * chave interna e nunca e mostrado.
       *
       * Faltava aqui, e o Zod DESCARTA o que nao declara: o campo saia do
       * servico preenchido e chegava na tela como undefined. So apareceu quando
       * o icone ao lado saiu e a celula ficou visivelmente vazia.
       */
      numero: z.number(),
      valor: z.number(),
      titulo: z.string(),
      status: z.string(),
      clienteNome: z.string().nullable(),
      encerradoEm: z.string().nullable(),
    }),
  ),
  anexos: z.array(
    z.object({
      id: z.number(),
      nome: z.string(),
      caminho: z.string(),
      criadoEm: z.string(),
    }),
  ),
  clienteDoc: z.string().nullable(),
  emitente: z.object({
    razaoSocial: z.string().nullable(),
    endereco: z.string().nullable(),
    cnpj: z.string().nullable(),
    logo: z.string().nullable(),
  }),
  historico: z.object({
    criadoEm: z.string().nullable(),
    criadoPor: z.string().nullable(),
    editadoEm: z.string().nullable(),
    editadoPor: z.string().nullable(),
  }),
});

export type ListarQuery = z.infer<typeof listarQuerySchema>;
export type CriarFaturaBody = z.infer<typeof criarFaturaBodySchema>;
export type AlterarStatusBody = z.infer<typeof alterarStatusBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type ParcelaParam = z.infer<typeof parcelaParamSchema>;

export type TipoDocumentoQuery = z.infer<typeof tipoDocumentoQuerySchema>;
export type EnviarParcelaBody = z.infer<typeof enviarParcelaBodySchema>;

export type BaixaBody = z.infer<typeof baixaBodySchema>;
