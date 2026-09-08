import { z } from "zod";
import {
  centavosSchema,
  centavosPositivoSchema,
  dataISOSchema,
  idSchema,
  textoCurtoSchema,
  textoLongoSchema,
} from "@/shared/validators/comuns";
import { paginacaoSchema } from "@/shared/utils/paginacao";
import { ORIGENS_DA_CONTA } from "@/modules/contas-pagar/contas-pagar.types";

/**
 * Contratos de entrada e saida do modulo contas a pagar.
 *
 * Validado aqui, na borda. Service e repository confiam no que recebem.
 */

// ── Entrada ─────────────────────────────────────────────────────────────────

export const listarQuerySchema = paginacaoSchema.extend({
  fornecedorId: idSchema.optional(),
  incluirCanceladas: z.coerce.boolean().optional(),
});

export const idParamSchema = z.object({ id: idSchema });

export const anexoParamSchema = z.object({ id: idSchema, anexoId: idSchema });

/**
 * ⚠️ Substitui a lista INTEIRA, e nao edita linha a linha.
 *
 * A conta e a soma dos lancamentos: mandar "mudei a linha 3" obrigaria o
 * servidor a recompor o conjunto a partir de um estado que ele nao viu, e duas
 * edicoes simultaneas se sobrescreveriam sem ninguem notar. Mandando a lista
 * como ela deve ficar, o que chega e o que vale.
 */
export const substituirLancamentosBodySchema = z.object({
  lancamentos: z
    .array(
      z.object({
        descricao: textoCurtoSchema,
        valor: centavosPositivoSchema,
        centroCustoId: idSchema.nullish(),
      }),
    )
    .min(1, "A conta precisa de ao menos um lançamento")
    .max(200),
});

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
 * Uma compra lancada no cartao.
 *
 * ⚠️ Ela NAO passa por conta a pagar. A linha da fatura ja carrega fornecedor,
 * descricao, data, valor e centro de custo — ela e a despesa. Ver o servico.
 */
export const compraNoCartaoBodySchema = z.object({
  fornecedorId: idSchema,
  descricao: textoCurtoSchema,
  dataCompra: dataISOSchema,
  valor: centavosPositivoSchema,
  centroCustoId: idSchema.nullish(),
  /*
   * ⚠️ Cada parcela cai num CICLO diferente, e pode acabar em faturas
   * diferentes. Comprar em 10x nao e uma despesa de dez vezes o valor neste mes.
   */
  parcelas: z.number().int().min(1).max(36).default(1),
  /*
   * ⚠️ O ciclo de onde a compra foi lancada, quando ela nasce DE DENTRO de uma
   * fatura.
   *
   * Sem ele, o ciclo sai da data da compra pela regra do cartao — e e o certo
   * quando se lanca "no cartao". Mas quem abriu a fatura de junho e clicou em
   * lancar ja disse em qual ciclo aquilo entra: recalcular pela data jogaria a
   * compra para outra fatura, e a pessoa veria o lancamento sumir da tela em que
   * estava.
   */
  competenciaInicial: dataISOSchema.optional(),
});

/**
 * O que se muda num cartao ja cadastrado.
 *
 * ⚠️ Os dois campos sao OPCIONAIS e independentes: a tela manda o que mexeu. O
 * interruptor da lista manda so `ativo`; o seletor de fornecedor manda so ele.
 */
export const cartaoAtivoBodySchema = z.object({
  ativo: z.boolean().optional(),
  fornecedorId: idSchema.nullish(),
});

/** O filtro da lista de faturas. Sem cartao, vem tudo. */
export const faturasQuerySchema = z.object({
  cartaoId: idSchema.optional(),
});

export const lancamentoParamSchema = z.object({
  id: idSchema,
  lancamentoId: idSchema,
});

export const atualizarContaBodySchema = z.object({
  observacoes: textoLongoSchema.nullish(),
});

export const parcelaParamSchema = z.object({ id: idSchema, parcelaId: idSchema });

