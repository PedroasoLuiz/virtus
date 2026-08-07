import { serverEnv } from "@/infra/config/env";
import { logger } from "@/shared/utils/logger";
import * as repo from "@/modules/atendimento/atendimento.repository";
import type {
  ContextoDoBot,
  MensagemDoBot,
  PersonaDoBot,
  Verificado,
} from "@/modules/atendimento/atendimento.types";
import { enviarEmail } from "@/shared/email/enviar";
import {
  corpoDoEmail,
  digitosDoDocumento,
  gerarCodigo,
  hashDoCodigo,
  pareceCodigo,
  pareceDocumento,
  textoDoSaldo,
  textoDosTitulos,
} from "@/modules/atendimento/atendimento.identificacao";
import * as iaRepo from "@/modules/ia/ia.repository";
import * as ia from "@/modules/ia/ia.cloud";
import * as whatsapp from "@/modules/whatsapp/whatsapp.cloud";
import { comAssinaturaDoAutor } from "@/modules/whatsapp/whatsapp.service";
import {
  ESQUEMA_DA_MENSAGEM,
  ESQUEMA_DA_TRIAGEM,
  conversaEmTexto,
  ehONumeroDeTeste,
  atalhoDeIdentificacao,
  instrucao,
  instrucaoDeFechamento,
  motivoParaCalar,
  precisaDeHumano,
  situacaoFinal,
  type AcaoDaTriagem,
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

/** Quantas imagens da conversa vao junto do texto para o modelo. */
const MAXIMO_DE_IMAGENS = 2;

/** Acima disto a imagem nao sobe: base64 infla um terco e o limite e do provedor. */
const IMAGEM_MAXIMA_BYTES = 4 * 1024 * 1024;

/**
 * As ultimas imagens que o cliente mandou, prontas para o modelo ler.
 *
 * ⚠️ Print de tela e como cliente explica problema no WhatsApp. Sem isto o bot
 * lia "[image]" e perguntava o que a pessoa quis dizer, com a resposta parada
 * na tela dela.
 *
 * Nunca lanca: imagem que nao baixa vira triagem so com o texto, que e o
 * comportamento de antes. Midia recebida vive 7 dias na Meta, entao conversa
 * antiga simplesmente nao tem mais o que baixar.
 */
async function imagensRecentes(
  segredo: string,
  conversaId: number,
  historico: MensagemDoBot[],
): Promise<ia.ImagemParaOModelo[]> {
  const candidatas = historico
    .filter((m) => m.direcao === "entrada" && m.tipo === "image" && m.midiaId)
    .slice(-MAXIMO_DE_IMAGENS);

  if (candidatas.length === 0) return [];

  try {
    const cred = await repo.credenciaisDoWhatsapp(segredo, conversaId);
    if (!cred) return [];

    const baixadas = await Promise.all(
      candidatas.map(async (m) => {
        const { conteudo, mime } = await whatsapp.baixarMidia(cred, m.midiaId!);
        return conteudo.byteLength > IMAGEM_MAXIMA_BYTES ? null : { conteudo, mime };
      }),
    );

    return baixadas.filter((i): i is ia.ImagemParaOModelo => i !== null);
  } catch (err) {
    logger.warn("nao consegui ler as imagens da conversa", {
      conversaId,
      erro: err instanceof Error ? err.message : err,
    });
    return [];
  }
}

/** Manda e grava, na ordem em que o resto do modulo ja faz. */
/**
 * Manda o que o bot tem a dizer, assinado.
 *
 * ⚠️ A assinatura e a MESMA dos atendentes: `*Nome:*` na primeira linha. Quem
 * le a conversa ve "*Financeiro:*" do mesmo jeito que veria "*Pedro Luiz:*", e
 * nao precisa descobrir se estava falando com gente ou com o sistema — a
 * diferenca de tratamento vem do que foi dito, nao de um aviso.
 *
 * Sem persona a mensagem sai sem assinatura, como sempre saiu: inventar um nome
 * seria dar identidade a algo que a empresa nao configurou.
 */
async function responderComo(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
  texto: string,
  persona?: PersonaDoBot | null,
): Promise<void> {
  const cred = await repo.credenciaisDoWhatsapp(segredo, conversaId);

  if (!cred) {
    logger.warn("bot tinha o que dizer mas o numero nao tem token", { conversaId });
    return;
  }

  const corpo = comAssinaturaDoAutor(persona?.nome ?? null, texto);

  const wamid = await whatsapp.enviarTexto(cred, ctx.telefone, corpo);
  await repo.registrarSaidaDoBot(segredo, conversaId, wamid, corpo);
}

/**
 * Qual persona fala agora.
 *
 * ⚠️ A do SETOR vence a geral. A geral existe para o comeco da conversa, antes
 * de se saber o assunto; assim que o setor aparece, quem manda e a persona dele
 * — com o jeito e as permissoes dela. Era isso que a instrucao ja pedia ao
 * modelo, e agora o codigo confere.
 */
function personaDaVez(personas: PersonaDoBot[], setorId: number | null): PersonaDoBot | null {
  if (setorId) {
    const doSetor = personas.find((p) => p.setorId === setorId);
    if (doSetor) return doSetor;
  }

  return personas.find((p) => p.setorId == null) ?? null;
}

/** A permissao que cada consulta exige. Ver `atendimento/permissoes.ts`. */
const PERMISSAO_DA_ACAO: Partial<Record<AcaoDaTriagem, string>> = {
  SALDO: "saldo",
  TITULOS: "titulos",
};

/**
 * Esta persona pode fazer esta consulta?
 *
 * ⚠️ Sem persona nenhuma cadastrada, o comportamento e o de antes: a consulta
 * acontece. Barrar ali desligaria a identificacao em toda empresa que ainda nao
 * criou persona, que e a maioria — a permissao existe para RESTRINGIR quem
 * configurou, e nao para exigir configuracao de quem nao pediu nada.
 */
function podeConsultar(persona: PersonaDoBot | null, acao: AcaoDaTriagem): boolean {
  const exigida = PERMISSAO_DA_ACAO[acao];

  if (!exigida || !persona) return true;

  return persona.permissoes.includes(exigida);
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
    return "Certo! Antes de falar de valores eu preciso ter certeza de que é você. Me confirma o CPF ou o CNPJ do cadastro?";
  }

  if (triagem.acao === "DOCUMENTO") {
    if (!pareceDocumento(triagem.documento)) {
      return "Acho que veio faltando algum dígito aí. Dá uma conferida e manda de novo pra mim?";
    }

    return await acharCadastro(segredo, conversaId, triagem.documento);
  }

  if (triagem.acao === "CONFIRMA_EMAIL") {
    return await mandarCodigo(segredo, ctx, conversaId);
  }

  if (triagem.acao === "NEGA_EMAIL") {
    await repo.cancelarVerificacao(segredo, conversaId);
    return "Entendi. Nesse caso eu não consigo confirmar por aqui, então vou passar pro financeiro te atender direto.";
  }

  if (triagem.acao === "CODIGO") {
    if (!pareceCodigo(triagem.codigo)) {
      return "O código tem 6 dígitos. Dá uma olhada no e-mail e me manda?";
    }

    return await conferirEResponder(segredo, conversaId, triagem.codigo);
  }

  if (triagem.acao === "TITULOS") {
    if (!jaVerificado) {
      return "Certo! Antes de falar de valores eu preciso ter certeza de que é você. Me confirma o CPF ou o CNPJ do cadastro?";
    }

    return textoDosTitulos(await repo.titulos(segredo, conversaId));
  }

  if (triagem.acao === "SALDO") {
    if (!jaVerificado) {
      return "Para eu poder falar da sua conta, preciso confirmar que é você. Me manda o CPF ou o CNPJ do cadastro, por favor.";
    }

    return await textoDaConta(segredo, conversaId);
  }

  return null;
}

