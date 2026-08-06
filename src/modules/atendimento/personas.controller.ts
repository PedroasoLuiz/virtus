import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as repo from "@/modules/atendimento/personas.repository";
import {
  personaSchema,
  type PersonaParam,
  type SalvarPersonaBody,
} from "@/modules/atendimento/personas.schema";

/** Traduz HTTP <-> repositorio. Sem regra propria: persona e cadastro puro. */

export async function listar({ ctx }: Entrada<undefined, undefined, unknown>) {
  const personas = await repo.listar(empresaObrigatoria(ctx));

  return ok(personas.map((p) => personaSchema.parse(p)));
}

export async function salvar({ body, ctx }: Entrada<SalvarPersonaBody, undefined, unknown>) {
  const persona = await repo.salvar(empresaObrigatoria(ctx), ctx.usuarioId, body);

  return created(personaSchema.parse(persona));
}

export async function excluir({ params, ctx }: Entrada<undefined, undefined, PersonaParam>) {
  await repo.excluir(empresaObrigatoria(ctx), params.id);

  return ok({ id: params.id });
}

export async function listarSetores({ ctx }: Entrada<undefined, undefined, unknown>) {
  return ok(await repo.listarSetores(empresaObrigatoria(ctx)));
}