/**
 * O cancelamento de uma parcela.
 *
 * ⚠️ O motivo e OPCIONAL. Sem ele o registro fica pior — "por que a parcela 5
 * nao e mais cobrada?" e a pergunta que aparece depois —, mas exigir texto faria
 * alguem digitar um ponto para passar da tela, e "." nao explica nada a ninguem.
 */
export const cancelarParcelaBodySchema = z.object({
  motivo: z.string().trim().max(300).nullish(),
});

/** ⚠️ Enum fechado: `tipo` escolhe COLUNA, e coluna nao se aceita como texto livre. */
export const tipoDocumentoQuerySchema = z.object({
  tipo: z.enum(["nfs", "boleto", "comprovante"]),
});

export const criarContaBodySchema = z.object({
  fornecedorId: idSchema,
  /*
   * ⚠️ OPCIONAL: quando nao vem, o servico usa a descricao do primeiro
   * lancamento. A conta precisa de um nome para a listagem, mas pedi-lo a parte
   * fazia a pessoa escrever duas vezes a mesma coisa — o lancamento ja diz o que
   * esta sendo pago.
   */
  descricao: textoCurtoSchema.nullish(),
  emissao: dataISOSchema,
  /*
   * ⚠️ O TOTAL nao esta neste contrato, e isso e de proposito: ele e a soma dos
   * lancamentos. Aceitar os dois abriria a porta para um corpo em que eles
   * discordam, e nenhuma escolha seria obviamente a certa.
   */
  lancamentos: z
    .array(
      z.object({
        descricao: textoCurtoSchema,
        valor: centavosPositivoSchema,
        centroCustoId: idSchema.nullish(),
      }),
    )
    .min(1, "A conta precisa de ao menos um lançamento")
    .max(200),
  origem: z
    .object({
      tipo: z.enum(ORIGENS_DA_CONTA),
      ordemId: idSchema.nullish(),
      contratoId: idSchema.nullish(),
    })
    .optional(),
  /*
   * ⚠️ Documento e tipo sao OBRIGATORIOS, e nao opcionais como nasceram.
   *
   * Toda conta a pagar vem de um papel — nota, contrato, guia, recibo. Sem ele
   * nao ha o que conferir contra a divida, e o que chega no fechamento e um
   * valor sem procedencia.
   */
  tipoDocumentoId: idSchema,
  documento: textoCurtoSchema,
  observacoes: textoLongoSchema.nullish(),
  /*
   * ⚠️ O cronograma vem PRONTO, e nao mais como intencao.
   *
   * A tela passou a mostrar a tabela de parcelas editavel: quem cadastra move
   * vencimento e reparte valor linha a linha antes de salvar. Mandando so
   * "3x a partir de tal dia", tudo isso se perderia no caminho e o servidor
   * devolveria um cronograma que ninguem pediu.
   *
   * A divisao de centavos continua sendo do dominio: a tela chama
   * `gerarParcelas` para desenhar a grade inicial, e o servidor confere a soma
   * com `conferirTotal`. O calculo e um so; o que viaja e o resultado.
   */
  parcelas: z
    .array(
      z.object({
        vencimento: dataISOSchema,
        valor: centavosPositivoSchema,
      }),
    )
    .min(1, "A conta precisa de ao menos uma parcela")
    .max(360),
});

// ── Saida ───────────────────────────────────────────────────────────────────

/**
 * ⚠️ Zod de saida DESCARTA o que nao declara: ao acrescentar campo no tipo de
 * dominio, este schema e o lugar que costuma ficar para tras, e o sintoma e o
 * campo sumir da tela sem erro nenhum.
 */
export const contaResumoSchema = z.object({
  id: z.number(),
  numero: z.number().nullable(),
  descricao: z.string(),
  fornecedorId: z.number().nullable(),
  fornecedorNome: z.string().nullable(),
  emissao: z.string().nullable(),
  proximoVencimento: z.string().nullable(),
  total: z.number(),
  pago: z.boolean(),
  valorPago: z.number(),
  cancelada: z.boolean(),
  suspensa: z.boolean(),
  conciliada: z.boolean(),
  qtdParcelas: z.number(),
  parcelasPagas: z.number(),
});