/** O que fazer em cada passo que o texto da conversa ja define sozinho. */
async function passoDeterministico(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
  atalho: { acao: "DOCUMENTO" | "CODIGO" | "CONFIRMA" | "NEGA"; valor: string },
): Promise<string> {
  if (atalho.acao === "CODIGO") {
    return await conferirEResponder(segredo, conversaId, atalho.valor);
  }

  if (atalho.acao === "DOCUMENTO") {
    return await acharCadastro(segredo, conversaId, atalho.valor);
  }

  if (atalho.acao === "CONFIRMA") {
    return await mandarCodigo(segredo, ctx, conversaId);
  }

  /*
   * Ela nao abre aquela caixa, e nao ha segundo caminho automatico.
   *
   * ⚠️ Trocar o e-mail de destino aqui destruiria a unica prova que existe: o
   * codigo so vale porque vai para um endereco que estava no cadastro ANTES da
   * conversa. Aceitar outro seria deixar quem pediu escolher onde receber a
   * propria autorizacao.
   */
  await repo.cancelarVerificacao(segredo, conversaId);
  return "Entendi. Nesse caso eu não consigo confirmar por aqui, então vou passar pro financeiro te atender direto.";
}

/**
 * Acha o cadastro pelo documento e pergunta antes de mandar o codigo.
 *
 * ⚠️ O cadastro de empresa costuma apontar para uma caixa que quem esta no
 * WhatsApp nao abre: financeiro@, contato@, o e-mail do socio. Mandar direto
 * deixava a pessoa esperando um codigo que chegou para outra.
 */
