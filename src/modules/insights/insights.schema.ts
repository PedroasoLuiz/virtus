import { z } from "zod";
import { dataISOSchema, idSchema, textoCurtoSchema } from "@/shared/validators/comuns";

/** Contratos de entrada e saida do painel de anuncios. */

export const idParamSchema = z.object({ id: idSchema });

export const atualizarConexaoBodySchema = z
  .object({
    clienteId: idSchema.nullish(),
    ativo: z.boolean(),
  })
  .partial();

/** Renovar o acesso: o unico lugar que ainda recebe token. */
export const renovarAcessoBodySchema = z.object({
  token: z.string().trim().min(20, "Token curto demais para ser válido").max(1000),
});

export const acessoSchema = z.object({
  id: z.number(),
  nome: z.string().nullable(),
  expiraEm: z.string().nullable(),
  ativo: z.boolean(),
});

/**
 * A busca de contas: token colado OU uma conexao ja ligada.
 *
 * ⚠️ Os dois sao opcionais no schema e o servico exige um deles. Marcar como
 * obrigatorio aqui obrigaria dois schemas quase iguais, e a regra de "um ou
 * outro" e negocio, nao formato.
 */
export const contasDisponiveisBodySchema = z.object({
  token: z.string().trim().min(20).max(1000).nullish(),
  acessoId: idSchema.nullish(),
});

export const contaDisponivelSchema = z.object({
  adAccountId: z.string(),
  nome: z.string(),
  ativa: z.boolean(),
  moeda: z.string().nullable(),
});

export const contasDisponiveisSchema = z.object({
  contas: z.array(contaDisponivelSchema),
  jaConectadas: z.array(z.string()),
});

/**
 * Ligar varias de uma vez, com o mesmo acesso.
 *
 * ⚠️ Aceita `token` OU `conexaoId`, pelo mesmo motivo da busca: reaproveitando
 * um acesso ja ligado, o segredo nao precisa passar pelo navegador para voltar.
 */
export const conectarContasBodySchema = z.object({
  token: z.string().trim().min(20).max(1000).nullish(),
  acessoId: idSchema.nullish(),
  contas: z
    .array(
      z.object({
        adAccountId: textoCurtoSchema,
        nome: textoCurtoSchema.nullish(),
        clienteId: idSchema.nullish(),
      }),
    )
    .min(1, "Escolha ao menos uma conta")
    .max(50),
});

export const conexaoSchema = z.object({
  id: z.number(),
  adAccountId: z.string(),
  nome: z.string().nullable(),
  clienteId: z.number().nullable(),
  clienteNome: z.string().nullable(),
  acessoId: z.number(),
  ativo: z.boolean(),
});

/**
 * O periodo mais o cliente escolhido.
 *
 * ⚠️ `cliente` aceita `"sem"` alem do id, e nao e descuido: conta ligada sem
 * cliente atribuido existe, e no eixo cliente ela sumiria da tela. O literal
 * deixa isso explicito na propria URL, que um id zero ou ausente nao deixaria.
 */
export const painelQuerySchema = z.object({
  cliente: z.union([z.literal("sem"), z.string().regex(/^[1-9]\d*$/)]),
  de: dataISOSchema,
  ate: dataISOSchema,
});

const familiaSchema = z.enum([
  "COMPRA",
  "CADASTRO",
  "CONVERSA",
  "VISITA",
  "ENGAJAMENTO",
  "CLIQUE",
]);

const serieSchema = z.array(z.object({ dia: z.string(), valor: z.number() }));

const publicacaoSchema = z.object({
  id: z.string(),
  legenda: z.string().nullable(),
  tipo: z.enum(["IMAGEM", "VIDEO", "CARROSSEL"]),
  imagem: z.string().nullable(),
  link: z.string(),
  data: z.string(),
  curtidas: z.number(),
  comentarios: z.number(),
  compartilhamentos: z.number().nullable(),
});

