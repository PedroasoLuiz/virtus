import { ZodError, type ZodType } from "zod";
import { AppError, UnauthorizedError, isAppError } from "@/shared/errors/app-error";
import { fail } from "@/shared/http/response";
import { novoRequestId } from "@/shared/utils/ids";
import { logger } from "@/shared/utils/logger";
import { CONTEXTO_ANONIMO, contextoAtual, type Contexto } from "@/shared/auth/contexto";
import type { Modulo } from "@/modules/plataforma/plataforma.types";

/**
 * Fronteira HTTP unica. Substitui, no App Router, o que seria a cadeia
 * `middleware -> controller -> errorHandler` de um Express.
 *
 * Responsabilidades, nesta ordem:
 *   1. gerar requestId
 *   2. autenticar (quando exigido) e resolver o tenant ativo
 *   3. validar body / query / params com Zod
 *   4. chamar o controller com dados ja limpos
 *   5. capturar qualquer erro e traduzir para o envelope padrao
 *
 * O controller recebe dados tipados e devolve uma Response. Nao existe
 * try/catch dentro de controller, service ou repository.
 */

export type RouteParams = Record<string, string | string[]>;

export type Entrada<B, Q, P> = {
  body: B;
  query: Q;
  params: P;
  ctx: Contexto;
  requestId: string;
  req: Request;
};

type Schemas<B, Q, P> = {
  body?: ZodType<B>;
  query?: ZodType<Q>;
  params?: ZodType<P>;
};

type Opcoes<B, Q, P> = Schemas<B, Q, P> & {
  /** Padrao true. Rotas publicas (health, webhook) declaram false. */
  auth?: boolean;
  /** Modulo que o plano da empresa precisa incluir. Ver modules/plataforma. */
  requerModulo?: Modulo;
};

/**
 * Contexto que o Next entrega: params sempre como string, antes de validar.
 * O tipo `P` do handler e o de SAIDA, ja convertido pelo schema — por isso os
 * dois nao podem ser o mesmo tipo.
 */
type NextCtx = { params: Promise<Record<string, string>> };

export function handler<B = undefined, Q = undefined, P = RouteParams>(
  opcoes: Opcoes<B, Q, P>,
  controller: (entrada: Entrada<B, Q, P>) => Promise<Response>,
) {
  return async function route(req: Request, nextCtx?: NextCtx): Promise<Response> {
    const requestId = novoRequestId();

    try {
      // Rota publica nao toca no Supabase: uma sonda de saude nao pode
      // depender do banco para responder.
      const ctx =
        opcoes.auth === false
          ? CONTEXTO_ANONIMO
          : await contextoAtual({ exigirSessao: true, requerModulo: opcoes.requerModulo });

      const body = opcoes.body ? opcoes.body.parse(await lerJson(req)) : (undefined as B);
      const query = opcoes.query
        ? opcoes.query.parse(objetoDaQuery(req))
        : (undefined as Q);
      const paramsBrutos = nextCtx ? await nextCtx.params : {};
      const params = (
        opcoes.params ? opcoes.params.parse(paramsBrutos) : paramsBrutos
      ) as P;

      return await controller({ body, query, params, ctx, requestId, req });
    } catch (err) {
      return tratarErro(err, requestId, req);
    }
  };
}

async function lerJson(req: Request): Promise<unknown> {
  const texto = await req.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new AppError("VALIDATION_ERROR", 400, "Corpo da requisicao nao e JSON valido");
  }
}

function objetoDaQuery(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams);
}

function tratarErro(err: unknown, requestId: string, req: Request): Response {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      campo: i.path.join("."),
      mensagem: i.message,
    }));
    return fail(422, "VALIDATION_ERROR", "Dados invalidos", requestId, details);
  }

  if (isAppError(err)) {
    // 5xx de dominio ainda merece log; 4xx e comportamento esperado.
    if (err.status >= 500) {
      logger.error("erro de dominio", { requestId, code: err.code, message: err.message });
    }
    return fail(err.status, err.code, err.message, requestId, err.details);
  }

  logger.error("erro inesperado", {
    requestId,
    rota: new URL(req.url).pathname,
    metodo: req.method,
    erro: err instanceof Error ? { nome: err.name, mensagem: err.message, stack: err.stack } : err,
  });

  // Stack nunca vaza para o cliente.
  return fail(500, "INTERNAL", "Erro interno", requestId);
}

export { UnauthorizedError };
