import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";
import {
  parcelaParamSchema,
  tipoDocumentoQuerySchema,
} from "@/modules/contas-pagar/contas-pagar.schema";

/**
 * /api/v1/contas-pagar/:id/parcelas/:parcelaId/documento?tipo=nfs|boleto|comprovante
 *
 * Ficam na PARCELA e não na conta: uma conta de três parcelas tem três boletos e
 * três comprovantes. No cabeçalho, o segundo pagamento sobrescreveria a prova do
 * primeiro.
 *
 * POST recebe `multipart/form-data` no campo `arquivo` — por isso a rota não
 * declara schema de body: o handler só lê JSON, e declarar um faria ele consumir
 * o stream antes do arquivo.
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