async function acharCadastro(
  segredo: string,
  conversaId: number,
  documento: string,
): Promise<string> {
  const aberta = await repo.abrirVerificacao(segredo, conversaId, digitosDoDocumento(documento));

  if (!aberta) {
    logger.info("identificacao sem cadastro utilizavel", { conversaId });
    return "Não localizei um cadastro com esse documento aqui, ou ele está sem e-mail. Vou chamar o financeiro pra te ajudar por outro caminho.";
  }

  return `Achei aqui. Você tem acesso ao e-mail ${aberta.emailMascarado}? Se tiver, eu mando um código pra lá agora.`;
}

/** Gera o codigo, manda no e-mail do cadastro e avisa que saiu. */
async function mandarCodigo(
  segredo: string,
  ctx: ContextoDoBot,
  conversaId: number,
): Promise<string> {
  const codigo = gerarCodigo();
  const clienteId = await repo.confirmarEmail(segredo, conversaId, hashDoCodigo(conversaId, codigo));

  if (!clienteId) {
    return "A tentativa anterior expirou. Me manda o CPF ou CNPJ de novo que a gente recomeça.";
  }

  try {
    const email = await repo.emailDoCliente(segredo, clienteId);

    if (email) {
      await enviarEmail({
        para: [email],
        assunto: `Seu código de acesso: ${codigo}`,
        html: corpoDoEmail(codigo, ctx.clienteNome ?? "a empresa"),
      });
    }
  } catch (err) {
    logger.error("falha ao enviar o codigo de identificacao", {
      conversaId,
      erro: err instanceof Error ? err.message : err,
    });

    // Aqui a falha PODE ser dita: a pessoa ja sabe que o cadastro existe, entao
    // esconder o erro so a deixaria esperando um codigo que nunca vai chegar.
    return "Tive um problema pra enviar o código agora. Vou passar pro financeiro te atender direto.";
  }

  return "Pronto, o código de 6 dígitos acabou de sair. Me passa ele aqui quando chegar.";
}

/** Confere o codigo e, dando certo, ja emenda a situacao da conta. */
async function conferirEResponder(
  segredo: string,
  conversaId: number,
  codigo: string,
): Promise<string> {
  const confere = await repo.conferirCodigo(
    segredo,
    conversaId,
    hashDoCodigo(conversaId, codigo),
  );

  if (!confere) {
    logger.info("codigo de identificacao recusado", { conversaId });
    return "Esse não bateu, ou já passou do tempo. Me manda o documento de novo que eu disparo outro código.";
  }

  logger.info("cliente identificado no whatsapp", { conversaId });

  // Emenda o saldo na confirmacao: a pessoa digitou o codigo justamente para
  // saber isso, e mandar "pronto, identificado" e depois esperar ela perguntar
  // de novo seria cobrar um passo a toa.
  return `Confirmado, obrigado! ${await textoDaConta(segredo, conversaId)}`;
}

