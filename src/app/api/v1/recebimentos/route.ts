import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/recebimentos/recebimentos.controller";
import {
  criarRecebimentoBodySchema,
  listarQuerySchema,
} from "@/modules/recebimentos/recebimentos.schema";

/**
 * /api/v1/recebimentos — o dinheiro que entrou.
 *
 * Não fica pendurado numa fatura de propósito: um pagamento pode cobrir parcelas
 * de várias contas, e uma rota `/faturas/:id/...` obrigaria a partir o PIX em
 * tantos lançamentos quantas fossem as contas. O extrato do banco mostra um só.
 */

export const GET = handler(
  { query: listarQuerySchema, requerModulo: "financeiro" },
  controller.listar,
);

export const POST = handler(
  { body: criarRecebimentoBodySchema, requerModulo: "financeiro" },
  controller.criar,
);