export const contaDetalheSchema = contaResumoSchema.extend({
  observacoes: z.string().nullable(),
  fornecedorDoc: z.string().nullable(),
  documento: z.string().nullable(),
  tipoDocumentoId: z.number().nullable(),
  tipoDocumentoSigla: z.string().nullable(),
  centroCustoId: z.number().nullable(),
  centroCustoNome: z.string().nullable(),
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
      /* Combinada e nao vai mais acontecer: contrato encerrado antes dela. */
      cancelada: z.boolean(),
      motivoDoCancelamento: z.string().nullable(),
      /* Juros e multa pagos por atraso, somados. Nao e `acrescimo`: aquele foi
         combinado no parcelamento e ja esta dentro de `total`. */
      jurosMulta: z.number(),
      conciliado: z.boolean(),
      nfs: z.string().nullable(),
      boleto: z.string().nullable(),
      comprovante: z.string().nullable(),
    }),
  ),
  anexos: z.array(
    z.object({
      id: z.number(),
      nome: z.string(),
      caminho: z.string(),
      criadoEm: z.string().nullable(),
    }),
  ),
  lancamentos: z.array(
    z.object({
      id: z.number(),
      descricao: z.string(),
      valor: z.number(),
      centroCustoId: z.number().nullable(),
      centroCustoCodigo: z.string().nullable(),
      centroCustoNome: z.string().nullable(),
    }),
  ),
  rateio: z.array(
    z.object({
      centroCustoId: z.number().nullable(),
      centroCustoNome: z.string().nullable(),
      valor: z.number(),
    }),
  ),
  origens: z.array(
    z.object({
      id: z.number(),
      origem: z.string(),
      ordemId: z.number().nullable(),
      contratoId: z.number().nullable(),
      valor: z.number(),
      observacoes: z.string().nullable(),
    }),
  ),
});

export const parcelasAPagarQuerySchema = z.object({ fornecedorId: idSchema });

/**
 * Juros e multa sao `centavosSchema` e nao positivo: zero e o caso normal, e
 * exigir positivo obrigaria a tela a omitir os campos em toda baixa em dia.
 */
const destinoSchema = z.object({
  parcelaId: idSchema,
  valor: centavosPositivoSchema,
  juros: centavosSchema.default(0),
  multa: centavosSchema.default(0),
  quitar: z.boolean().default(false),
});

export const criarBaixaBodySchema = z.object({
  /**
   * O favorecido. Obrigatorio mesmo dando para deduzir das parcelas: e ele que
   * define quais parcelas a tela oferece, e mandar explicito faz o servidor
   * recusar um `parcelaId` de outro fornecedor em vez de quita-lo em silencio.
   */
  fornecedorId: idSchema,
  data: dataISOSchema,
  tipo: textoCurtoSchema,
  /*
   * ⚠️ Um dos dois, e o servico recusa se vierem os dois ou nenhum.
   *
   * Pela CONTA o dinheiro sai agora; pelo CARTAO a divida troca de credor e o
   * dinheiro sai quando a fatura for paga. Sao momentos diferentes do caixa, e
   * o schema nao tem como saber qual faz sentido — quem sabe e a regra.
   */
  contaBancariaId: idSchema.nullish(),
  cartaoId: idSchema.nullish(),
  observacoes: textoLongoSchema.nullish(),
  destinos: z.array(destinoSchema).min(1, "Escolha ao menos uma parcela").max(200),
});

export const faturaDeCartaoSchema = z.object({
  id: z.number(),
  cartaoId: z.number(),
  cartaoApelido: z.string().nullable(),
  competencia: z.string(),
  fechamento: z.string().nullable(),
  vencimento: z.string().nullable(),
  total: z.number(),
  status: z.string(),
  contaPagarId: z.number().nullable(),
  /* O numero por empresa da conta do fechamento — o que a tela mostra. O `id`
     acima e a chave, e nao aparece em nenhuma outra tela. */
  contaPagarNumero: z.number().nullable(),
  /* A conta do fechamento ja recebeu dinheiro: e o que barra o reabrir na tela,
     antes do clique, em vez de deixar o servidor recusar depois. */
  contaPaga: z.boolean(),
  qtdLancamentos: z.number(),
});

