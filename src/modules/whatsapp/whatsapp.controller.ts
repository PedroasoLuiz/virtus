import { after } from "next/server";
import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import { ValidationError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import { usuarioLogado } from "@/modules/sessao/sessao.service";
import * as service from "@/modules/whatsapp/whatsapp.service";
import * as cloud from "@/modules/whatsapp/whatsapp.cloud";
import { triar } from "@/modules/atendimento/atendimento.service";
import {
  atendimentoSchema,
  clienteCandidatoSchema,
  contaSchema,
  conversaSchema,
  mensagemSchema,
  modeloSchema,
  type AtivarContaBody,
  type ContaIdQuery,
  type ConversaIdQuery,
  type EnviarModeloBody,
  type RemoverVinculoQuery,
  type SalvarContaBody,
  type SalvarVinculoBody,
  type TestarContaBody,
  type VinculosQuery,
  type VincularBody,
  type ConversaIdParam,
  type EnviarTextoBody,
  type ListarConversasQuery,
  type MidiaIdParam,
} from "@/modules/whatsapp/whatsapp.schema";

/** Traduz HTTP <-> servico. */

export async function listarContas({ ctx }: Entrada<undefined, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const contas = await service.listarContas(empresaId);

  return ok(contas.map((c) => contaSchema.parse(c)));
}

export async function salvarConta({ body, ctx }: Entrada<SalvarContaBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const conta = await service.salvarConta(empresaId, body);


  return created(contaSchema.parse(conta));
}

export async function testarConta({ body, ctx }: Entrada<TestarContaBody, undefined, unknown>) {
  empresaObrigatoria(ctx);

  return ok(await service.testarConta(body));
}

export async function listarVinculos({ query, ctx }: Entrada<undefined, VinculosQuery, unknown>) {
  empresaObrigatoria(ctx);

  return ok(await service.listarVinculos(query.contaId));
}

export async function salvarVinculo({ body, ctx }: Entrada<SalvarVinculoBody, undefined, unknown>) {
  const { contaId, ...escolha } = body;

  /*
   * Corpo, campos e o estado de validacao NAO vem da tela: quem os preenche e o
   * servico, com o que leu da Meta. Aceita-los do cliente deixaria qualquer um
   * gravar "validado" sem validacao nenhuma.
   */
  await service.salvarVinculo(empresaObrigatoria(ctx), contaId, {
    ...escolha,
    corpo: null,
    campos: 0,
    validadoEm: null,
    erro: null,
    erroEm: null,
  });

  return ok(await service.listarVinculos(contaId));
}

export async function removerVinculo({
  query,
  ctx,
}: Entrada<undefined, RemoverVinculoQuery, unknown>) {
  empresaObrigatoria(ctx);
  await service.removerVinculo(query.contaId, query.finalidade);

  return ok(await service.listarVinculos(query.contaId));
}

export async function ativarConta({
  body,
  params,
  ctx,
}: Entrada<AtivarContaBody, undefined, ConversaIdParam>) {
  empresaObrigatoria(ctx);
  await service.definirContaAtiva(params.id, body.ativo);

  return ok({ id: params.id, ativo: body.ativo });
}

export async function listarConversas({
  query,
  ctx,
}: Entrada<undefined, ListarConversasQuery, unknown>) {
  const empresaId = empresaObrigatoria(ctx);
  const conversas = await service.listarConversas(empresaId, query.contaId, query.busca);

  return ok(conversas.map((c) => conversaSchema.parse(c)));
}

export async function abrirConversa({
  params,
  ctx,
}: Entrada<undefined, undefined, ConversaIdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const { conversa, mensagens, atendimento } = await service.abrirConversa(empresaId, params.id);

  return ok({
    conversa: conversaSchema.parse(conversa),
    mensagens: mensagens.map((m) => mensagemSchema.parse(m)),
    atendimento: atendimento ? atendimentoSchema.parse(atendimento) : null,
  });
}

export async function detalhar({ params, ctx }: Entrada<undefined, undefined, ConversaIdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const { conversa, candidatos } = await service.detalharConversa(empresaId, params.id);

  return ok({
    conversa: conversaSchema.parse(conversa),
    candidatos: candidatos.map((c) => clienteCandidatoSchema.parse(c)),
  });
}

export async function vincular({
  body,
  params,
  ctx,
}: Entrada<VincularBody, undefined, ConversaIdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  const conversa = await service.vincularConversaACliente(
    empresaId,
    ctx.usuarioId,
    params.id,
    body.clienteId,
  );

  return ok(conversaSchema.parse(conversa));
}

export async function responder({
  body,
  params,
  ctx,
}: Entrada<EnviarTextoBody, undefined, ConversaIdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  // O nome do autor vem da sessao, nunca do corpo: quem assina a mensagem tem
  // de ser quem esta logado, e nao um nome que o cliente pode escolher.
  const usuario = await usuarioLogado();

  const mensagem = await service.responder(
    empresaId,
    ctx.usuarioId,
    usuario?.nome ?? null,
    params.id,
    body.texto,
  );

  return created(mensagemSchema.parse(mensagem));
}

export async function listarModelos({ query, ctx }: Entrada<undefined, ContaIdQuery, unknown>) {
  empresaObrigatoria(ctx);
  const modelos = await service.listarModelos(query.contaId);

  return ok(modelos.map((m) => modeloSchema.parse(m)));
}

export async function enviarModelo({
  body,
  params,
  ctx,
}: Entrada<EnviarModeloBody, undefined, ConversaIdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  const mensagem = await service.enviarModelo(
    empresaId,
    ctx.usuarioId,
    params.id,
    body.nome,
    body.parametros,
  );

  return created(mensagemSchema.parse(mensagem));
}

/**
 * Envio de anexo.
 *
 * Le `multipart/form-data` na mao, sem schema de `body`: o `handler` so sabe
 * JSON, e um arquivo de 16 MB nao passa por `JSON.parse` — viraria base64 com
 * um terco a mais de tamanho na memoria.
 */
export async function enviarAnexo({
  req,
  params,
  ctx,
}: Entrada<undefined, undefined, ConversaIdParam>) {
  const empresaId = empresaObrigatoria(ctx);
  const form = await req.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new ValidationError("Nenhum arquivo recebido");
  }

  const legenda = form.get("legenda");
  const usuario = await usuarioLogado();

  const mensagem = await service.enviarAnexo(
    empresaId,
    ctx.usuarioId,
    usuario?.nome ?? null,
    params.id,
    {
      conteudo: arquivo,
      nome: arquivo.name || "arquivo",
      // Navegador as vezes manda `type` vazio (arquivo sem extensao conhecida).
      // O octet-stream faz a Meta recusar com mensagem clara, em vez de a nossa
      // deteccao de tipo chutar "document" para um audio.
      mime: arquivo.type || "application/octet-stream",
    },
    typeof legenda === "string" && legenda.trim() ? legenda.trim() : null,
  );

  return created(mensagemSchema.parse(mensagem));
}

