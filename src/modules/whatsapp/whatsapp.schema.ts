import { z } from "zod";
import { temPalavrao } from "@/shared/domain/linguagem";

/**
 * Contratos de entrada e saida do modulo.
 *
 * ⚠️ Schema de saida DESCARTA o que nao declara. Ao acrescentar campo no tipo de
 * dominio, este arquivo e o quarto lugar a atualizar — ja custou um `numero` de
 * ticket sumindo da tela.
 */

// ── Saida ───────────────────────────────────────────────────────

export const conversaSchema = z.object({
  id: z.number(),
  telefone: z.string(),
  nome: z.string().nullable(),
  clienteId: z.number().nullable(),
  clienteNome: z.string().nullable(),
  clienteIcone: z.string().nullable(),
  ultimaEm: z.string().nullable(),
  ultimoTexto: z.string().nullable(),
  // ⚠️ Faltar aqui APAGA o campo da resposta, mesmo o banco e o repositorio
  // tendo o valor. Foi o que deixou a lista sem o icone de anexo: `ultimoTipo`
  // chegava ao schema e era descartado em silencio.
  ultimoTipo: z.string().nullable(),
  ultimaDirecao: z.enum(["entrada", "saida"]).nullable(),
  naoLidas: z.number(),
  janelaExpiraEm: z.string().nullable(),
  botRespondendoEm: z.string().nullable(),
});

export const atendimentoSchema = z.object({
  id: z.number(),
  intencao: z.string().nullable(),
  resumo: z.string().nullable(),
  confianca: z.number().nullable(),
  situacao: z.enum(["TRIAGEM", "ENCAMINHADO", "HUMANO", "ACEITO", "RECUSADO", "ABANDONADO"]),
  setorNome: z.string().nullable(),
  // ⚠️ Faltar aqui APAGA o campo da resposta, mesmo com o banco preenchido.
  leadNome: z.string().nullable(),
  leadEmpresa: z.string().nullable(),
  leadEmail: z.string().nullable(),
  criadoEm: z.string(),
});

export const clienteCandidatoSchema = z.object({
  id: z.number(),
  razao: z.string(),
  nomeFantasia: z.string().nullable(),
  contato: z.string().nullable(),
  cnpj: z.string().nullable(),
  ativo: z.boolean(),
});

export const mensagemSchema = z.object({
  id: z.number(),
  direcao: z.enum(["entrada", "saida"]),
  tipo: z.string(),
  texto: z.string().nullable(),
  midiaId: z.string().nullable(),
  midiaMime: z.string().nullable(),
  midiaNome: z.string().nullable(),
  status: z.string().nullable(),
  erro: z.string().nullable(),
  enviadaEm: z.string(),
  doBot: z.boolean(),
});

// ── Entrada ─────────────────────────────────────────────────────

export const listarConversasQuerySchema = z.object({
  busca: z.string().trim().min(1).optional(),
  /** Caixa de entrada de um numero. Ausente = todos os numeros da empresa. */
  contaId: z.coerce.number().int().positive().optional(),
});

export const contaIdQuerySchema = z.object({
  contaId: z.coerce.number().int().positive(),
});

export const contaSchema = z.object({
  id: z.number(),
  apelido: z.string().nullable(),
  numero: z.string().nullable(),
  phoneNumberId: z.string(),
  wabaId: z.string().nullable(),
  apiVersao: z.string(),
  ativo: z.boolean(),
  temToken: z.boolean(),
  temAppSecret: z.boolean(),
  verifyToken: z.string().nullable(),
  // ⚠️ Faltar aqui APAGA o campo da resposta, mesmo com o banco preenchido.
  botAtivo: z.boolean(),
  botRespondeTodos: z.boolean(),
  botNumeros: z.string().nullable(),
});

/**
 * Gravacao de conta.
 *
 * `token` e `appSecret` opcionais de proposito: ausentes significam "mantem o
 * que ja esta no vault". E o que permite editar o apelido sem redigitar o token
 * — e sem que a tela precise ter recebido o token para reenvia-lo.
 */
