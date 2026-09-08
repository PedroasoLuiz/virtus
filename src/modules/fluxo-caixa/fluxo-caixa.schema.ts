import { z } from "zod";
import { dataISOSchema } from "@/shared/validators/comuns";

/**
 * Ate quando projetar.
 *
 * ⚠️ O TETO de dois anos e do Pedro, e ele tem razao de existir aqui: a data vem
 * da URL, e sem limite `ate=2999-12-31` faz o Postgres montar doze mil linhas de
 * mes para devolver zeros. Alem disso, projecao a cinco anos de parcela que
 * ninguem cadastrou nao e previsao, e uma linha reta.
 *
 * ⚠️ O piso e HOJE porque o passado ja aparece sozinho: a serie comeca no menor
 * vencimento em aberto, que costuma ser anterior ao mes corrente. Pedir uma data
 * final no passado devolveria uma tabela que termina antes de comecar.
 */
export const projecaoQuerySchema = z.object({
  ate: dataISOSchema,
  /**
   * Quais contas entram no saldo de partida.
   *
   * ⚠️ Ausente = TODAS, e nao "nenhuma". A tela so manda a lista quando a pessoa
   * escolhe; mandando sempre, uma conta cadastrada depois ficaria de fora de
   * todo relatorio ate alguem lembrar de marca-la.
   *
   * ⚠️ Chega como texto separado por virgula porque e query string. `1,3` vira
   * `[1, 3]`; vazio vira indefinido.
   */
  contas: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((n) => Number(n.trim()))
            .filter((n) => Number.isInteger(n) && n > 0)
        : undefined,
    ),
  /**
   * ⚠️ O padrao e INCLUIR o vencido, que e o comportamento do legado e o que a
   * tela mostra. Sem ele, a projecao esconderia divida e credito reais por
   * omissao — e quem quer o cenario limpo pede.
   */
  incluirVencidos: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export type ProjecaoQuery = z.infer<typeof projecaoQuerySchema>;

const contaSchema = z.object({
  id: z.number().int(),
  apelido: z.string().nullable(),
  banco: z.string().nullable(),
  conta: z.string().nullable(),
  saldo: z.number().int(),
});

const mesSchema = z.object({
  mes: z.string(),
  entrada: z.number().int(),
  saida: z.number().int(),
  saidaTitulo: z.number().int(),
  saidaCartao: z.number().int(),
  resultado: z.number().int(),
  saldo: z.number().int(),
  vencido: z.boolean(),
});

/**
 * ⚠️ O contrato de SAIDA tambem e declarado, como na DRE.
 *
 * `parse` recebe `unknown`, entao campo a mais ou a menos nao e erro de
 * compilacao: aparece em producao como "Dados inválidos", sem dizer qual. O
 * controller passa o objeto por `z.input` antes, e a divergencia vira erro do
 * `tsc`.
 */
export const projecaoSchema = z.object({
  ate: z.string(),
  /* O que foi pedido volta junto: o PDF precisa dizer no papel sob que recorte
     aqueles numeros valem, senao duas emissoes iguais nao se distinguem. */
  contasEscolhidas: z.array(z.number().int()).nullable(),
  incluiVencidos: z.boolean(),
  contas: z.array(contaSchema),
  saldoHoje: z.number().int(),
  meses: z.array(mesSchema),
});
