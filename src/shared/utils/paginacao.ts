import { z } from "zod";
import type { Meta } from "@/shared/http/response";

/** Contrato de paginacao unico para toda a API. */

export const PAGE_SIZE_PADRAO = 25;
export const PAGE_SIZE_MAX = 100;

export const paginacaoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_PADRAO),
});

export type Paginacao = z.infer<typeof paginacaoSchema>;

/** Intervalo [de, ate] que o PostgREST espera em `.range()`. */
export function intervalo({ page, perPage }: Paginacao): [number, number] {
  const de = (page - 1) * perPage;
  return [de, de + perPage - 1];
}

export function metaDePaginacao(p: Paginacao, total: number): Meta {
  return {
    page: p.page,
    perPage: p.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / p.perPage)),
  };
}

export type Pagina<T> = { itens: T[]; total: number };
