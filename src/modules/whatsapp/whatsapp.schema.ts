import { z } from "zod";
import { temPalavrao } from "@/shared/domain/linguagem";
import { paraFormatoMeta } from "@/modules/whatsapp/whatsapp.types";

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
  /*
   * ⚠️ Faltava aqui, e a lista de modelos vinha SEMPRE vazia.
   *
   * O painel pede `/modelos?contaId=…` com o numero desta conversa; sem o campo
   * na resposta ele mandava `undefined`, a rota recusava e a tela concluia
   * "nenhum modelo aprovado". Mesmo tropeco do `ultimoTipo` logo abaixo: o
   * schema apaga em silencio o que o repositorio ja trouxe.
   */
  contaId: z.number(),
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
  etiquetas: z.array(z.number()),
  arquivada: z.boolean(),
});

export const CORES_DE_ETIQUETA = [
  "verde",
  "azul",
  "ambar",
  "vermelho",
  "roxo",
  "cinza",
] as const;

export const etiquetaSchema = z.object({
  id: z.number(),
  nome: z.string(),
  cor: z.enum(CORES_DE_ETIQUETA),
});

export const salvarEtiquetaBodySchema = z.object({
  nome: z.string().trim().min(1).max(24),
  cor: z.enum(CORES_DE_ETIQUETA),
});

export const etiquetaIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/*
 * Etiquetas vao INTEIRAS, e nao "marca uma" / "desmarca uma".
 *
 * ⚠️ O painel edita a lista toda num popover, e dois atendentes mexendo ao mesmo
 * tempo com operacoes incrementais deixariam a conversa num estado que nenhum
 * dos dois pediu. Mandando o conjunto, o ultimo a salvar ganha e ele SABE o que
 * mandou.
 */
export const atualizarConversaBodySchema = z
  .object({
    etiquetas: z.array(z.number().int().positive()).optional(),
    arquivada: z.boolean().optional(),
  })
  .refine((v) => v.etiquetas !== undefined || v.arquivada !== undefined, {
    message: "Nada para alterar",
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
  /*
   * O arquivo e uma LISTA A PARTE, e nao um filtro somado.
   *
   * Misturar arquivada com ativa devolveria a caixa de entrada ao estado de
   * onde a pessoa acabou de tirar a conversa.
   */
  arquivadas: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
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
  iaCredencialId: z.number().nullable(),
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
    /*
     * ⚠️ O nono digito e resolvido AQUI, e nao so na tela.
     *
     * A tela e conveniencia; o schema e a regra. Um POST direto gravaria o
     * celular brasileiro de 10 digitos, e a partir dai o mesmo telefone
     * existiria em duas formas no banco. Ver `comNonoDigito`.
     */
    .transform((v) => (v ? paraFormatoMeta(v) : v))
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
  /** A chave que ESTE numero usa. Sem ela, o numero nao responde sozinho. */
  iaCredencialId: z.number().int().positive().nullable().default(null),
  botRespondeTodos: z.boolean().default(false),
  botNumeros: z.string().trim().max(400).nullable().default(null),
}).refine(
  /*
   * ⚠️ Com IA ligada, a chave e obrigatoria.
   *
   * Sem ela o numero gastaria numa credencial escolhida pela fila, e depois nao
   * haveria como dizer qual numero consumiu o que. Rateio exige escolha
   * explicita, e a tela sozinha nao basta: um POST direto passaria por cima.
   */
  (v) => !v.botAtivo || v.iaCredencialId != null,
  { message: "Escolha a chave de IA deste número", path: ["iaCredencialId"] },
);

/**
 * O que testar antes de gravar o numero.
 *
 * `token` vazio com `id` preenchido usa o que ja esta no vault, o mesmo acordo
 * do salvar. App Secret e Verify token nao entram: nenhum dos dois tem como ser
 * conferido sem a Meta chamar a URL de callback.
 */
export const testarContaBodySchema = z.object({
  id: z.number().int().positive().nullable().default(null),
  phoneNumberId: z.string().trim().min(5).max(40),
  apiVersao: z
    .string()
    .trim()
    .regex(/^v\d{1,3}\.\d{1,2}$/, "Use o formato da Meta, como v19.0")
    .default("v19.0"),
  token: z.string().trim().min(20).nullable().default(null),
});

/**
 * O vinculo de um modelo do cliente a uma finalidade do sistema.
 *
 * `parametros` e POSICIONAL: o indice 0 e o `{{1}}`. A conferencia contra o
 * modelo real acontece no servico, que le a lista da Meta — aqui so a forma.
 */
export const salvarVinculoBodySchema = z.object({
  contaId: z.number().int().positive(),
  finalidade: z.enum(["cobranca", "ticket", "contapagar", "aniversario"]),
  modeloNome: z.string().trim().min(1).max(120),
  idioma: z.string().trim().min(2).max(20).default("pt_BR"),
  parametros: z.array(z.string().trim().min(1).max(40)).max(20),
  botaoParam: z.string().trim().min(1).max(40).nullable().default(null),
});

/**
 * Pede a Meta o modelo padrao de uma finalidade.
 *
 * ⚠️ Sem nome, sem texto, sem categoria. Tudo isso e do catalogo de finalidades
 * e nao viaja pela rede: aceitar do cliente deixaria qualquer um criar na conta
 * da empresa um modelo com o texto que quisesse.
 */
export const criarModeloBodySchema = z.object({
  contaId: z.number().int().positive(),
  finalidade: z.enum(["cobranca", "ticket", "contapagar", "aniversario"]),
  /**
   * O texto revisado antes de criar. Ausente usa o sugerido.
   *
   * ⚠️ O que NAO vem daqui e o mapeamento: os `{{n}}` continuam significando o
   * que a finalidade diz. Por isso o servico recusa texto que mude a quantidade
   * ou a numeracao dos campos — seria o mesmo modelo apontando valores para
   * posicoes trocadas.
   */
  cabecalho: z.string().trim().max(60).nullable().default(null),
  corpo: z.string().trim().min(10).max(1024).optional(),
  rodape: z.string().trim().max(60).nullable().default(null),
});

export const removerVinculoQuerySchema = z.object({
  contaId: z.coerce.number().int().positive(),
  finalidade: z.string().trim().min(1).max(40),
});

export const vincularBodySchema = z.object({
  clienteId: z.number().int().positive(),
});

export type VincularBody = z.infer<typeof vincularBodySchema>;

export const ativarContaBodySchema = z.object({
  ativo: z.boolean(),
});

export type SalvarContaBody = z.infer<typeof salvarContaBodySchema>;
export type TestarContaBody = z.infer<typeof testarContaBodySchema>;
export type SalvarVinculoBody = z.infer<typeof salvarVinculoBodySchema>;
export type CriarModeloBody = z.infer<typeof criarModeloBodySchema>;
export type RemoverVinculoQuery = z.infer<typeof removerVinculoQuerySchema>;
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
  botao: z.object({ texto: z.string(), temVariavel: z.boolean() }).nullable(),
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
export type SalvarEtiquetaBody = z.infer<typeof salvarEtiquetaBodySchema>;
export type EtiquetaIdParam = z.infer<typeof etiquetaIdParamSchema>;
export type AtualizarConversaBody = z.infer<typeof atualizarConversaBodySchema>;
export type ConversaIdParam = z.infer<typeof conversaIdParamSchema>;
export type MidiaIdParam = z.infer<typeof midiaIdParamSchema>;
export type EnviarTextoBody = z.infer<typeof enviarTextoBodySchema>;
