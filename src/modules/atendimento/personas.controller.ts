import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as repo from "@/modules/atendimento/personas.repository";
import * as service from "@/modules/atendimento/personas.service";
import {
  personaSchema,
  type PersonaParam,
  type SalvarPersonaBody,
  type SugestaoDePersonaBody,
} from "@/modules/atendimento/personas.schema";

/** Traduz HTTP <-> servico. */

export async function listar({ ctx }: Entrada<undefined, undefined, unknown>) {
  const personas = await service.listar(empresaObrigatoria(ctx));

  return ok(personas.map((p) => personaSchema.parse(p)));
}

export async function salvar({ body, ctx }: Entrada<SalvarPersonaBody, undefined, unknown>) {
  const persona = await service.salvar(empresaObrigatoria(ctx), ctx.usuarioId, body);

  return created(personaSchema.parse(persona));
}

export async function excluir({ params, ctx }: Entrada<undefined, undefined, PersonaParam>) {
  await service.excluir(empresaObrigatoria(ctx), params.id);

  return ok({ id: params.id });
}

export async function sugerir({ body, ctx }: Entrada<SugestaoDePersonaBody, undefined, unknown>) {
  const rascunho = await service.pedirSugestao(empresaObrigatoria(ctx), body.credencialId, {
    setorNome: body.setorNome,
    contexto: body.contexto,
  });

  return ok(rascunho);
}

export async function listarSetores({ ctx }: Entrada<undefined, undefined, unknown>) {
  return ok(await repo.listarSetores(empresaObrigatoria(ctx)));
}
