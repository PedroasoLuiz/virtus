import { serverEnv } from "@/infra/config/env";
import { logger } from "@/shared/utils/logger";
import * as repo from "@/modules/atendimento/atendimento.repository";
import type { ContextoDoBot, Verificado } from "@/modules/atendimento/atendimento.types";
import { enviarEmail } from "@/shared/email/enviar";
import {
  corpoDoEmail,
  digitosDoDocumento,
  gerarCodigo,
  hashDoCodigo,
  pareceCodigo,
  pareceDocumento,
  textoDoSaldo,
} from "@/modules/atendimento/atendimento.identificacao";
import * as iaRepo from "@/modules/ia/ia.repository";
import * as ia from "@/modules/ia/ia.cloud";
import * as whatsapp from "@/modules/whatsapp/whatsapp.cloud";
import {
  ESQUEMA_DA_MENSAGEM,
  ESQUEMA_DA_TRIAGEM,
  conversaEmTexto,
  ehONumeroDeTeste,
  instrucao,
  instrucaoDeFechamento,
  motivoParaCalar,
  precisaDeHumano,
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
    if (await aindaEstaEscrevendo(conversaId)) return;
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

/*
 * Texto de reserva, usado so quando o provedor de IA nao responde.
 *
 * ⚠️ Nao e o caminho normal. Frase fixa se denuncia: chega identica para quem
 * parou no "oi" e para quem ja tinha descrito o problema inteiro. Existe aqui
 * porque calar de vez seria pior que uma frase generica.
 */
const RESERVA: Record<"lembrete" | "encerramento", string> = {
  lembrete: "Oi! Ainda posso ajudar com o que você precisa?",
  encerramento:
    "Vou encerrar este atendimento por aqui. Se precisar, é só chamar de novo que a gente retoma.",
};

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
        await fechar(segredo, p.conversaId, "lembrete");
        await repo.marcarLembrete(segredo, p.conversaId);
        contagem.lembrados += 1;
      } else {
        await fechar(segredo, p.conversaId, "encerramento");
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
 * Retoma ou encerra quem parou de responder.
 *
 * O texto e gerado olhando o assunto da conversa, e nao tirado de uma constante:
 * "ainda posso ajudar?" depois de a pessoa ter explicado o problema soa como se
 * ninguem tivesse lido nada. Retomar pelo nome do assunto e o que faz a mensagem
 * parecer de gente.
 */
async function fechar(
  segredo: string,
  conversaId: number,
  tipo: "lembrete" | "encerramento",
): Promise<void> {
  const cred = await repo.credenciaisDoWhatsapp(segredo, conversaId);

  if (!cred) {
    logger.warn("varredura: conversa sem token para responder", { conversaId });
    return;
  }

  const ctx = await repo.contexto(segredo, conversaId);
  if (!ctx) return;

  const texto = (await escrever(segredo, ctx, conversaId, tipo)) ?? RESERVA[tipo];

  const wamid = await whatsapp.enviarTexto(cred, ctx.telefone, texto);
  await repo.registrarSaidaDoBot(segredo, conversaId, wamid, texto);
}

/** Manda e grava, na ordem em que o resto do modulo ja faz. */
async function responderComo(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
  texto: string,
): Promise<void> {
  const cred = await repo.credenciaisDoWhatsapp(segredo, conversaId);

  if (!cred) {
    logger.warn("bot tinha o que dizer mas o numero nao tem token", { conversaId });
    return;
  }

  const wamid = await whatsapp.enviarTexto(cred, ctx.telefone, texto);
  await repo.registrarSaidaDoBot(segredo, conversaId, wamid, texto);
}

/**
 * Um passo da identificacao, e o texto que ele produz.
 *
 * ⚠️ As respostas de fracasso sao DELIBERADAMENTE iguais as de sucesso quando
 * o assunto e "esse documento existe?". Dizer "não achei esse CNPJ" transforma
 * o WhatsApp da empresa num verificador de carteira de clientes: qualquer um
 * testaria documentos ate descobrir quem e cliente de quem.
 */
async function passoDaIdentificacao(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
  triagem: Triagem,
  jaVerificado: Verificado | null,
): Promise<string | null> {
  if (triagem.acao === "PEDIR_DOCUMENTO") {
    return "Para eu poder falar da sua conta, preciso confirmar que é você. Me manda o CPF ou o CNPJ do cadastro, por favor.";
  }

  if (triagem.acao === "DOCUMENTO") {
    if (!pareceDocumento(triagem.documento)) {
      return "Esse número não parece um CPF nem um CNPJ. Pode conferir e mandar de novo?";
    }

    return await enviarCodigo(segredo, ctx, conversaId, triagem.documento);
  }

  if (triagem.acao === "CODIGO") {
    if (!pareceCodigo(triagem.codigo)) {
      return "O código tem 6 dígitos. Confere no e-mail e me manda de novo.";
    }

    const confere = await repo.conferirCodigo(
      segredo,
      conversaId,
      hashDoCodigo(conversaId, triagem.codigo),
    );

    if (!confere) {
      logger.info("codigo de identificacao recusado", { conversaId });
      return "Esse código não confere ou já expirou. Me manda o CPF ou CNPJ de novo que eu envio outro.";
    }

    logger.info("cliente identificado no whatsapp", { conversaId });

    // Emenda o saldo na confirmacao: a pessoa digitou o codigo justamente para
    // saber isso, e mandar "pronto, identificado" e depois esperar ela
    // perguntar de novo seria cobrar um passo a toa.
    return `Confirmado, obrigado. ${await textoDaConta(segredo, conversaId)}`;
  }

  if (triagem.acao === "SALDO") {
    if (!jaVerificado) {
      return "Para eu poder falar da sua conta, preciso confirmar que é você. Me manda o CPF ou o CNPJ do cadastro, por favor.";
    }

    return await textoDaConta(segredo, conversaId);
  }

  return null;
}

/**
 * Gera o codigo, manda no e-mail do cadastro e diz para onde foi.
 *
 * ⚠️ O codigo NUNCA vai para o log, nem para a resposta do WhatsApp. Ele existe
 * para provar acesso aquela caixa de e-mail; visivel em qualquer outro lugar,
 * nao prova nada.
 */
async function enviarCodigo(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
  documento: string,
): Promise<string> {
  const codigo = gerarCodigo();

  const aberta = await repo.abrirVerificacao(
    segredo,
    conversaId,
    digitosDoDocumento(documento),
    hashDoCodigo(conversaId, codigo),
  );

  /*
   * Sem cadastro, cadastro duplicado ou cadastro sem e-mail caem todos aqui, e
   * todos recebem a MESMA frase de quem teve sucesso. A diferenca aparece so
   * para quem tem acesso ao e-mail: o código chega, ou não chega.
   */
  const resposta =
    "Se houver um cadastro com esse documento, acabei de enviar um código de 6 dígitos para o e-mail cadastrado. Me manda o código aqui.";

  if (!aberta) {
    logger.info("identificacao sem cadastro utilizavel", { conversaId });
    return resposta;
  }

  try {
    const email = await repo.emailDoCliente(segredo, aberta.clienteId);

    if (email) {
      await enviarEmail({
        para: [email],
        assunto: `Seu código de acesso: ${codigo}`,
        html: corpoDoEmail(codigo, ctx.clienteNome ?? "a empresa"),
      });
    }
  } catch (err) {
    // Falha de e-mail nao muda a resposta: mudar entregaria, pelo texto, que
    // aquele documento tem cadastro.
    logger.error("falha ao enviar o codigo de identificacao", {
      conversaId,
      erro: err instanceof Error ? err.message : err,
    });
  }

  return resposta;
}

/** A situacao da conta em uma frase, ou o encaminhamento quando nao da. */
async function textoDaConta(segredo: string, conversaId: number): Promise<string> {
  const s = await repo.saldo(segredo, conversaId);

  if (!s) {
    return "Não consegui consultar sua conta agora. Vou passar para o financeiro dar retorno.";
  }

  return textoDoSaldo(s);
}

/**
 * Avisa que uma pessoa vai continuar dali em diante.
 *
 * Falha aqui nao desfaz a entrega: o atendimento ja esta marcado como esperando
 * gente, e e isso que faz a equipe agir. Ficar sem o aviso e ruim; reverter a
 * marcacao por causa dele seria pior.
 */
async function avisarQueVaiTerGente(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
): Promise<void> {
  const texto =
    "Prefiro não arriscar te dar uma resposta errada, então já estou passando sua mensagem para alguém da equipe continuar por aqui.";

  try {
    const cred = await repo.credenciaisDoWhatsapp(segredo, conversaId);
    if (!cred) return;

    const wamid = await whatsapp.enviarTexto(cred, ctx.telefone, texto);
    await repo.registrarSaidaDoBot(segredo, conversaId, wamid, texto);
  } catch (err) {
    logger.warn("nao consegui avisar que a conversa foi entregue", {
      conversaId,
      erro: err instanceof Error ? err.message : err,
    });
  }
}

/** A frase de retomada ou de despedida. `null` quando o provedor nao ajudou. */
async function escrever(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
  tipo: "lembrete" | "encerramento",
): Promise<string | null> {
  const credencialIA = await iaRepo.credencial(segredo, ctx.empresaId);
  if (!credencialIA) return null;

  const historico = await repo.mensagens(segredo, conversaId, 6);

  const r = await ia
    .responderEmJson<{ texto: string }>(
      credencialIA,
      instrucaoDeFechamento(ctx, tipo),
      conversaEmTexto(historico),
      ESQUEMA_DA_MENSAGEM,
    )
    .catch(() => null);

  return r?.texto?.trim() || null;
}

/** Quanto o bot espera a pessoa terminar de escrever antes de responder. */
const ESPERA_DE_DIGITACAO_MS = 7_000;

/**
 * A pessoa ainda esta escrevendo?
 *
 * ⚠️ Isto e o que impede o bot de responder no meio de uma frase. Ninguem manda
 * um paragrafo por WhatsApp: manda "oi", "bom dia", e so entao o assunto, em
 * tres mensagens com segundos de diferenca. Sem espera, o bot respondia ao "oi"
 * e triava a conversa inteira em cima de uma saudacao.
 *
 * Cada mensagem do webhook dispara uma triagem, entao a espera colapsa a rajada
 * sozinha: todas veem mensagem nova depois de acordar e desistem, menos a
 * ultima. Sem contador, sem estado compartilhado, sem relogio para comparar.
 */
async function aindaEstaEscrevendo(conversaId: number): Promise<boolean> {
  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;
  if (!segredo) return false;

  const antes = await ultimaEntrada(segredo, conversaId);
  await new Promise((r) => setTimeout(r, ESPERA_DE_DIGITACAO_MS));
  const depois = await ultimaEntrada(segredo, conversaId);

  if (antes === depois) return false;

  logger.info("bot esperou: chegou mensagem nova durante a espera", { conversaId });
  return true;
}

/** Carimbo da ultima mensagem recebida. `null` quando nao ha nenhuma. */
async function ultimaEntrada(segredo: string, conversaId: number): Promise<string | null> {
  const historico = await repo.mensagens(segredo, conversaId, 3);

  return (
    historico
      .filter((m) => m.direcao === "entrada")
      .map((m) => m.enviadaEm)
      .sort()
      .pop() ?? null
  );
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

  /*
   * Desistir e um ato, nao a ausencia de um.
   *
   * ⚠️ Vem ANTES de `motivoParaCalar` porque nao e um caso de silencio: a
   * conversa muda de estado, o cliente e avisado, e o pedido passa a aparecer
   * para a equipe como esperando gente. Antes o bot simplesmente parava, e
   * ninguem do lado de dentro ficava sabendo.
   */
  if (precisaDeHumano(ctx, modoTeste)) {
    await repo.pedirHumano(segredo, conversaId);
    await avisarQueVaiTerGente(segredo, ctx, conversaId);

    logger.info("bot entregou a conversa a uma pessoa", {
      conversaId,
      tentativas: ctx.tentativas,
    });
    return;
  }

  const calar = motivoParaCalar(ctx, temTexto, modoTeste);
  if (calar) {
    logger.info("bot nao respondeu", { conversaId, motivo: calar });
    return;
  }

  const setores = await repo.setores(segredo, ctx.empresaId);

  // Quem ja provou ser quem diz ser nesta conversa. Entra na instrucao para o
  // modelo nao pedir documento a quem acabou de se identificar.
  const jaVerificado = await repo.verificado(segredo, conversaId);

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
      instrucao(ctx, setores, jaVerificado),
      conversaEmTexto(historico),
      ESQUEMA_DA_TRIAGEM,
    );

    if (!triagem) return;

    /*
     * Consulta da propria conta segue por fora da triagem.
     *
     * ⚠️ Nao vira atendimento e nao encaminha nada: a pessoa nao pediu para
     * falar com ninguem, ela perguntou algo que o sistema sabe responder.
     * Gravar isso na fila encheria o financeiro de tarefas ja resolvidas.
     */
    if (triagem.acao && triagem.acao !== "NENHUMA") {
      const texto = await passoDaIdentificacao(segredo, ctx, conversaId, triagem, jaVerificado);
      if (texto) await responderComo(segredo, ctx, conversaId, texto);
      return;
    }

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
      /*
       * Assunto novo abre linha nova, e so quando ja havia um encaminhado. Fora
       * disso o campo e ruido: numa triagem em andamento toda mensagem parece
       * "assunto novo" para o modelo, e cada uma viraria um atendimento.
       */
      novo: triagem.assuntoNovo === true && ctx.atendimentoSituacao === "ENCAMINHADO",
    });

    const resposta = triagem.resposta?.trim();
    if (!resposta) return;

    await responderComo(segredo, ctx, conversaId, resposta);

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