export const salvarContaBodySchema = z.object({
  id: z.number().int().positive().nullable().default(null),
  /*
   * ⚠️ A validacao do apelido tambem vive AQUI, e nao so na tela.
   *
   * A tela e conveniencia; o schema e a regra. Um POST direto na API passaria
   * por cima de qualquer checagem feita no formulario.
   */
  apelido: z
    .string()
    .trim()
    .max(60)
    .refine((v) => !temPalavrao(v), "Escolha outro apelido para este número")
    .nullable()
    .default(null),
  /* E.164: nunca menos que 8 digitos nem mais que 15, com DDI incluso. */
  numero: z
    .string()
    .trim()
    .max(20)
    .refine(
      (v) => v.replace(/\D/g, "").length >= 8 && v.replace(/\D/g, "").length <= 15,
      "Número de telefone inválido",
    )
    .nullable()
    .default(null),
  phoneNumberId: z.string().trim().min(5).max(40),
  wabaId: z.string().trim().max(40).nullable().default(null),
  apiVersao: z
    .string()
    .trim()
    .regex(/^v\d{1,3}\.\d{1,2}$/, "Use o formato da Meta, como v19.0")
    .default("v19.0"),
  verifyToken: z.string().trim().min(6).max(120).nullable().default(null),
  token: z.string().trim().min(20).nullable().default(null),
  appSecret: z.string().trim().min(16).nullable().default(null),
  /** Ligado responde a qualquer contato; desligado, so aos numeros da lista. */
  /** Sem isto, o numero nao usa IA e os dois campos abaixo nao valem nada. */
  botAtivo: z.boolean().default(false),
  botRespondeTodos: z.boolean().default(false),
  botNumeros: z.string().trim().max(400).nullable().default(null),
});

export const vincularBodySchema = z.object({
  clienteId: z.number().int().positive(),
});

export type VincularBody = z.infer<typeof vincularBodySchema>;

export const ativarContaBodySchema = z.object({
  ativo: z.boolean(),
});

export type SalvarContaBody = z.infer<typeof salvarContaBodySchema>;
export type AtivarContaBody = z.infer<typeof ativarContaBodySchema>;
export type ContaIdQuery = z.infer<typeof contaIdQuerySchema>;

export const conversaIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const midiaIdParamSchema = z.object({
  id: z.string().min(1),
});

/** A midia so baixa com o token da conta que a recebeu — a conversa diz qual e. */
export const conversaIdQuerySchema = z.object({
  conversaId: z.coerce.number().int().positive(),
});

export type ConversaIdQuery = z.infer<typeof conversaIdQuerySchema>;

/**
 * Limite de 4096 caracteres e o da propria Cloud API. Barrar aqui evita gastar
 * uma chamada de rede para receber o erro pronto.
 */
export const enviarTextoBodySchema = z.object({
  texto: z.string().trim().min(1).max(4096),
});

export const modeloSchema = z.object({
  nome: z.string(),
  idioma: z.string(),
  categoria: z.string(),
  corpo: z.string(),
  cabecalho: z.string().nullable(),
  rodape: z.string().nullable(),
  parametros: z.number(),
});

export const enviarModeloBodySchema = z.object({
  nome: z.string().min(1),
  /**
   * Posicionais: a ordem E o significado. A Meta so confere a quantidade, entao
   * trocar dois de lugar passa na validacao e chega errado no cliente.
   */
  parametros: z.array(z.string().trim().min(1).max(1024)).max(10).default([]),
});

export type EnviarModeloBody = z.infer<typeof enviarModeloBodySchema>;
export type ListarConversasQuery = z.infer<typeof listarConversasQuerySchema>;
export type ConversaIdParam = z.infer<typeof conversaIdParamSchema>;
export type MidiaIdParam = z.infer<typeof midiaIdParamSchema>;
export type EnviarTextoBody = z.infer<typeof enviarTextoBodySchema>;
