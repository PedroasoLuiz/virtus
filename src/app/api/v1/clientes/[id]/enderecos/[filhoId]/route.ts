import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { filhoIdParamSchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/{id}/enderecos/{filhoId}
 *
 * ⚠️ Aqui o DELETE apaga de verdade, diferente de contato e conta bancaria.
 * Endereco nao aparece em documento passado: a nota guarda o endereco que foi
 * impresso nela, e nao um ponteiro para este cadastro.
 *
 * O PATCH promove a principal. Sem corpo: e a unica coisa que ele faz.
 */

export const PATCH = handler(
  { params: filhoIdParamSchema, requerModulo: "financeiro" },
  controller.enderecoPrincipal,
);

export const DELETE = handler(
  { params: filhoIdParamSchema, requerModulo: "financeiro" },
  controller.excluirEndereco,
);
