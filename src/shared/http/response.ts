import { NextResponse } from "next/server";

/**
 * Envelope de resposta. Todo endpoint da API usa estes helpers — o formato de
 * saida nao pode variar por modulo.
 *
 *   sucesso: { data, meta? }
 *   erro:    { error: { code, message, details?, requestId } }
 */

export type Meta = {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
  [k: string]: unknown;
};

export type SuccessBody<T> = { data: T; meta?: Meta };
export type ErrorBody = {
  error: { code: string; message: string; details?: unknown; requestId: string };
};

/**
 * ⚠️ `no-store` em TODA resposta da API, sem excecao.
 *
 * O que sai daqui e sempre de um usuario e de um tenant. Sem o cabecalho, o
 * navegador e a CDN guardam a resposta por conta propria: a lista de conversas
 * congelou numa mensagem de ontem, e o mesmo mecanismo que congela pode servir
 * a resposta de um usuario para outro numa cache compartilhada.
 *
 * Quem precisa de cache monta a resposta na mao, como a rota de midia, onde ele
 * e deliberado e privado.
 */
const SEM_CACHE = { "Cache-Control": "no-store, must-revalidate" };

export function ok<T>(data: T, meta?: Meta, status = 200) {
  const body: SuccessBody<T> = meta ? { data, meta } : { data };
  return NextResponse.json(body, { status, headers: SEM_CACHE });
}

export function created<T>(data: T) {
  return ok(data, undefined, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204, headers: SEM_CACHE });
}

export function fail(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
) {
  const body: ErrorBody = { error: { code, message, requestId, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status, headers: SEM_CACHE });
}
