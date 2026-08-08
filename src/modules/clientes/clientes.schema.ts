import { z } from "zod";
import {
  cnpjSchema,
  emailSchema,
  idSchema,
  textoCurtoSchema,
} from "@/shared/validators/comuns";
import { paginacaoSchema } from "@/shared/utils/paginacao";
import { CLASSIFICACOES, REGIMES } from "@/modules/clientes/clientes.types";
import { analisarTelefone } from "@/shared/domain/telefone";

/** Contratos de entrada e saida do modulo clientes. */

export const papelSchema = z.enum([
  "cliente",
  "fornecedor",
  "colaborador",
  "transportadora",
  "corretor",
]);

export const campoDeOrdemSchema = z.enum([
  "id",
  "razao",
  "cnpj",
  "contato",
  "email",
  "responsavel",
]);

export const listarQuerySchema = paginacaoSchema.extend({
  busca: z.string().trim().max(120).optional(),
  papel: papelSchema.optional(),
  ativo: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  ordem: campoDeOrdemSchema.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export const contagemQuerySchema = z.object({
  /** Sem isto, so os ativos entram na conta — o mesmo padrao da listagem. */
  inativos: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const contagemSchema = z.object({
  total: z.number(),
  cliente: z.number(),
  fornecedor: z.number(),
  colaborador: z.number(),
  transportadora: z.number(),
  corretor: z.number(),
});

/**
 * ⚠️ Documento e data NAO travam o cadastro.
 *
 * O cadastro nasce muitas vezes antes do documento: um orcamento para quem ainda
 * nao passou o CPF precisa de alguem para apontar. Exigindo ali, o atendimento
 * inventava documento para o botao liberar, e cadastro com CPF inventado e pior
 * do que cadastro incompleto.
 *
 * ⚠️ Quem cobra a falta e o FATURAMENTO. O cadastro fica pendente e a fatura
 * recusa nascer sem os dois: e o momento em que o dado passa a ser necessario de
 * verdade, e ate la ninguem e obrigado a nada.
 */
export const criarClienteBodySchema = z.object({
  razao: textoCurtoSchema,
  nomeFantasia: textoCurtoSchema.nullish(),
  cnpj: cnpjSchema.nullish(),
  dataNascimento: z.iso.date().nullish(),
  email: emailSchema.nullish(),
  contato: z.string().trim().max(40).nullish(),
  papeis: z.array(papelSchema).min(1, "Informe ao menos um papel"),
  grupoId: idSchema.nullish(),
  /** Omitido, o banco preenche com o "Geral" da empresa. */
  centroCustoId: idSchema.nullish(),
  inscricaoMunicipal: z.string().trim().max(30).nullish(),
  inscricaoEstadual: z.string().trim().max(30).nullish(),
  regimeTributario: z.enum(REGIMES).nullish(),
  classificacaoTributaria: z.enum(CLASSIFICACOES).nullish(),
  // As listas moram nos contratos do modulo: a tela usa as mesmas para desenhar
  // o seletor, e importar este arquivo levaria o zod para o navegador.
});

export const idParamSchema = z.object({ id: idSchema });

export const filhoIdParamSchema = z.object({ id: idSchema, filhoId: idSchema });

export const enderecoSchema = z.object({
  id: z.number(),
  cep: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  principal: z.boolean(),
});

export const criarEnderecoBodySchema = z.object({
  cep: z.string().trim().max(12).nullish(),
  logradouro: z.string().trim().max(160).nullish(),
  numero: z.string().trim().max(20).nullish(),
  complemento: z.string().trim().max(80).nullish(),
  bairro: z.string().trim().max(80).nullish(),
  cidade: z.string().trim().max(80).nullish(),
  /** Duas letras. Estado por extenso quebraria a nota fiscal na hora de emitir. */
  uf: z.string().trim().length(2).nullish(),
  principal: z.boolean().default(false),
});

export const bancarioSchema = z.object({
  id: z.number(),
  banco: z.string().nullable(),
  agencia: z.string().nullable(),
  conta: z.string().nullable(),
  tipo: z.string().nullable(),
  titular: z.string().nullable(),
  documento: z.string().nullable(),
  pixTipo: z.string().nullable(),
  pixChave: z.string().nullable(),
  principal: z.boolean(),
});

export const criarBancarioBodySchema = z.object({
  banco: z.string().trim().max(80).nullish(),
  agencia: z.string().trim().max(20).nullish(),
  conta: z.string().trim().max(30).nullish(),
  tipo: z.enum(["corrente", "poupanca"]).nullish(),
  titular: z.string().trim().max(160).nullish(),
  documento: z.string().trim().max(20).nullish(),
  pixTipo: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).nullish(),
  pixChave: z.string().trim().max(160).nullish(),
  principal: z.boolean().default(false),
});

export const usuarioComAcessoSchema = z.object({
  id: z.string(),
  nome: z.string().nullable(),
  email: z.string().nullable(),
});

/*
 * ⚠️ Os vinculos vao INTEIROS, e nao "adiciona um" / "remove um".
 *
 * A tela edita a lista toda de uma vez, e duas pessoas mexendo ao mesmo tempo com
 * operacoes incrementais deixariam a pessoa num estado que nenhuma das duas
 * pediu. Mandando o conjunto, a ultima a salvar ganha e ela SABE o que mandou.
 */
export const definirUsuariosBodySchema = z.object({
  usuarios: z.array(z.uuid()).max(60),
});

export const contatoIdParamSchema = z.object({ id: idSchema, contatoId: idSchema });

export const contatoSchema = z.object({
  id: z.number(),
  tipo: z.enum(["telefone", "email"]),
  valor: z.string(),
  rotulo: z.string().nullable(),
  responsavel: z.string().nullable(),
  /** Quem entra no portal com este e-mail. Ausente nos telefones. */
  usuario: z.string().nullish(),
});

/**
 * O telefone e LIDO, e nao so medido pelo tamanho.
 *
 * ⚠️ Valida e normaliza no mesmo lugar: o que sai daqui e o numero ja formatado,
 * do jeito que vai ser guardado e exibido. Antes o cadastro aceitava qualquer
 * coisa com oito caracteres, e "3599845" ia para a coluna do principal e so
 * falhava dias depois, na hora de mandar a cobranca, longe de quem digitou.
 */
const telefoneSchema = z
  .string()
  .trim()
  .max(30)
  .transform((valor, ctx) => {
    const analise = analisarTelefone(valor);

    if (analise.erro) {
      ctx.addIssue({ code: "custom", message: analise.erro });
      return z.NEVER;
    }

    return analise.formatado;
  });

export const criarContatoBodySchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("email"),
    // Minusculo sempre: "Joao@" e "joao@" sao a mesma caixa, e guardando os dois
    // o mesmo e-mail aparecia duas vezes na lista sem parecer repetido.
    valor: emailSchema.transform((v) => v.toLowerCase()),
    rotulo: z.string().trim().max(40).nullish(),
    responsavel: textoCurtoSchema.nullish(),
  }),
  z.object({
    tipo: z.literal("telefone"),
    valor: telefoneSchema,
    rotulo: z.string().trim().max(40).nullish(),
    responsavel: textoCurtoSchema.nullish(),
  }),
]);

