import { serverEnv } from "@/infra/config/env";
import { AppError, BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import * as cloud from "@/modules/whatsapp/whatsapp.cloud";
import { AudioInvalidoError, webmOpusParaOgg } from "@/modules/whatsapp/whatsapp.audio";
import * as repo from "@/modules/whatsapp/whatsapp.repository";
import {
  janelaAberta,
  tipoDoArquivo,
  LIMITE_POR_TIPO,
  type ClienteCandidato,
  type ContaWhatsapp,
  type Conversa,
  type Credenciais,
  type Mensagem,
  type Modelo,
  type ResultadoDoEvento,
} from "@/modules/whatsapp/whatsapp.types";

/** Regra de negocio do WhatsApp. */

export async function listarContas(empresaId: number): Promise<ContaWhatsapp[]> {
  return repo.listarContas(empresaId);
}

export async function salvarConta(
  empresaId: number,
  entrada: Parameters<typeof repo.salvarConta>[1],
): Promise<ContaWhatsapp> {
  const id = await repo.salvarConta(empresaId, entrada);
  const contas = await repo.listarContas(empresaId);
  const conta = contas.find((c) => c.id === id);

  if (!conta) throw new NotFoundError("Conta nao encontrada apos gravar");
  return conta;
}

/** A empresa nao entra: quem confere o tenant e a propria funcao no banco. */
export async function definirContaAtiva(contaId: number, ativo: boolean): Promise<void> {
  await repo.definirAtiva(contaId, ativo);
}

/**
 * Credenciais da conta por onde a conversa corre.
 *
 * Buscadas a cada envio, e nao guardadas em memoria: o token pode ser trocado na
 * tela de configuracao, e um cache faria o proximo envio usar o antigo — que a
 * Meta ja teria invalidado.
 */
async function credenciaisDaConversa(conversa: Conversa): Promise<Credenciais> {
  const cred = await repo.credenciais(conversa.contaId);

  if (!cred) {
    throw new BusinessRuleError(
      "O numero desta conversa esta desativado ou sem token cadastrado. " +
        "Confira em Configuracao de contas.",
    );
  }

  return cred;
}

export async function listarConversas(
  empresaId: number,
  contaId?: number,
  busca?: string,
): Promise<Conversa[]> {
  return repo.listarConversas(empresaId, contaId, busca);
}

export async function obterConversa(empresaId: number, id: number): Promise<Conversa> {
  const conversa = await repo.buscarConversa(empresaId, id);
  if (!conversa) throw new NotFoundError("Conversa nao encontrada");
  return conversa;
}

/**
 * Detalhes do contato: a conversa mais todos os cadastros que casam com o
 * telefone.
 *
 * Existe porque "sem vinculo" tem duas causas opostas — nao conheco ninguem com
 * este numero, ou conheco DEMAIS e nao sei qual — e a tela precisa saber
 * distinguir. Ver `whatsapp_cliente_do_telefone` no banco.
 */
export async function detalharConversa(
  empresaId: number,
  id: number,
): Promise<{ conversa: Conversa; candidatos: ClienteCandidato[] }> {
  const conversa = await obterConversa(empresaId, id);
  const candidatos = await repo.clientesDoTelefone(empresaId, conversa.telefone);

  return { conversa, candidatos };
}

/**
 * Abrir a conversa marca como lida.
 *
 * O contador some no ato em vez de esperar um gesto separado: quem abriu a
 * conversa leu, e "marcar como lida" a mais e ritual sem informacao.
 */
/**
 * Liga a conversa a um cadastro, guardando o telefone como contato dele.
 *
 * E o caminho para o caso comum: a segunda pessoa da mesma empresa escreve de
 * outro numero. Em vez de exigir que alguem edite o cadastro por fora, o proprio
 * painel registra o contato — e o vinculo passa a valer para sempre, inclusive
 * em conversas futuras daquele numero.
 */
export async function vincularConversaACliente(
  empresaId: number,
  usuarioId: string,
  conversaId: number,
  clienteId: number,
): Promise<Conversa> {
  const conversa = await obterConversa(empresaId, conversaId);

  if (conversa.clienteId === clienteId) return conversa;

  await repo.vincularCliente(
    conversaId,
    clienteId,
    conversa.telefone,
    // O nome do perfil vira o rotulo: e o que identifica de QUEM e o numero
    // dentro da empresa, que e a informacao que faltaria depois.
    conversa.nome,
    usuarioId,
  );

  // Reconsulta: o gatilho no banco e quem escreveu o vinculo.
  return obterConversa(empresaId, conversaId);
}

export async function abrirConversa(
  empresaId: number,
  id: number,
): Promise<{ conversa: Conversa; mensagens: Mensagem[] }> {
  const conversa = await obterConversa(empresaId, id);
  const mensagens = await repo.listarMensagens(empresaId, id);

  if (conversa.naoLidas > 0) {
    await repo.zerarNaoLidas(empresaId, id);
    conversa.naoLidas = 0;
  }

  return { conversa, mensagens };
}

/**
 * Responde com texto livre.
 *
 * A ordem importa: manda para a Meta PRIMEIRO e so grava depois de ela aceitar.
 * O inverso — gravar e depois enviar — mostraria no painel uma mensagem que o
 * cliente nunca recebeu, que e a mentira mais cara que este painel pode contar.
 * O preco e o oposto: se a gravacao falhar depois do envio, a mensagem foi e
 * nao aparece. Fica registrado no log e o proximo webhook de status nao a
 * encontra pelo `wamid` — visivel, e nao silencioso.
 */
export async function responder(
  empresaId: number,
  usuarioId: string,
  autorNome: string | null,
  conversaId: number,
  texto: string,
): Promise<Mensagem> {
  const conversa = await obterConversa(empresaId, conversaId);

  if (!janelaAberta(conversa.janelaExpiraEm)) {
    throw new BusinessRuleError(
      "Passaram-se mais de 24 horas desde a ultima mensagem do cliente. " +
        "Nesse caso a Meta so aceita um modelo aprovado.",
    );
  }

  const cred = await credenciaisDaConversa(conversa);
  const corpo = comAssinaturaDoAutor(autorNome, texto);
  const wamid = await cloud.enviarTexto(cred, conversa.telefone, corpo);

  return gravarOuAvisar(empresaId, conversaId, usuarioId, {
    wamid,
    tipo: "text",
    texto: corpo,
  });
}

/**
 * Envia um anexo.
 *
 * Duas chamadas a Meta: sobe o arquivo, depois manda a mensagem com o id. Se a
 * segunda falhar, o arquivo fica orfao la — inofensivo, a Meta o descarta em 30
 * dias, e insistir em apagar custaria uma terceira chamada num caminho de erro.
 *
 * A assinatura do autor vai na LEGENDA, nao numa mensagem separada: duas
 * mensagens seriam duas cobrancas depois de 1/out/2026, e o cliente veria o nome
 * solto antes da foto.
 */
export async function enviarAnexo(
  empresaId: number,
  usuarioId: string,
  autorNome: string | null,
  conversaId: number,
  arquivo: { conteudo: Blob; nome: string; mime: string },
  legenda: string | null,
): Promise<Mensagem> {
  const conversa = await obterConversa(empresaId, conversaId);

  if (!janelaAberta(conversa.janelaExpiraEm)) {
    throw new BusinessRuleError(
      "Passaram-se mais de 24 horas desde a ultima mensagem do cliente. " +
        "Fora da janela a Meta so aceita modelo aprovado, e modelo nao leva anexo avulso.",
    );
  }

  const tipo = tipoDoArquivo(arquivo.mime);
  const limite = LIMITE_POR_TIPO[tipo];

  if (arquivo.conteudo.size > limite) {
    throw new BusinessRuleError(
      `Arquivo grande demais: o WhatsApp aceita ate ${Math.round(limite / 1024 / 1024)} MB para ${tipo}.`,
    );
  }

  const cred = await credenciaisDaConversa(conversa);
  const pronto = await paraFormatoQueAMetaAceita(arquivo);

  const midiaId = await cloud.subirMidia(cred, pronto.conteudo, pronto.nome, pronto.mime);

  // Audio nao aceita legenda na Cloud API — a mensagem inteira e recusada se ela
  // for junto. Entao ali a assinatura simplesmente nao existe.
  const legendaFinal =
    tipo === "audio" ? null : comAssinaturaDoAutor(autorNome, legenda ?? "").trim() || null;

  const wamid = await cloud.enviarMidia(
    cred,
    conversa.telefone,
    tipo,
    midiaId,
    legendaFinal,
    arquivo.nome,
  );

  return gravarOuAvisar(empresaId, conversaId, usuarioId, {
    wamid,
    tipo,
    texto: legendaFinal,
    midiaId,
    midiaMime: pronto.mime,
    midiaNome: pronto.nome,
  });
}

/**
 * Ajusta o arquivo ao que a Cloud API aceita, quando da.
 *
 * Hoje isso e um caso so: audio WebM/Opus, que e o unico formato de gravacao
 * util que o Chrome produz. O Opus dentro dele ja serve; troca-se a caixa.
 *
 * ⚠️ Nao e transcodificacao. Nenhuma amostra e recalculada — ver
 * `whatsapp.audio.ts` para o porque de existir.
 */
async function paraFormatoQueAMetaAceita(arquivo: {
  conteudo: Blob;
  nome: string;
  mime: string;
}): Promise<{ conteudo: Blob; nome: string; mime: string }> {
  if (!arquivo.mime.startsWith("audio/webm")) return arquivo;

  try {
    const ogg = webmOpusParaOgg(new Uint8Array(await arquivo.conteudo.arrayBuffer()));

    return {
      conteudo: new Blob([ogg as unknown as BlobPart], { type: "audio/ogg" }),
      nome: arquivo.nome.replace(/\.webm$/i, "") + ".ogg",
      mime: "audio/ogg",
    };
  } catch (err) {
    if (err instanceof AudioInvalidoError) throw new BusinessRuleError(err.message);

    logger.error("falha ao reembrulhar audio", {
      erro: err instanceof Error ? err.message : err,
      bytes: arquivo.conteudo.size,
    });

    throw new BusinessRuleError(
      "Nao foi possivel preparar o audio para envio. Tente gravar novamente.",
    );
  }
}

export async function listarModelos(contaId: number): Promise<Modelo[]> {
  // `credenciais` ja recusa conta de outra empresa: a checagem de tenant esta
  // dentro da funcao do banco, nao aqui.
  const cred = await repo.credenciais(contaId);

  if (!cred) {
    throw new BusinessRuleError("Numero sem token cadastrado. Confira em Configuracao de contas.");
  }

  return cloud.listarModelos(cred);
}

/**
 * Envia um modelo aprovado. E o caminho para quem esta FORA da janela.
 *
 * Nao exige janela fechada de proposito: modelo tambem vale dentro dela (e ate
 * 30/09/2026 o utility dentro da janela e gratuito). Recusar seria inventar uma
 * regra que a Meta nao tem.
 */
export async function enviarModelo(
  empresaId: number,
  usuarioId: string,
  conversaId: number,
  nome: string,
  parametros: string[],
): Promise<Mensagem> {
  const conversa = await obterConversa(empresaId, conversaId);

  const cred = await credenciaisDaConversa(conversa);
  const modelos = await cloud.listarModelos(cred);
  const modelo = modelos.find((m) => m.nome === nome);

  // Confere contra a lista da Meta, e nao so contra o que a tela mandou: modelo
  // sai de APPROVED sozinho quando alguem o edita no painel, e ai o envio
  // falharia com um erro cru.
  if (!modelo) {
    throw new BusinessRuleError(
      `O modelo "${nome}" nao esta aprovado. Confira o status no painel da Meta.`,
    );
  }

  if (parametros.length !== modelo.parametros) {
    throw new BusinessRuleError(
      `O modelo "${nome}" espera ${modelo.parametros} parametro(s), recebeu ${parametros.length}.`,
    );
  }

  const wamid = await cloud.enviarModelo(
    cred,
    conversa.telefone,
    modelo.nome,
    modelo.idioma,
    parametros,
  );

  // Grava o corpo JA PREENCHIDO: guardar o modelo cru deixaria o historico com
  // `{{1}}` no lugar do valor, e ninguem saberia quanto foi cobrado de quem.
  return gravarOuAvisar(empresaId, conversaId, usuarioId, {
    wamid,
    tipo: "template",
    texto: preencherModelo(modelo.corpo, parametros),
  });
}

/** Troca `{{1}}`, `{{2}}`… pelos valores, na ordem. */
export function preencherModelo(corpo: string, parametros: string[]): string {
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (marcador, n: string) => {
    const valor = parametros[Number(n) - 1];
    return valor ?? marcador;
  });
}

