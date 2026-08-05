import { serverEnv } from "@/infra/config/env";
import { logger } from "@/shared/utils/logger";
import * as repo from "@/modules/atendimento/atendimento.repository";
import * as iaRepo from "@/modules/ia/ia.repository";
import * as ia from "@/modules/ia/ia.cloud";
import * as whatsapp from "@/modules/whatsapp/whatsapp.cloud";
import {
  ESQUEMA_DA_TRIAGEM,
  conversaEmTexto,
  ehONumeroDeTeste,
  instrucao,
  motivoParaCalar,
  situacaoFinal,
  type Triagem,
} from "@/modules/atendimento/atendimento.triagem";

/**
 * O bot de triagem.
 *
 * ⚠️ TUDO aqui e best effort. Falhar em qualquer ponto NAO pode afetar o
 * recebimento da mensagem, que ja aconteceu e ja esta gravado antes de este
 * codigo rodar. Sem bot, a conversa espera uma pessoa — que era o comportamento
 * antes dele existir.
 *
 * Roda depois do 200 do webhook, via `after()`. Ver a rota.
 */

/**
 * Triagem de uma conversa que acabou de receber mensagem.
 *
 * Nunca lanca: o chamador e um efeito solto depois da resposta HTTP, e uma
 * excecao ali vira apenas ruido em log sem ninguem para tratar.
 */
export async function triar(conversaId: number): Promise<void> {
  try {
    await executar(conversaId);
  } catch (err) {
    logger.error("falha na triagem automatica", {
      conversaId,
      erro: err instanceof Error ? err.message : err,
    });
  }
}

/** Sem retorno do cliente, o atendimento nao fica em aberto para sempre. */
const MINUTOS_DE_SILENCIO = 20;

const LEMBRETE =
  "Oi! Ainda posso ajudar com o que você precisa? Se preferir, me diga em uma frase o que procura que eu encaminho para o setor certo.";

const ENCERRAMENTO =
  "Vou encerrar este atendimento por aqui. Se precisar, é só chamar de novo que a gente retoma na hora.";

/**
 * A varredura periodica.
 *
 * ⚠️ Existe porque o webhook e um gatilho de uma chance so. Se o bot estava
 * desligado, sem chave ou em modo de teste quando a mensagem chegou, aquela
 * pessoa ficava sem resposta para sempre: nada voltava a olhar para ela. Aqui a
 * conta e refeita do zero a cada passagem, sobre o estado atual.
 *
 * Nunca lanca por conversa: uma falhar nao pode impedir as outras de serem
 * atendidas, que e justamente o problema que esta rotina conserta.
 */
export async function varrer(): Promise<{ triados: number; lembrados: number; encerrados: number }> {
  const contagem = { triados: 0, lembrados: 0, encerrados: 0 };
  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;

  if (!segredo) {
    logger.warn("varredura nao rodou: WHATSAPP_WEBHOOK_SEGREDO ausente");
    return contagem;
  }

  const pendentes = await repo.pendencias(segredo, MINUTOS_DE_SILENCIO);

  for (const p of pendentes) {
    try {
      if (p.acao === "TRIAR") {
        await triar(p.conversaId);
        contagem.triados += 1;
      } else if (p.acao === "LEMBRAR") {
        await falarSemIA(segredo, p.conversaId, LEMBRETE);
        await repo.marcarLembrete(segredo, p.conversaId);
        contagem.lembrados += 1;
      } else {
        await falarSemIA(segredo, p.conversaId, ENCERRAMENTO);
        await repo.abandonar(segredo, p.conversaId);
        contagem.encerrados += 1;
      }
    } catch (err) {
      logger.error("falha na varredura de uma conversa", {
        conversaId: p.conversaId,
        acao: p.acao,
        erro: err instanceof Error ? err.message : err,
      });
    }
  }

  if (pendentes.length > 0) logger.info("varredura do atendimento", contagem);

  return contagem;
}

/**
 * Texto fixo, sem passar pelo provedor de IA.
 *
 * Lembrete e encerramento nao dependem do que a pessoa disse, entao gerar cada
 * um deles custaria uma chamada paga para produzir sempre a mesma frase.
 */
async function falarSemIA(segredo: string, conversaId: number, texto: string): Promise<void> {
  const cred = await repo.credenciaisDoWhatsapp(segredo, conversaId);

  if (!cred) {
    logger.warn("varredura: conversa sem token para responder", { conversaId });
    return;
  }

  const ctx = await repo.contexto(segredo, conversaId);
  if (!ctx) return;

  const wamid = await whatsapp.enviarTexto(cred, ctx.telefone, texto);
  await repo.registrarSaidaDoBot(segredo, conversaId, wamid, texto);
}