/**
 * Edicao de um contato que ja existe.
 *
 * ⚠️ O `tipo` continua vindo: e ele que escolhe a regra do valor. Um e-mail
 * corrigido sem dizer o tipo cairia na regra frouxa do telefone, e "joao@" seria
 * aceito por ter oito caracteres.
 */
export const atualizarContatoBodySchema = criarContatoBodySchema;

export const atualizarEnderecoBodySchema = criarEnderecoBodySchema.omit({ principal: true });

export const atualizarBancarioBodySchema = criarBancarioBodySchema.omit({ principal: true });

export const clienteSchema = z.object({
  id: z.number(),
  razao: z.string(),
  nomeFantasia: z.string().nullable(),
  cnpj: z.string().nullable(),
  email: z.string().nullable(),
  contato: z.string().nullable(),
  /** Do contato principal: a coluna de `clientes` nao existe mais. */
  responsavel: z.string().nullable(),
  papeis: z.array(papelSchema),
  grupoId: z.number().nullable(),
  centroCustoId: z.number().nullable(),
  centroCustoNome: z.string().nullable(),
  dataNascimento: z.string().nullable(),
  inscricaoMunicipal: z.string().nullable(),
  inscricaoEstadual: z.string().nullable(),
  regimeTributario: z.string().nullable(),
  classificacaoTributaria: z.string().nullable(),
  ativo: z.boolean(),
});

export type ListarQuery = z.infer<typeof listarQuerySchema>;
export type ContagemQuery = z.infer<typeof contagemQuerySchema>;
export type ContatoIdParam = z.infer<typeof contatoIdParamSchema>;
export type FilhoIdParam = z.infer<typeof filhoIdParamSchema>;
export type CriarEnderecoBody = z.infer<typeof criarEnderecoBodySchema>;
export type CriarBancarioBody = z.infer<typeof criarBancarioBodySchema>;
export type DefinirUsuariosBody = z.infer<typeof definirUsuariosBodySchema>;
export type CriarContatoBody = z.infer<typeof criarContatoBodySchema>;
export type AtualizarContatoBody = z.infer<typeof atualizarContatoBodySchema>;
export type AtualizarEnderecoBody = z.infer<typeof atualizarEnderecoBodySchema>;
export type AtualizarBancarioBody = z.infer<typeof atualizarBancarioBodySchema>;
export type CriarClienteBody = z.infer<typeof criarClienteBodySchema>;
export type IdParam = z.infer<typeof idParamSchema>;

/** Edicao: tudo opcional — o cliente envia so o que mudou. */
export const atualizarClienteBodySchema = criarClienteBodySchema
  .partial()
  .extend({ ativo: z.boolean().optional() });

export type AtualizarClienteBody = z.infer<typeof atualizarClienteBodySchema>;