/**
 * Grava a mensagem que a Meta ja aceitou.
 *
 * Falhar aqui NAO e o mesmo que falhar no envio: o cliente recebeu. Por isso o
 * erro diz exatamente isso, em vez de sugerir que nada aconteceu — quem lesse
 * "falha ao enviar" reenviaria, e o cliente receberia duas vezes.
 */
async function gravarOuAvisar(
  empresaId: number,
  conversaId: number,
  usuarioId: string,
  saida: repo.SaidaGravavel,
): Promise<Mensagem> {
  try {
    return await repo.registrarEnviada(empresaId, conversaId, usuarioId, saida);
  } catch (err) {
    logger.error("mensagem enviada ao WhatsApp mas nao gravada", {
      empresaId,
      conversaId,
      wamid: saida.wamid,
      erro: err instanceof Error ? err.message : err,
    });
    throw new AppError(
      "INTERNAL",
      500,
      "A mensagem foi enviada ao cliente, mas nao entrou no historico. Recarregue antes de reenviar.",
    );
  }
}

/**
 * Assina a mensagem com quem a escreveu.
 *
 * O numero e UM e a equipe e varias: sem isso o cliente recebe respostas de
 * pessoas diferentes todas com a mesma cara, e nao tem como saber com quem esta
 * falando — nem cobrar continuidade de quem prometeu algo ontem.
 *
 * Vai em negrito do WhatsApp (`*texto*`) e numa linha propria, para nao se
 * confundir com o corpo. Sem nome cadastrado, manda so a mensagem: uma
 * assinatura vazia seria pior que nenhuma.
 *
 * ⚠️ O que vai gravado e o texto COM a assinatura, porque e o que o cliente
 * recebeu. O painel nao pode mostrar uma versao mais limpa do que foi enviado.
 */