/**
 * Serve a midia recebida.
 *
 * Passa pelo servidor porque o download na Meta exige o Bearer, e o token nao
 * pode ir para o navegador. A rota exige sessao: sem isso, quem descobrisse um
 * id de midia leria anexo de conversa alheia.
 */
export async function obterMidia({
  req,
  params,
  query,
  ctx,
}: Entrada<undefined, ConversaIdQuery, MidiaIdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  // A conversa entra na URL porque a midia so pode ser baixada com o token da
  // conta que a recebeu — e e ela quem diz qual conta e.
  const { conteudo, mime } = await service.baixarMidia(empresaId, query.conversaId, params.id);

  const comum = {
    "Content-Type": mime,
    // Midia da Meta e imutavel e o id nunca se repete: cache longo, privado
    // porque o conteudo e de um tenant so.
    "Cache-Control": "private, max-age=86400",
    /*
     * ⚠️ Sem `Accept-Ranges`, o navegador trata o vídeo como fluxo contínuo: a
     * barra de progresso não aceita clique, não dá para voltar dez segundos, e
     * em alguns navegadores o `<video>` nem mostra a duração.
     */
    "Accept-Ranges": "bytes",
  };

  const total = conteudo.byteLength;
  const pedido = req.headers.get("range");
  const faixa = pedido ? /bytes=(\d*)-(\d*)/.exec(pedido) : null;

  if (!faixa) {
    return new Response(conteudo, {
      headers: { ...comum, "Content-Length": String(total) },
    });
  }

  /*
   * A faixa é servida do que já está na memória.
   *
   * O arquivo veio inteiro da Meta de qualquer forma: ela não aceita range no
   * download e o link dela vive cinco minutos. Recortar aqui não economiza
   * banda com o provedor, mas devolve ao navegador o 206 que ele precisa para
   * navegar dentro do vídeo.
   */
  const inicio = faixa[1] ? Number(faixa[1]) : 0;
  const fim = faixa[2] ? Math.min(Number(faixa[2]), total - 1) : total - 1;

  if (Number.isNaN(inicio) || inicio > fim || inicio >= total) {
    return new Response(null, {
      status: 416,
      headers: { ...comum, "Content-Range": `bytes */${total}` },
    });
  }

  return new Response(conteudo.slice(inicio, fim + 1), {
    status: 206,
    headers: {
      ...comum,
      "Content-Range": `bytes ${inicio}-${fim}/${total}`,
      "Content-Length": String(fim - inicio + 1),
    },
  });
}

