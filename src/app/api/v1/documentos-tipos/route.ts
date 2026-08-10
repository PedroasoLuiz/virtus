import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/contas-pagar/contas-pagar.controller";

/**
 * /api/v1/documentos-tipos — as especies de documento.
 *
 * Fora de `/contas-pagar` de proposito: a especie do documento nao pertence a
 * conta a pagar. Nota fiscal, contrato e recibo aparecem tambem do lado que
 * recebe, e uma rota aninhada obrigaria as faturas a pedir a lista por um
 * endereco que fala de despesa.
 */

export const GET = handler({ requerModulo: "financeiro" }, controller.listarTiposDeDocumento);
