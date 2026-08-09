import { z } from "zod";
import { centavosSchema, dataISOSchema, idSchema } from "@/shared/validators/comuns";

/**
 * Contratos de entrada e saida da conciliacao.
 *
 * Validado aqui, na borda. Service e repository confiam no que recebem.
 */

export const contaParamSchema = z.object({ id: idSchema });

export const periodoQuerySchema = z.object({ de: dataISOSchema, ate: dataISOSchema });

/**
 * As linhas lidas do arquivo.
 *
 * ⚠️ O NAVEGADOR faz a leitura do OFX, e nao o servidor: o arquivo esta na
 * maquina de quem importa, e subir o binario para o servidor so para ele
 * devolver as mesmas linhas seria uma volta inteira sem ganho. O que o servidor
 * nao delega e o que importa — a chave de deduplicacao, o vinculo e a conferencia
 * de que o lancamento e daquela conta.
 *
 * ⚠️ `valor` vem COM SINAL: negativo saiu da conta. Por isso `centavosSchema`
 * nao serve aqui, ele recusa negativo.
 */
const linhaSchema = z.object({
  data: dataISOSchema,
  valor: z.number().int("Valor deve ser inteiro em centavos"),
  nome: z.string().trim().max(300),
  tipo: z.string().trim().max(40),
});

export const importarBodySchema = z.object({
  // Teto para um arquivo nao virar uma insercao sem fim: um extrato mensal de
  // conta movimentada passa longe disso.
  linhas: z.array(linhaSchema).min(1).max(5000),
});

export const conciliarBodySchema = z.object({
  linhaId: idSchema,
  pagamentoId: idSchema,
});

export const desfazerBodySchema = z.object({ linhaId: idSchema });

/** Os pares que a pessoa conferiu na tela e mandou de uma vez. */
export const loteBodySchema = z.object({
  pares: z.array(z.object({ linhaId: idSchema, pagamentoId: idSchema })).min(1).max(500),
});

export type PeriodoQuery = z.infer<typeof periodoQuerySchema>;
export type ImportarBody = z.infer<typeof importarBodySchema>;
export type ConciliarBody = z.infer<typeof conciliarBodySchema>;
export type DesfazerBody = z.infer<typeof desfazerBodySchema>;
export type LoteBody = z.infer<typeof loteBodySchema>;
export type ContaParam = z.infer<typeof contaParamSchema>;

export { centavosSchema };