export function comAssinaturaDoAutor(autorNome: string | null, texto: string): string {
  const nome = autorNome?.trim();
  return nome ? `*${nome}:*\n${texto}` : texto;
}

export async function baixarMidia(empresaId: number, conversaId: number, midiaId: string) {
  const conversa = await obterConversa(empresaId, conversaId);

  /*
   * A midia tem de ser DESTA conversa.
   *
   * A conversa ja provou o tenant, mas isso autorizava o portador, nao o
   * recurso: com uma conversa propria qualquer dava para pedir um id de midia
   * arbitrario e o servidor ia busca-lo na Meta com o token da conta. 404 e nao
   * 403 de proposito — nao confirmamos que o id existe em outro lugar.
   */
  if (!(await repo.midiaEhDaConversa(empresaId, conversaId, midiaId))) {
    throw new NotFoundError("Midia nao encontrada nesta conversa");
  }

  const cred = await credenciaisDaConversa(conversa);
  return cloud.baixarMidia(cred, midiaId);
}

/**
 * Handshake de verificacao do webhook.
 *
 * A Meta chama uma vez com GET e so registra a URL se receber o `challenge` de
 * volta em texto puro.
 */
export async function verificarWebhook(
  modo: string | null,
  token: string | null,
): Promise<boolean> {
  if (modo !== "subscribe" || !token) return false;

  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;
  if (!segredo) return false;

  // Confere contra as contas CADASTRADAS, e nao contra o ambiente: com varias
  // empresas cada uma tem o seu verify token, e a URL de callback e a mesma.
  return repo.verifyTokenValido(segredo, token);
}