/** A situacao da conta em uma frase, ou o encaminhamento quando nao da. */
async function textoDaConta(segredo: string, conversaId: number): Promise<string> {
  const s = await repo.saldo(segredo, conversaId);

  if (!s) {
    return "Não consegui puxar sua conta agora. Vou passar pro financeiro te dar retorno.";
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
    "Prefiro não te dar uma resposta errada, então já chamei alguém da equipe pra continuar com você por aqui.";

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
  const credenciaisIA = await iaRepo.credenciaisDaConversa(segredo, conversaId);
  if (credenciaisIA.length === 0) return null;

  const historico = await repo.mensagens(segredo, conversaId, 6);

  const r = await ia
    .responderComReserva<{ texto: string }>(
      credenciaisIA,
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

  /*
   * ⚠️ SO UMA invocacao espera pela rajada inteira.
   *
   * Antes, cada mensagem recebida dormia os 7 segundos por conta propria: cinco
   * mensagens seguidas eram cinco funcoes serverless de pe ao mesmo tempo, 35
   * segundos pagos para produzir uma resposta so. A reserva vive no banco, onde
   * o proprio `update` serializa a disputa.
   */
  const minha = await repo.reservarEspera(
    segredo,
    conversaId,
    Math.ceil(ESPERA_DE_DIGITACAO_MS / 1000) + 5,
  );

  if (!minha) {
    logger.info("bot ja tem alguem esperando esta rajada", { conversaId });
    return true;
  }

  await new Promise((r) => setTimeout(r, ESPERA_DE_DIGITACAO_MS));

  /*
   * Libera ANTES de triar, e nao depois: a triagem chama o provedor de IA e
   * pode demorar. Presa ate o fim, a reserva bloquearia a mensagem seguinte da
   * pessoa, que e justamente quando ela corrige o que acabou de escrever.
   */
  await repo.liberarEspera(segredo, conversaId).catch(() => {});

  return false;
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

  /*
   * O numero decide ANTES da empresa.
   *
   * ⚠️ Sem IA ligada neste numero, nem se consulta credencial: a empresa pode
   * ter chave paga e uma linha que atende so a mao, e perguntar ao provedor
   * seria gastar por uma resposta que nunca sairia.
   */
  if (!ctx.contaBotAtivo) {
    logger.info("bot desligado neste numero", { conversaId });
    return;
  }

  /*
   * A chave e do NUMERO, e nao da empresa: e assim que o gasto de cada setor
   * sai separado. Vem uma, ou nenhuma — numero sem chave escolhida nao responde
   * sozinho, porque cair na chave de outro setor furaria o rateio.
   */
  const credenciaisIA = await iaRepo.credenciaisDaConversa(segredo, conversaId);
  const credencialIA = credenciaisIA[0] ?? null;

  if (!credencialIA) {
    logger.info("bot nao rodou: atendimento automatico desligado ou sem chave", {
      conversaId,
      empresaId: ctx.empresaId,
    });
    return;
  }

  /*
   * A trava do numero: responde a todos, ou so a uma lista.
   *
   * ⚠️ E o que permite ligar o bot em producao sem risco. Desligado com a
   * lista vazia ele nao fala com ninguem, e esse e o padrao de conta nova:
   * atender automaticamente passa a ser um ato, e nao efeito colateral de
   * cadastrar um numero.
   */
  const modoTeste = !ctx.contaRespondeTodos;

  if (modoTeste && !ehONumeroDeTeste(ctx.telefone, ctx.contaNumeros ?? "")) {
    logger.info("bot ignorou: numero fora da lista deste whatsapp", {
      conversaId,
      temLista: Boolean(ctx.contaNumeros),
    });
    return;
  }

  const historico = await repo.mensagens(segredo, conversaId);
  const temTexto = historico.some(
    (m) => m.direcao === "entrada" && (m.texto?.trim() || (m.tipo === "image" && m.midiaId)),
  );

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

  // Quem ja provou ser quem diz ser nesta conversa. Entra na instrucao para o
  // modelo nao pedir documento a quem acabou de se identificar.
  const jaVerificado = await repo.verificado(segredo, conversaId);

  /*
   * O passo da identificacao nao passa pelo modelo.
   *
   * ⚠️ Vem antes de marcar "IA respondendo" e antes de qualquer chamada paga: o
   * bot ja perguntou o CPF, a resposta e um numero de onze digitos, e nao ha o
   * que interpretar. Deixar isso a cargo do modelo custou uma falha muda, com a
   * pessoa esperando resposta que nunca veio.
   */
  const etapa = await repo.etapaDaVerificacao(segredo, conversaId);
  const atalho = atalhoDeIdentificacao(historico, etapa?.etapa === "AGUARDANDO_CONFIRMACAO");

  if (atalho) {
    const texto = await passoDeterministico(segredo, ctx, conversaId, atalho);

    await responderComo(segredo, ctx, conversaId, texto);
    logger.info("passo de identificacao resolvido sem o modelo", {
      conversaId,
      acao: atalho.acao,
    });
    return;
  }

  const setores = await repo.setores(segredo, ctx.empresaId);

  /*
   * O catalogo entra na instrucao, e nao numa acao.
   *
   * "Voces fazem o quê?" e a primeira pergunta de quase todo contato novo, e
   * ate agora a unica resposta possivel era encaminhar ao comercial. Como e
   * informacao de venda, e a mesma para qualquer um, ela vem junto do texto em
   * vez de custar um passo a mais na conversa.
   */
  const catalogo = await repo.servicos(segredo, conversaId).catch(() => []);

  /*
   * As personas dizem o que a IA pode FECHAR sozinha, por setor. Sem persona
   * para o setor, o comportamento continua sendo o de sempre: encaminhar.
   */
  const personas = await repo.personas(segredo, conversaId).catch(() => []);

  /*
   * A partir daqui o painel mostra "a IA esta respondendo" e trava o campo de
   * escrita, para o atendente nao responder por cima.
   *
   * O `finally` nao e opcional: marca presa bloquearia a conversa por 45
   * segundos sem ninguem para destravar.
   */
  await repo.marcarRespondendo(segredo, conversaId, true).catch(() => {});

  try {
    const triagem = await ia.responderComReserva<Triagem>(
      credenciaisIA,
      instrucao(ctx, setores, jaVerificado, etapa, catalogo, personas),
      conversaEmTexto(historico),
      ESQUEMA_DA_TRIAGEM,
      await imagensRecentes(segredo, conversaId, historico),
    );

    if (!triagem) return;

    /*
     * Consulta da propria conta segue por fora da triagem.
     *
     * ⚠️ Nao vira atendimento e nao encaminha nada: a pessoa nao pediu para
     * falar com ninguem, ela perguntou algo que o sistema sabe responder.
     * Gravar isso na fila encheria o financeiro de tarefas ja resolvidas.
     */
    const persona = personaDaVez(personas, triagem.setorId || null);

    if (triagem.acao && triagem.acao !== "NENHUMA") {
      /*
       * ⚠️ A permissao e conferida AQUI, e nao so no texto da instrucao.
       *
       * O modelo pede a consulta pelo campo `acao`, e nada impede que ele peca
       * uma que a persona daquele setor nao tem. Confiar so na instrucao faria a
       * autorizacao depender de o modelo ter lido direito — e a lista de
       * permissoes deixaria de significar alguma coisa.
       */
      if (!podeConsultar(persona, triagem.acao)) {
        logger.info("consulta recusada: a persona nao tem a permissao", {
          conversaId,
          acao: triagem.acao,
          persona: persona?.nome,
        });

        await responderComo(
          segredo,
          ctx,
          conversaId,
          "Essa informação eu não consigo ver por aqui. Vou passar para o setor responsável.",
          persona,
        );
        return;
      }

      const texto = await passoDaIdentificacao(segredo, ctx, conversaId, triagem, jaVerificado);
      if (texto) await responderComo(segredo, ctx, conversaId, texto, persona);
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
      // Vazio vira null e o banco preserva o que ja tinha: o modelo devolve os
      // tres campos em toda chamada, e sobrescrever apagaria o nome que a
      // pessoa deu tres mensagens atras.
      leadNome: triagem.leadNome?.trim() || null,
      leadEmpresa: triagem.leadEmpresa?.trim() || null,
      leadEmail: triagem.leadEmail?.trim() || null,
    });

    const resposta = triagem.resposta?.trim();

    if (!resposta) {
      // Silencio por resposta vazia era indistinguivel de erro de rede. Foi
      // assim que um CPF ficou sem resposta sem deixar rastro.
      logger.warn("modelo devolveu resposta vazia", { conversaId, acao: triagem.acao });
      return;
    }

    await responderComo(segredo, ctx, conversaId, resposta, persona);

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