export const cartaoDaBaixaSchema = z.object({
  id: z.number(),
  apelido: z.string().nullable(),
  bandeira: z.string().nullable(),
  diaFechamento: z.number(),
  diaVencimento: z.number(),
  fornecedorId: z.number().nullable(),
  bancoId: z.number().nullable(),
  bancoNome: z.string().nullable(),
  ultimosDigitos: z.string().nullable(),
  ativo: z.boolean(),
  limite: z.number(),
});

/**
 * ⚠️ Nao ha campo de CVV, e nunca deve haver. Armazenar CVV e proibido pelo
 * PCI-DSS sem excecao. E `ultimosDigitos` aceita no maximo 4: o schema e a
 * primeira barreira contra o PAN inteiro chegar ao banco.
 */
export const bancoDaListaSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  nome: z.string(),
  doSistema: z.boolean(),
});

export const criarCartaoBodySchema = z.object({
  apelido: textoCurtoSchema,
  bandeira: textoCurtoSchema.nullish(),
  ultimosDigitos: z.string().trim().max(4).nullish(),
  diaFechamento: z.number().int().min(1).max(31),
  diaVencimento: z.number().int().min(1).max(31),
  limite: centavosSchema.default(0),
  bancoId: idSchema.nullish(),
  fornecedorId: idSchema.nullish(),
  contaBancariaId: idSchema.nullish(),
});

export const parcelaAPagarSchema = z.object({
  parcelaId: z.number(),
  contaId: z.number(),
  contaNumero: z.number().nullable(),
  contaDescricao: z.string().nullable(),
  numero: z.number(),
  totalParcelas: z.number(),
  vencimento: z.string().nullable(),
  total: z.number(),
  quitado: z.number(),
  emAberto: z.number(),
  liberada: z.boolean(),
});

export const tipoDeDocumentoSchema = z.object({
  id: z.number(),
  sigla: z.string(),
  nome: z.string(),
  doSistema: z.boolean(),
});

export const baixaSchema = z.object({
  id: z.number(),
  data: z.string().nullable(),
  tipo: z.string().nullable(),
  valor: z.number(),
  fornecedorNome: z.string().nullable(),
  contaNome: z.string().nullable(),
  conciliado: z.boolean(),
  descricao: z.string().nullable(),
  qtdParcelas: z.number(),
  qtdContas: z.number(),
  observacoes: z.string().nullable(),
  registradoEm: z.string().nullable(),
  destinos: z.array(
    z.object({
      parcelaId: z.number(),
      contaId: z.number(),
      contaNumero: z.number().nullable(),
      contaDescricao: z.string().nullable(),
      numero: z.number(),
      vencimento: z.string().nullable(),
      total: z.number(),
      valor: z.number(),
    }),
  ),
});

export type ListarQuery = z.infer<typeof listarQuerySchema>;
export type CriarContaBody = z.infer<typeof criarContaBodySchema>;
export type CriarCartaoBody = z.infer<typeof criarCartaoBodySchema>;
export type CriarBaixaBody = z.infer<typeof criarBaixaBodySchema>;
export type ParcelasAPagarQuery = z.infer<typeof parcelasAPagarQuerySchema>;
export type SubstituirLancamentosBody = z.infer<typeof substituirLancamentosBodySchema>;
export type RedefinirParcelasBody = z.infer<typeof redefinirParcelasBodySchema>;
export type AtualizarContaBody = z.infer<typeof atualizarContaBodySchema>;
export type ParcelaParam = z.infer<typeof parcelaParamSchema>;
export type CancelarParcelaBody = z.infer<typeof cancelarParcelaBodySchema>;
export type TipoDocumentoQuery = z.infer<typeof tipoDocumentoQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;

export type CompraNoCartaoBody = z.infer<typeof compraNoCartaoBodySchema>;
export type LancamentoParam = z.infer<typeof lancamentoParamSchema>;
export type FaturasQuery = z.infer<typeof faturasQuerySchema>;
export type CartaoAtivoBody = z.infer<typeof cartaoAtivoBodySchema>;