// ── Webhook ─────────────────────────────────────────────────────

export async function verificarWebhook({ req }: Entrada<undefined, undefined, unknown>) {
  const url = new URL(req.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (!(await service.verificarWebhook(modo, token))) {
    logger.warn("verificacao de webhook recusada", { modo });
    return new Response("forbidden", { status: 403 });
  }

  // A Meta exige o challenge em texto puro. JSON aqui reprova o registro.
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function receberWebhook({ req }: Entrada<undefined, undefined, unknown>) {
  // Corpo CRU: reserializar reordena as chaves e invalida o HMAC.
  const corpoCru = await req.text();

  /*
   * Com varias contas, a chave que valida a assinatura depende de QUAL numero
   * recebeu — e isso so esta escrito dentro do corpo, que ainda nao foi
   * autenticado.
   *
   * A saida e usar o corpo apenas para ESCOLHER a chave, nunca para agir. Corpo
   * forjado aponta para uma conta qualquer, a assinatura nao bate com a chave
   * dela, e o evento e recusado — o atacante nao ganha nada por escolher.
   */
  const phoneNumberId = numeroDoPayload(corpoCru);

  if (!phoneNumberId) {
    logger.warn("webhook sem phone_number_id no corpo");
    return new Response(null, { status: 200 });
  }

  const appSecret = await service.appSecretDoNumero(phoneNumberId).catch(() => null);

  if (!cloud.assinaturaConfere(appSecret, corpoCru, req.headers.get("x-hub-signature-256"))) {
    logger.warn("webhook com assinatura invalida", { phoneNumberId });
    return new Response("forbidden", { status: 403 });
  }

  /*
   * A partir daqui a resposta e SEMPRE 200.
   *
   * Erro devolvido a Meta faz ela reentregar o mesmo lote por dias e, depois de
   * insistir demais, desassinar o webhook — as mensagens parariam de chegar por
   * completo. Falha de gravacao vira log, nao status HTTP.
   */
  try {
    const r = await service.registrarEvento(JSON.parse(corpoCru));

    // Loga SEMPRE, mesmo com zero gravadas. Um lote que nao produziu mensagem
    // e justamente o caso que precisa de explicacao: `campos` diz o que a Meta
    // mandou e `ignorados` diz de que numero veio.
    logger.info("whatsapp: lote recebido", {
      gravadas: r.gravadas,
      campos: r.campos,
      ...(r.ignorados.length > 0 ? { ignorados: r.ignorados } : {}),
    });

    /*
     * A triagem roda DEPOIS da resposta HTTP.
     *
     * `after()` e o que permite isso sem manter a Meta esperando: falar com o
     * provedor de IA e depois com a Cloud API leva segundos, e segurar o 200 por
     * esse tempo faria a Meta reentregar o lote — e, insistindo, desassinar o
     * webhook.
     *
     * `r.conversas` vem VAZIO na reentrega, porque nada foi gravado. E isso, e
     * nao um controle proprio, que impede o bot de responder duas vezes.
     */
    for (const conversaId of r.conversas) {
      after(() => triar(conversaId));
    }
  } catch (err) {
    logger.error("falha ao gravar evento do whatsapp", {
      erro: err instanceof Error ? err.message : err,
    });
  }

  return new Response(null, { status: 200 });
}

/**
 * Primeiro `phone_number_id` do lote, lido de um corpo ainda nao autenticado.
 *
 * Nao lanca: corpo invalido devolve `null` e o webhook responde 200 mesmo assim,
 * porque erro faz a Meta reentregar e, insistindo, desassinar.
 */
function numeroDoPayload(corpoCru: string): string | null {
  try {
    const payload = JSON.parse(corpoCru) as {
      entry?: { changes?: { value?: { metadata?: { phone_number_id?: string } } }[] }[];
    };

    for (const entrada of payload.entry ?? []) {
      for (const mudanca of entrada.changes ?? []) {
        const id = mudanca.value?.metadata?.phone_number_id;
        if (id) return id;
      }
    }
  } catch {
    /* corpo que nao e JSON nao tem numero para achar */
  }

  return null;
}
