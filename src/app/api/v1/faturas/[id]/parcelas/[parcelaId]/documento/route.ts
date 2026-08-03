import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/faturas/faturas.controller";
import { parcelaParamSchema, tipoDocumentoQuerySchema } from "@/modules/faturas/faturas.schema";

/**
 * /api/v1/faturas/:id/parcelas/:parcelaId/documento?tipo=nfs|boleto
 *
 * Nota fiscal e boleto ficam na PARCELA: conta de três parcelas tem três
 * boletos, e muitas vezes três notas.
 *
 * POST recebe `multipart/form-data` com o campo `arquivo` — por isso a rota não
 * declara schema de body: o handler só lê JSON, e declarar um faria ele
 * consumir o stream antes do arquivo.
 */

export const POST = handler(
  { query: tipoDocumentoQuerySchema, params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.anexarDocumento,
);

export const DELETE = handler(
  { query: tipoDocumentoQuerySchema, params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.removerDocumento,
);

/** Redireciona para uma URL assinada, válida por uma hora. */
export const GET = handler(
  { query: tipoDocumentoQuerySchema, params: parcelaParamSchema, requerModulo: "financeiro" },
  controller.abrirDocumento,
);
