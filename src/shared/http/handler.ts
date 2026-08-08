import { ZodError, type ZodType } from "zod";
import { AppError, ConflictError, UnauthorizedError, isAppError } from "@/shared/errors/app-error";
import { concluir, liberar, reservar } from "@/shared/http/idempotencia";
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
  /**
   * A rota grava dinheiro e aceita `Idempotency-Key`.
   *
   * ⚠️ Vale para escrita FINANCEIRA, e nao para todo POST. O preco da protecao
   * e uma linha gravada por pedido; cobrar isso de um cadastro de contato, que
   * no pior caso vira uma linha repetida que se apaga, seria caro a toa.
   */
  idempotente?: boolean;
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

      const entrada = { body, query, params, ctx, requestId, req };

      /*
       * ⚠️ A chave e OPCIONAL, e a rota funciona sem ela.
       *
       * Exigir o cabecalho quebraria todo consumidor que ja chama a API, e a
       * protecao que ela da e do lado de quem chama: e o cliente que sabe que
       * dois pedidos sao a mesma intencao. Sem chave, o comportamento e o de
       * sempre.
       */
      const chave = opcoes.idempotente ? req.headers.get("Idempotency-Key")?.trim() : null;

      if (!chave || ctx.empresaId == null) return await controller(entrada);

      return await comIdempotencia(chave, ctx.empresaId, req, body, () => controller(entrada));
    } catch (err) {
      return tratarErro(err, requestId, req);
    }
  };
}

/**
 * Roda a rota uma vez por chave, e devolve a mesma resposta no reenvio.
 *
 * ⚠️ A resposta e LIDA para ser guardada, e por isso o clone. `Response` traz
 * um corpo de leitura unica: consumindo o original, o que chegaria ao navegador
 * seria um corpo ja esvaziado.
 */
async function comIdempotencia(
  chave: string,
  empresaId: number,
  req: Request,
  body: unknown,
  executar: () => Promise<Response>,
): Promise<Response> {
  const rota = new URL(req.url).pathname;
  const reserva = await reservar(empresaId, chave, rota, body);

  if (reserva.tipo === "repetido") {
    return new Response(JSON.stringify(reserva.corpo), {
      status: reserva.http,
      headers: { "Content-Type": "application/json", "Idempotency-Replayed": "true" },
    });
  }

  if (reserva.tipo === "em_andamento") {
    throw new ConflictError(
      "Este mesmo envio ainda está sendo processado. Aguarde antes de tentar de novo.",
    );
  }

  let resposta: Response;
  try {
    resposta = await executar();
  } catch (err) {
    // Falhou antes de responder: a chave sai do caminho para o proximo envio.
    await liberar(reserva.id);
    throw err;
  }

  /*
   * ⚠️ So o SUCESSO e guardado.
   *
   * Uma recusa de regra de negocio e um pedido que nao gravou nada, e guardar
   * significaria devolver o mesmo "nao" para sempre — inclusive depois de a
   * pessoa corrigir o valor e reenviar com a mesma chave.
   */
  if (resposta.status >= 400) {
    await liberar(reserva.id);
    return resposta;
  }

  const copia = resposta.clone();
  await concluir(reserva.id, resposta.status, await copia.json().catch(() => null));

  return resposta;
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

  /*
   * Stack nunca vaza para o cliente, mas o CODIGO vai junto.
   *
   * ⚠️ "Erro interno" sozinho nao serve para ninguem: quem le nao sabe o que
   * fazer, e quem vai investigar nao tem por onde comecar. O requestId ja
   * estava no envelope e ninguem mostrava; na frase, ele vira a unica coisa
   * que liga o que a pessoa viu ao que ficou no log.
   */
  return fail(
    500,
    "INTERNAL",
    `Algo falhou do nosso lado. Se continuar, informe o código ${requestId}.`,
    requestId,
  );
}

export { UnauthorizedError };
