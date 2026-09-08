import { z } from "zod";
import { dataISOSchema } from "@/shared/validators/comuns";

/**
 * O periodo e o lado.
 *
 * ⚠️ O lado vem na URL e nao em duas rotas gemeas: e a mesma pergunta em tabelas
 * diferentes, e duas rotas divergiriam no primeiro ajuste — foi assim que o
 * legado acabou com relatorios que nao somavam igual.
 */
export const relatorioQuerySchema = z.object({
  lado: z.enum(["receber", "pagar"]),
  de: dataISOSchema,
  ate: dataISOSchema,
  /**
   * Considerar as faturas de cartao ainda abertas.
   *
   * ⚠️ So vale do lado que PAGA, e o padrao e NAO considerar. Somar o cartao sem
   * pedir mudaria o total de um relatorio que a pessoa ja conhece; e quem quer o
   * compromisso completo pede, e a tela mostra o cartao em tabela propria para
   * ficar claro de onde veio.
   */
  cartao: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type RelatorioQuery = z.infer<typeof relatorioQuerySchema>;

const parcelaSchema = z.object({
  vencimento: z.string(),
  documentoId: z.number().int(),
  documentoNumero: z.number().int(),
  parcelaId: z.number().int(),
  numero: z.number().int(),
  deQuantas: z.number().int(),
  pessoa: z.string(),
  descricao: z.string().nullable(),
  valor: z.number().int(),
  jaPago: z.number().int(),
  emAberto: z.number().int(),
  diasDeAtraso: z.number().int(),
});

/**
 * ⚠️ O contrato de SAIDA tambem e declarado, como na DRE e no fluxo.
 *
 * `parse` recebe `unknown`, entao campo a mais ou a menos nao e erro de
 * compilacao: aparece em producao como "Dados inválidos", sem dizer qual. O
 * controller passa o objeto por `z.input` antes, e a divergencia vira erro do
 * `tsc`.
 */
export const relatorioSchema = z.object({
  lado: z.enum(["receber", "pagar"]),
  de: z.string(),
  ate: z.string(),
  meses: z.array(
    z.object({
      mes: z.string(),
      parcelas: z.array(parcelaSchema),
      total: z.number().int(),
    }),
  ),
  /* Nulo = nao foi pedido. Lista vazia = pedido, e nao ha ciclo aberto. */
  cartao: z
    .object({
      ciclos: z.array(
        z.object({
          faturaId: z.number().int(),
          cartaoId: z.number().int(),
          cartao: z.string(),
          competencia: z.string(),
          vencimento: z.string(),
          compras: z.number().int(),
          total: z.number().int(),
          diasDeAtraso: z.number().int(),
        }),
      ),
      total: z.number().int(),
    })
    .nullable(),
  total: z.number().int(),
  vencido: z.number().int(),
  quantidade: z.number().int(),
});