async function executar(conversaId: number): Promise<void> {
  /*
   * ⚠️ Toda saida daqui LOGA o motivo.
   *
   * As tres primeiras eram `return` mudo, e isso custou uma investigacao: o bot
   * nao respondia, nao havia erro em lugar nenhum, e nao dava para distinguir
   * "interruptor desligado" de "codigo nem rodou". Saida silenciosa em trabalho
   * assincrono e um buraco no escuro.
   */
  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;

  if (!segredo) {
    logger.warn("bot nao rodou: WHATSAPP_WEBHOOK_SEGREDO ausente", { conversaId });
    return;
  }

  const ctx = await repo.contexto(segredo, conversaId);

  if (!ctx) {
    logger.warn("bot nao rodou: conversa nao encontrada", { conversaId });
    return;
  }

  // A chave e o interruptor sao da EMPRESA. Sem os dois, nao ha bot.
  const credencialIA = await iaRepo.credencial(segredo, ctx.empresaId);

  if (!credencialIA) {
    logger.info("bot nao rodou: atendimento automatico desligado ou sem chave", {
      conversaId,
      empresaId: ctx.empresaId,
    });
    return;
  }

  /*
   * Modo de teste: o bot atende UM numero e mais ninguem.
   *
   * ⚠️ Esta e a trava que permite ligar o bot em producao sem risco. Enquanto
   * houver numero de teste, qualquer outra conversa e ignorada em silencio,
   * mesmo com chave valida e interruptor ligado.
   */
  const modoTeste = Boolean(credencialIA.numeroTeste);

  if (modoTeste && !ehONumeroDeTeste(ctx.telefone, credencialIA.numeroTeste!)) {
    logger.info("bot em modo de teste ignorou a conversa", { conversaId });
    return;
  }

  const historico = await repo.mensagens(segredo, conversaId);
  const temTexto = historico.some((m) => m.direcao === "entrada" && m.texto?.trim());

  const calar = motivoParaCalar(ctx, temTexto, modoTeste);
  if (calar) {
    logger.info("bot nao respondeu", { conversaId, motivo: calar });
    return;
  }

  const setores = await repo.setores(segredo, ctx.empresaId);

  /*
   * A partir daqui o painel mostra "a IA esta respondendo" e trava o campo de
   * escrita, para o atendente nao responder por cima.
   *
   * O `finally` nao e opcional: marca presa bloquearia a conversa por 45
   * segundos sem ninguem para destravar.
   */
  await repo.marcarRespondendo(segredo, conversaId, true).catch(() => {});

  try {
    const triagem = await ia.responderEmJson<Triagem>(
      credencialIA,
      instrucao(ctx, setores),
      conversaEmTexto(historico),
      ESQUEMA_DA_TRIAGEM,
    );

    if (!triagem) return;

    /*
     * Grava a triagem ANTES de responder.
     *
     * O contrario perderia o trabalho quando o envio falhasse: o cliente ficaria
     * sem resposta E sem ninguem sabendo que ele pediu algo. Gravado, o pedido
     * aparece na fila mesmo que a resposta nao saia.
     */
    const situacao = situacaoFinal(triagem);
    const setorId = triagem.setorId > 0 ? triagem.setorId : null;

    await repo.salvarAtendimento(segredo, conversaId, {
      intencao: triagem.intencao?.trim() || null,
      resumo: triagem.resumo?.trim() || null,
      confianca: Number.isFinite(triagem.confianca) ? triagem.confianca : null,
      setorId,
      situacao,
    });

    const resposta = triagem.resposta?.trim();
    if (!resposta) return;

    const cred = await repo.credenciaisDoWhatsapp(segredo, conversaId);
    if (!cred) {
      logger.warn("bot triou mas o numero nao tem token", { conversaId });
      return;
    }

    const wamid = await whatsapp.enviarTexto(cred, ctx.telefone, resposta);
    await repo.registrarSaidaDoBot(segredo, conversaId, wamid, resposta);

    logger.info("bot respondeu", {
      conversaId,
      situacao,
      setorId,
      confianca: triagem.confianca,
    });
  } finally {
    await repo.marcarRespondendo(segredo, conversaId, false).catch(() => {});
  }
}
