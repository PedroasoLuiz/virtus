import type { z } from "zod";
import type { Entrada } from "@/shared/http/handler";
import { ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/relatorios/relatorios.service";
import {
  relatorioSchema,
  type RelatorioQuery,
} from "@/modules/relatorios/relatorios.schema";

/** Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui. */
export async function parcelas({
  query,
  ctx,
}: Entrada<undefined, RelatorioQuery, undefined>) {
  const empresaId = empresaObrigatoria(ctx);

  const saida: z.input<typeof relatorioSchema> = await service.relatorio(
    empresaId,
    query.lado,
    query.de,
    query.ate,
    query.cartao,
  );

  return ok(relatorioSchema.parse(saida));
}
