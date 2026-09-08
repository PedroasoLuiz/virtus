import { z } from "zod";
import { serverClient } from "@/infra/supabase/client";
import { deReais } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import type { ProjecaoDeCaixa } from "@/modules/fluxo-caixa/fluxo-caixa.types";

/**
 * A projecao sai PRONTA do banco, pela funcao `projecao_de_caixa`.
 *
 * ⚠️ A conta mora no Postgres pela mesma razao da DRE: ela varre parcelas a
 * receber, a pagar e linhas de cartao para devolver uma linha por mes. Trazer os
 * registros crus para somar em TypeScript seria arrastar milhares de parcelas
 * pela rede a cada abertura da tela.
 *
 * ⚠️ Sem `security definer`, entao a RLS continua valendo: quem le e o usuario.
 * O `pfkempresa` nao e a protecao, e sim o recorte.
 *
 * ⚠️ Ela NAO e a `get_projecao_caixa_json` do legado, que continua no banco sem
 * ninguem chamar. Aquela filtrava por uma coluna de centro de custo que hoje e
 * nula na maioria das contas (escondia 40% da divida), somava parcela cancelada,
 * contava o cartao duas vezes — uma pela competencia do ciclo e outra pela conta
 * a pagar que o fechamento gera — e punha pagamento de data futura dentro do
 * saldo de hoje.
 */

/**
 * ⚠️ A resposta e `jsonb`, entao chega como `unknown` e e conferida aqui.
 *
 * Sem isso, uma mudanca na funcao apareceria na tela como `undefined` no meio de
 * uma coluna de dinheiro, e nao como erro.
 */
const respostaSchema = z.object({
  contas: z.array(
    z.object({
      conta_id: z.number(),
      apelido: z.string().nullable(),
      banco: z.string().nullable(),
      conta: z.string().nullable(),
      saldo: z.coerce.number(),
    }),
  ),
  saldototal: z.coerce.number(),
  meses: z.array(
    z.object({
      mes: z.string(),
      entrada: z.coerce.number(),
      saida: z.coerce.number(),
      saida_titulo: z.coerce.number(),
      saida_cartao: z.coerce.number(),
      resultado: z.coerce.number(),
      saldo: z.coerce.number(),
      vencido: z.boolean(),
    }),
  ),
});

export async function projecao(
  empresaId: number,
  ate: DataISO,
  contas: number[] | null,
  incluirVencidos: boolean,
): Promise<ProjecaoDeCaixa> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("projecao_de_caixa", {
    pdatafim: ate,
    pfkempresa: empresaId,
    /* Nulo e a lista vazia significam a mesma coisa no banco — "todas" —, e a
       tela manda vazio quando a pessoa desmarca tudo. */
    pcontas: contas,
    pincluirvencidos: incluirVencidos,
  });

  if (error) throw error;

  const bruto = respostaSchema.parse(data);

  return {
    ate,
    contasEscolhidas: contas,
    incluiVencidos: incluirVencidos,
    contas: bruto.contas.map((c) => ({
      id: c.conta_id,
      apelido: c.apelido,
      banco: c.banco,
      conta: c.conta,
      saldo: deReais(c.saldo),
    })),
    saldoHoje: deReais(bruto.saldototal),
    meses: bruto.meses.map((m) => ({
      mes: m.mes.slice(0, 10) as DataISO,
      entrada: deReais(m.entrada),
      saida: deReais(m.saida),
      saidaTitulo: deReais(m.saida_titulo),
      saidaCartao: deReais(m.saida_cartao),
      resultado: deReais(m.resultado),
      saldo: deReais(m.saldo),
      vencido: m.vencido,
    })),
  };
}
