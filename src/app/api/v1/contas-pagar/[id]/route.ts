import { handler } from "@/shared/http/handler";
import { z } from "zod";
import { ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { idSchema } from "@/shared/validators/comuns";
import { obterConta } from "@/modules/contas-pagar/contas-pagar.service";

/** /api/v1/contas-pagar/:id */

const idParamSchema = z.object({ id: idSchema });

export const GET = handler(
  { params: idParamSchema, requerModulo: "financeiro" },
  async ({ params, ctx }) => ok(await obterConta(empresaObrigatoria(ctx), params.id)),
);
