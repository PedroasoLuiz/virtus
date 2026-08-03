import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/plataforma/plataforma.controller";

/**
 * /api/v1/planos — catalogo de planos.
 *
 * Nao exige modulo: e justamente como a empresa descobre o que cada plano
 * libera antes de assinar.
 */
export const GET = handler({}, controller.listarPlanos);