export const painelDoClienteSchema = z.object({
  cliente: z.object({ chave: z.string(), nome: z.string() }),
  periodo: z.object({ de: z.string(), ate: z.string() }),
  contas: z.array(z.string()),
  resumo: z
    .object({
      investido: z.number(),
      impressoes: z.number(),
      cliques: z.number(),
      custoPorClique: z.number(),
      ctr: z.number(),
      resultados: z.number(),
      familiaDeResultado: familiaSchema.nullable(),
      /*
       * ⚠️ Chave livre, e nao `z.record(familiaSchema, ...)`.
       *
       * Com chave de enum, o Zod exige TODAS as familias presentes, e o mapa e
       * parcial de proposito: so entra a familia que aconteceu. Uma conta que so
       * gerou conversa nao tem a chave COMPRA, e a resposta inteira era recusada
       * com "Dados invalidos" — sem dizer qual campo, que e o pior tipo de erro
       * de contrato.
       */
      resultadosPorFamilia: z.record(z.string(), z.number()),
      custoPorResultado: z.number(),
    })
    .nullable(),
  investidoDoResultado: z.number(),
  investidoPorDia: serieSchema,
  resultadosPorDia: serieSchema,
  impressoesPorDia: serieSchema,
  cliquesPorDia: serieSchema,
  campanhas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      conta: z.string(),
      investido: z.number(),
      impressoes: z.number(),
      cliques: z.number(),
      resultados: z.number(),
      ctr: z.number(),
      porFamilia: z.record(z.string(), z.number()),
    }),
  ),
  anuncios: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      campanha: z.string(),
      conta: z.string(),
      imagem: z.string().nullable(),
      investido: z.number(),
      impressoes: z.number(),
      cliques: z.number(),
      resultados: z.number(),
      ctr: z.number(),
    }),
  ),
  paginaNome: z.string().nullable(),
  pagina: z
    .object({
      fas: z.number(),
      alcance: z.number(),
      visualizacoes: z.number(),
      engajamento: z.number(),
      alcancePorDia: serieSchema,
      visualizacoesPorDia: serieSchema,
      engajamentoPorDia: serieSchema,
      publicacoes: z.array(publicacaoSchema),
    })
    .nullable(),
  perfil: z
    .object({
      igUsername: z.string().nullable(),
      seguidores: z.number(),
      publicacoes: z.number(),
      ganhoNoPeriodo: z.number(),
      alcanceNoPeriodo: z.number(),
      ganhoPorDia: serieSchema,
      alcancePorDia: serieSchema,
      serieCortada: z.boolean(),
      publicacoesDoPeriodo: z.array(publicacaoSchema),
    })
    .nullable(),
  falhas: z.array(z.string()),
});

export type ContasDisponiveisBody = z.infer<typeof contasDisponiveisBodySchema>;
export type ConectarContasBody = z.infer<typeof conectarContasBodySchema>;
export type RenovarAcessoBody = z.infer<typeof renovarAcessoBodySchema>;
export type AtualizarConexaoBody = z.infer<typeof atualizarConexaoBodySchema>;
export type PainelQuery = z.infer<typeof painelQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;

/** Buscar Paginas: mesma dupla porta da busca de contas. */
export const paginasDisponiveisBodySchema = z.object({
  token: z.string().trim().min(20).max(1000).nullish(),
  acessoId: idSchema.nullish(),
});

export const paginaDisponivelSchema = z.object({
  pageId: z.string(),
  nome: z.string(),
  igUserId: z.string().nullable(),
  igUsername: z.string().nullable(),
});

export const paginasDisponiveisSchema = z.object({
  paginas: z.array(paginaDisponivelSchema),
  jaLigadas: z.array(z.string()),
});

/** ⚠️ So `acessoId`: Pagina nasce pendurada num acesso que ja existe. */
export const ligarPaginasBodySchema = z.object({
  acessoId: idSchema,
  paginas: z
    .array(
      z.object({
        pageId: textoCurtoSchema,
        nome: textoCurtoSchema.nullish(),
        igUserId: textoCurtoSchema.nullish(),
        igUsername: textoCurtoSchema.nullish(),
        clienteId: idSchema.nullish(),
      }),
    )
    .min(1, "Escolha ao menos uma Página")
    .max(50),
});

export const paginaSchema = z.object({
  id: z.number(),
  pageId: z.string(),
  nome: z.string().nullable(),
  igUserId: z.string().nullable(),
  igUsername: z.string().nullable(),
  clienteId: z.number().nullable(),
  clienteNome: z.string().nullable(),
  acessoId: z.number(),
  ativo: z.boolean(),
});

export type PaginasDisponiveisBody = z.infer<typeof paginasDisponiveisBodySchema>;
export type LigarPaginasBody = z.infer<typeof ligarPaginasBodySchema>;
