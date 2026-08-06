import type { Entrada } from "@/shared/http/handler";
import { ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/ia/ia.service";
import {
  configIASchema,
  type ProvedorParam,
  type SalvarNumeroTesteBody,
  type SalvarProvedorBody,
  type TestarProvedorBody,
} from "@/modules/ia/ia.schema";

/** Traduz HTTP <-> servico. */

export async function listar({ ctx }: Entrada<undefined, undefined, unknown>) {
  const provedores = await service.listarProvedores(empresaObrigatoria(ctx));

  return ok(provedores.map((p) => configIASchema.parse(p)));
}

export async function salvar({ body, ctx }: Entrada<SalvarProvedorBody, undefined, unknown>) {
  const provedores = await service.salvarProvedor(empresaObrigatoria(ctx), body);

  return ok(provedores.map((p) => configIASchema.parse(p)));
}

export async function salvarNumeroTeste({
  body,
  ctx,
}: Entrada<SalvarNumeroTesteBody, undefined, unknown>) {
  const provedores = await service.salvarNumeroTeste(
    empresaObrigatoria(ctx),
    body.numeroTeste,
  );

  return ok(provedores.map((p) => configIASchema.parse(p)));
}

export async function testar({ body, ctx }: Entrada<TestarProvedorBody, undefined, unknown>) {
  const resultado = await service.testarProvedor(empresaObrigatoria(ctx), body);

  return ok(resultado);
}

export async function remover({ params, ctx }: Entrada<undefined, undefined, ProvedorParam>) {
  const provedores = await service.removerProvedor(empresaObrigatoria(ctx), params.id);

  return ok(provedores.map((p) => configIASchema.parse(p)));
}
