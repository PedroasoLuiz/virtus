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

import { STATUS_FATURA } from "@/modules/faturas/faturas.types";

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
    origens: z
      .array(origemSchema)
      .min(1, "Escolha ao menos um ticket")
      .max(200),
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

/**
 * A parcela nova sai de uma que ja existe: quem cadastra diz QUANTO tirar dela e
 * para QUANDO.
 *
 * ⚠️ O corpo e OPCIONAL. Sem ele, vale a operacao antiga — partir a ultima ao
 * meio —, e o que ja chamava este endpoint sem corpo continua funcionando.
 */
export const dividirParcelaBodySchema = z
  .object({
    origemId: idSchema,
    valor: centavosPositivoSchema,
    vencimento: dataISOSchema,
  })
  .optional();

/**
 * O parcelamento inteiro, como a tela desenhou.
 *
 * ⚠️ So as parcelas EM ABERTO. `id` nulo e parcela nova; parcela paga nao entra,
 * porque nao se mexe — e o que nao pode mudar tambem nao viaja.
 */
export const redefinirParcelasBodySchema = z.object({
  parcelas: z
    .array(
      z.object({
        id: idSchema.nullable(),
        vencimento: dataISOSchema,
        valor: centavosPositivoSchema,
      }),
    )
    .min(1, "A conta precisa de ao menos uma parcela")
    .max(360),
});

/**
 * As observacoes da conta, sozinhas.
 *
 * ⚠️ Corpo PROPRIO, e nao um update geral da conta. Observacao e texto que se
 * corrige a qualquer momento; competencia, tickets e parcelamento nao — eles ja
 * geraram parcela, baixa e documento. Um endpoint que aceitasse tudo deixaria
 * um erro de digitacao no texto a um campo de distancia de reescrever o acordo.
 */
export const observacoesBodySchema = z.object({
  observacoes: textoLongoSchema.nullish(),
});

export type ObservacoesBody = z.infer<typeof observacoesBodySchema>;

export const idParamSchema = z.object({ id: idSchema });

export const ticketParamSchema = z.object({ id: idSchema, ticketId: idSchema });

export const anexoParamSchema = z.object({ id: idSchema, anexoId: idSchema });

/**
 * O cancelamento de uma parcela a receber.
 *
 * ⚠️ O motivo e OPCIONAL, pelo mesmo motivo do lado que paga: exigir texto faria
 * alguem digitar um ponto para passar da tela.
 */
export const cancelarParcelaBodySchema = z.object({
  motivo: z.string().trim().max(300).nullish(),
});

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

export const alterarVencimentoBodySchema = z.object({
  vencimento: dataISOSchema,
});

export const enviarParcelaWhatsappBodySchema = z.object({
  /** Telefone alternativo. Vazio usa o do cadastro. */
  telefone: z.string().trim().min(8).max(20).nullish(),
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
  ultimoRecebimento: z.string().nullable(),
  status: statusFaturaSchema,
  cancelada: z.boolean(),
  situacao: z.string(),
  total: z.number(),
  qtdParcelas: z.number(),
  qtdTickets: z.number(),
  pago: z.number(),
  saldo: z.number(),
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
      /* Combinada e nao vai mais ser cobrada: contrato encerrado antes dela. */
      cancelada: z.boolean(),
      motivoDoCancelamento: z.string().nullable(),
      pagamentoId: z.number().nullable(),
      pagoEm: z.string().nullable(),
      conciliado: z.boolean(),
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
      /* A obra do ticket. Um por ticket, garantido por UNIQUE no banco — e por
         isso a CONTA nao tem projeto proprio: ela junta varios tickets. */
      projetoId: z.number().nullable(),
      projetoNome: z.string().nullable(),
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
  /* ⚠️ Declarados aqui porque o schema de saida ESTRIPA o que nao conhece: sem
     estas linhas os campos chegariam `undefined` na tela, e o documento sairia
     sem endereco sem ninguem ver erro nenhum. */
  cobranca: z.object({
    multaPercentual: z.number(),
    jurosPercentual: z.number(),
    jurosPeriodo: z.enum(["MES", "DIA"]),
    carenciaDias: z.number(),
  }),
  clienteEndereco: z
    .object({
      logradouro: z.string().nullable(),
      numero: z.string().nullable(),
      complemento: z.string().nullable(),
      bairro: z.string().nullable(),
      cidade: z.string().nullable(),
      uf: z.string().nullable(),
      cep: z.string().nullable(),
    })
    .nullable(),
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
export type DividirParcelaBody = z.infer<typeof dividirParcelaBodySchema>;
export type RedefinirParcelasBody = z.infer<typeof redefinirParcelasBodySchema>;
export type ParcelaParam = z.infer<typeof parcelaParamSchema>;

export type TipoDocumentoQuery = z.infer<typeof tipoDocumentoQuerySchema>;
export type EnviarParcelaBody = z.infer<typeof enviarParcelaBodySchema>;
export type EnviarParcelaWhatsappBody = z.infer<
  typeof enviarParcelaWhatsappBodySchema
>;
export type AlterarVencimentoBody = z.infer<typeof alterarVencimentoBodySchema>;

export type CancelarParcelaBody = z.infer<typeof cancelarParcelaBodySchema>;
