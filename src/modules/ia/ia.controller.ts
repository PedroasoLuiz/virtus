import type { Entrada } from "@/shared/http/handler";
import { ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/ia/ia.service";
import { configIASchema, type SalvarConfigIABody } from "@/modules/ia/ia.schema";

/** Traduz HTTP <-> servico. */

export async function obter({ ctx }: Entrada<undefined, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const config = await service.obterConfig(empresaId);

  return ok(configIASchema.parse(config));
}

export async function salvar({ body, ctx }: Entrada<SalvarConfigIABody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const config = await service.salvarConfig(empresaId, body);

  return ok(configIASchema.parse(config));
}
