import type { z } from "zod";
import type { Entrada } from "@/shared/http/handler";
import { ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/fluxo-caixa/fluxo-caixa.service";
import {
  projecaoSchema,
  type ProjecaoQuery,
} from "@/modules/fluxo-caixa/fluxo-caixa.schema";

/** Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui. */
export async function projecao({ query, ctx }: Entrada<undefined, ProjecaoQuery, undefined>) {
  const empresaId = empresaObrigatoria(ctx);

  /*
   * ⚠️ O tipo passa pela ENTRADA do schema antes do `parse`. Ver a mesma nota no
   * controller da DRE: amarrado ao `z.input`, um campo divergente vira erro do
   * `tsc` em vez de "Dados inválidos" em producao.
   */
  const saida: z.input<typeof projecaoSchema> = await service.projecao(
    empresaId,
    query.ate,
    query.contas,
    query.incluirVencidos,
  );

  return ok(projecaoSchema.parse(saida));
}
