import { z } from "zod";
import {
  centavosSchema,
  dataISOSchema,
  idSchema,
  textoCurtoSchema,
  textoLongoSchema,
} from "@/shared/validators/comuns";
import { MODALIDADES, SITUACOES } from "@/modules/projetos/projetos.types";

/** Contratos de entrada e saida de projetos. */

export const idParamSchema = z.object({ id: idSchema });

export const criarProjetoBodySchema = z.object({
  nome: textoCurtoSchema.max(120),
  descricao: textoLongoSchema.nullish(),
  clienteId: idSchema.nullish(),
  modalidade: z.enum(MODALIDADES).default("FECHADO"),
  situacao: z.enum(SITUACOES).optional(),
  inicio: dataISOSchema.nullish(),
  fim: dataISOSchema.nullish(),
});

export const atualizarProjetoBodySchema = criarProjetoBodySchema.partial().extend({
  ativo: z.boolean().optional(),
  cancelado: z.boolean().optional(),
});

export const criarDemandaBodySchema = z.object({
  titulo: textoCurtoSchema.max(160),
  descricao: textoLongoSchema.nullish(),
  colunaId: idSchema.nullish(),
  /** uuid de `usuarios.fkUser`, nao id numerico. */
  responsavelId: z.uuid().nullish(),
  inicio: dataISOSchema.nullish(),
  prazo: dataISOSchema.nullish(),
  valor: centavosSchema.optional(),
  concluida: z.boolean().optional(),
});

export const itemBodySchema = z.object({ descricao: textoCurtoSchema.max(200) });
export const alternarItemBodySchema = z.object({ feito: z.boolean() });
export const comentarioBodySchema = z.object({ texto: textoLongoSchema.min(1) });

/**
 * `z.url()` e nao texto livre: link quebrado so aparece quando alguem clica, e
 * ai o anexo ja foi dado como guardado.
 */
/** Rota que carrega o projeto E o ticket na URL. */
export const projetoTicketParamSchema = z.object({ id: idSchema, ticketId: idSchema });
export const projetoContratoParamSchema = z.object({ id: idSchema, contratoId: idSchema });

export const gerarTicketBodySchema = z.object({
  valor: centavosSchema,
  /** Nomeia o aditivo. Dois tickets "Portal de vendas" na lista nao se distinguem. */
  titulo: textoCurtoSchema.nullish(),
});

/** As tarefas do lote. Uma so tambem e lote — o caminho e o mesmo. */
export const cobrarDemandasBodySchema = z.object({
  demandas: z.array(idSchema).min(1, "Selecione ao menos uma tarefa"),
});

export const anexoBodySchema = z.object({
  url: z.url(),
  nome: z.string().trim().max(200).nullish(),
});

export const atualizarDemandaBodySchema = criarDemandaBodySchema.partial();

export type CriarProjetoBody = z.infer<typeof criarProjetoBodySchema>;
export type AtualizarProjetoBody = z.infer<typeof atualizarProjetoBodySchema>;
export type CriarDemandaBody = z.infer<typeof criarDemandaBodySchema>;
export type AtualizarDemandaBody = z.infer<typeof atualizarDemandaBodySchema>;
export type ItemBody = z.infer<typeof itemBodySchema>;
export type AlternarItemBody = z.infer<typeof alternarItemBodySchema>;
export type ComentarioBody = z.infer<typeof comentarioBodySchema>;
export type AnexoBody = z.infer<typeof anexoBodySchema>;
export type GerarTicketBody = z.infer<typeof gerarTicketBodySchema>;
export type CobrarDemandasBody = z.infer<typeof cobrarDemandasBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
