import type { z } from "zod";
import type { Entrada } from "@/shared/http/handler";
import { ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/dre/dre.service";
import { dreSchema, type DreQuery } from "@/modules/dre/dre.schema";

/** Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui. */
export async function dre({ query, ctx }: Entrada<undefined, DreQuery, undefined>) {
  const empresaId = empresaObrigatoria(ctx);

  /*
   * ⚠️ O tipo passa pela ENTRADA do schema antes do `parse`.
   *
   * `parse` recebe `unknown`, entao campo a mais ou a menos no schema nao e erro
   * de compilacao: aparece em producao como "Dados inválidos", sem dizer qual.
   * Amarrado ao `z.input`, vira erro do `tsc`.
   */
  const saida: z.input<typeof dreSchema> = await service.dre(empresaId, query.ano);

  return ok(dreSchema.parse(saida));
}
