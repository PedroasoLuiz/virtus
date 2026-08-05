import { serverEnv } from "@/infra/config/env";
import { logger } from "@/shared/utils/logger";
import { varrer } from "@/modules/atendimento/atendimento.service";

/**
 * /api/v1/atendimento/varredura — chamada pelo agendador, nunca pelo aplicativo.
 *
 * ⚠️ Nao usa o `handler` do projeto de proposito: ele exige sessao, e quem chama
 * aqui e o cron da hospedagem, que nao tem uma. A autorizacao e o mesmo segredo
 * do webhook, no `Authorization`, e sem ele a rota responde 401 sem olhar mais
 * nada. Rota aberta seria um botao de "mande mensagem para todo mundo".
 *
 * GET porque e o unico verbo que o cron da Vercel emite.
 */

// Nada aqui pode ser servido de cache: a resposta depende do relogio.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;
  const enviado = req.headers.get("authorization");

  if (!segredo || enviado !== `Bearer ${segredo}`) {
    logger.warn("varredura recusada: segredo invalido");
    return new Response("forbidden", { status: 401 });
  }

  const r = await varrer();

  return Response.json(r);
}
