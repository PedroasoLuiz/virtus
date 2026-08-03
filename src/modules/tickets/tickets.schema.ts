import { z } from "zod";
import {
  centavosSchema,
  dataISOSchema,
  idSchema,
  textoCurtoSchema,
  textoLongoSchema,
} from "@/shared/validators/comuns";
import { CHAVES_STATUS, UNIDADES_ITEM } from "@/modules/tickets/tickets.types";

/** Contratos de entrada e saida do quadro de tickets. */

export const idParamSchema = z.object({ id: idSchema });

// ── Ticket ──────────────────────────────────────────────────────────────────

/**
 * Servico do ticket.
 *
 * O `total` NAO entra: e calculado no servico a partir de quantidade, valor,
 * desconto e acrescimo. Aceitar o total do cliente deixaria a soma do ticket
 * divergir dos proprios itens no primeiro request malformado.
 */
export const despesaItemBodySchema = z.object({
  descricao: textoCurtoSchema.max(120),
  valor: centavosSchema,
});

export const itemTicketBodySchema = z.object({
  servicoId: idSchema.nullish(),
  descricao: z.string().trim().max(255).default(""),
  /** Execucao de mais de um dia registra o primeiro — criterio de quem lanca. */
  data: dataISOSchema.nullish(),
  quantidade: z.number().positive("Quantidade deve ser maior que zero"),
  unidade: z.enum(UNIDADES_ITEM).default("UN"),
  valorUnitario: centavosSchema,
  desconto: centavosSchema.default(0),
  acrescimo: centavosSchema.default(0),
  despesas: z.array(despesaItemBodySchema).default([]),
});

export const criarTicketBodySchema = z.object({
  clienteId: idSchema,
  titulo: textoCurtoSchema.max(120).nullish(),
  descricao: textoLongoSchema.nullish(),
  // Sem `local`: vem do endereco do cliente.
  // Sem `inicio`/`fim`: vem das datas dos servicos.
  statusId: idSchema.nullish(),
  itens: z.array(itemTicketBodySchema).default([]),
});

/** Edicao: tudo opcional — a tela envia so o que mudou. */
export const atualizarTicketBodySchema = criarTicketBodySchema
  .partial()
  .extend({ cancelada: z.boolean().optional() });

/**
 * Cor e um TOM do design system, nao um hexadecimal.
 *
 * Deixar o usuario escolher `#ff00aa` produziria quadro ilegivel no tema escuro
 * e fora da paleta. A lista e a mesma de `Badge`.
 */
export const TONS_COLUNA = ["neutral", "info", "warning", "success", "danger"] as const;

export const criarStatusBodySchema = z.object({
  descricao: textoCurtoSchema.max(40, "Nome de coluna deve ter ate 40 caracteres"),
  cor: z.enum(TONS_COLUNA).optional(),
});

/** O indice nao entra: a posicao no meio do quadro e calculada pelo servico. */
export const atualizarStatusBodySchema = z.object({
  descricao: textoCurtoSchema.max(40).optional(),
  cor: z.enum(TONS_COLUNA).optional(),
  ativo: z.boolean().optional(),
});

export const moverTicketBodySchema = z.object({ statusId: idSchema });

export const statusSchema = z.object({
  id: z.number(),
  descricao: z.string(),
  chave: z.enum(CHAVES_STATUS).nullable(),
  sistema: z.boolean(),
  indice: z.number(),
  cor: z.string(),
  ativo: z.boolean(),
});

export type ItemTicketBody = z.infer<typeof itemTicketBodySchema>;
export type CriarTicketBody = z.infer<typeof criarTicketBodySchema>;
export type AtualizarTicketBody = z.infer<typeof atualizarTicketBodySchema>;
export type CriarStatusBody = z.infer<typeof criarStatusBodySchema>;
export type AtualizarStatusBody = z.infer<typeof atualizarStatusBodySchema>;
export type MoverTicketBody = z.infer<typeof moverTicketBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;

/** Query da rota de tickets faturaveis. */
export const faturaveisQuerySchema = z.object({
  clienteId: idSchema.optional(),
});

export type FaturaveisQuery = z.infer<typeof faturaveisQuerySchema>;