/**
 * App Secret da conta dona do numero que aparece no payload.
 *
 * ⚠️ O `phoneNumberId` vem de um corpo AINDA NAO AUTENTICADO. Usa-lo aqui e
 * seguro porque ele so ESCOLHE a chave — se o corpo foi forjado, a assinatura
 * nao vai bater com chave nenhuma e o evento e recusado. O que nao se pode
 * fazer e AGIR sobre esse corpo antes da conferencia.
 */
export async function appSecretDoNumero(phoneNumberId: string): Promise<string | null> {
  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;
  if (!segredo) return null;

  return repo.appSecretDoNumero(segredo, phoneNumberId);
}

/**
 * Recebe o lote de eventos da Meta.
 *
 * Erro aqui NAO pode virar resposta de erro para a Meta: ela reentrega o mesmo
 * lote por dias e, depois de tentar demais, desassina o webhook — e ai as
 * mensagens param de chegar de vez. Por isso quem chama sempre devolve 200; o
 * problema fica no log. A idempotencia por `wamid` e o que torna a reentrega
 * inofensiva quando ela acontece.
 */
export async function registrarEvento(payload: unknown): Promise<ResultadoDoEvento> {
  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;

  if (!segredo) {
    throw new AppError(
      "INTERNAL",
      503,
      "WHATSAPP_WEBHOOK_SEGREDO nao configurado: o webhook nao consegue gravar.",
    );
  }

  return repo.registrarEvento(segredo, payload);
}

export { janelaAberta };
