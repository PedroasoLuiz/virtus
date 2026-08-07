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
  type AtendimentoDaConversa,
  type ClienteCandidato,
  type ContaWhatsapp,
  type Conversa,
  type Credenciais,
  type Mensagem,
  type Modelo,
  type ResultadoDoEvento,
} from "@/modules/whatsapp/whatsapp.types";
import { testeInconclusivo, type ResultadoDoTeste } from "@/shared/domain/teste-conexao";
import {
  finalidadePorId,
  previaDoCorpo,
  problemasDoVinculo,
  type ChaveDeFinalidade,
  type VinculoDeModelo,
} from "@/modules/whatsapp/finalidades";

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

/**
 * Confere as credenciais da Meta antes de gravar o numero.
 *
 * ⚠️ O token vazio com `id` preenchido cai no que ja esta no vault: e o caso de
 * editar um numero, em que a tela nunca recebeu o token de volta para reenviar.
 *
 * ⚠️ Nao valida o App Secret nem o Verify token. Os dois so se provam quando a
 * Meta chama a URL de callback, e nao ha como conferi-los daqui. A tela precisa
 * dizer isso, senao "tudo certo" promete mais do que foi verificado.
 */
export async function testarConta(
  entrada: { id: number | null; phoneNumberId: string; apiVersao: string; token: string | null },
): Promise<ResultadoDoTeste> {
  let token = entrada.token;

  if (!token && entrada.id != null) {
    // A funcao do banco ja confere o tenant.
    const guardadas = await repo.credenciais(entrada.id);
    token = guardadas?.token ?? null;
  }

  if (!token) {
    return testeInconclusivo("Cole o token para testar: não há nenhum gravado para este número.");
  }

  return cloud.testarConta({
    phoneNumberId: entrada.phoneNumberId,
    wabaId: null,
    apiVersao: entrada.apiVersao,
    token,
  });
}

/**
 * Os vinculos de finalidade de um numero.
 *
 * A empresa nao entra: quem confere o tenant e a propria funcao no banco.
 */
export async function listarVinculos(contaId: number): Promise<VinculoDeModelo[]> {
  return repo.vinculosDaConta(contaId);
}

/**
 * Grava o vinculo depois de conferir contra o modelo REAL.
 *
 * ⚠️ A conferencia acontece contra a lista lida da Meta agora, e nao contra o
 * que a tela mandou. O template pode ter voltado para revisao, ou ganhado mais
 * um `{{n}}`, entre abrir a tela e clicar em salvar — e um vinculo com a
 * contagem errada so falharia no envio, com um cliente esperando.
 */
export async function salvarVinculo(
  empresaId: number,
  contaId: number,
  vinculo: VinculoDeModelo,
): Promise<void> {
  const cred = await repo.credenciais(contaId);

  if (!cred) throw new BusinessRuleError("O numero escolhido esta sem token cadastrado.");

  const modelos = await cloud.listarModelos(cred);
  const modelo = modelos.find((m) => m.nome === vinculo.modeloNome) ?? null;

  const erros = problemasDoVinculo(vinculo, modelo);
  if (erros.length > 0) throw new BusinessRuleError(erros[0]);

  /*
   * ⚠️ Guarda o que foi conferido, e nao so a escolha.
   *
   * Corpo e quantidade de campos ficam gravados para o ENVIO nao precisar
   * perguntar a Meta de novo. Esta e a unica leitura da lista de modelos no
   * caminho todo, e ela acontece uma vez por vinculo salvo, com gente olhando a
   * tela — nao uma vez por mensagem disparada.
   */
  await repo.salvarVinculo(contaId, {
    ...vinculo,
    // O idioma e do MODELO, e nao do formulario: mandar outro faz a Meta
    // recusar o envio com um erro que ninguem liga a esta tela.
    idioma: modelo!.idioma,
    corpo: modelo!.corpo,
    campos: modelo!.parametros,
    validadoEm: null,
    erro: null,
    erroEm: null,
  });

  logger.info("vinculo de modelo gravado", { empresaId, contaId, finalidade: vinculo.finalidade });
}

/**
 * Cria na Meta o modelo sugerido de uma finalidade.
 *
 * ⚠️ O nome do modelo obedece a Meta, e nao o gosto de quem digita: minusculas,
 * numeros e sublinhado, ate 512. Um espaco ou acento faz ela recusar com uma
 * mensagem que ninguem liga ao campo, entao a limpeza acontece aqui.
 *
 * ⚠️ Cria e para. NAO vincula: o modelo nasce pendente de revisao, e vincular um
 * template que ainda pode ser recusado deixaria a tela dizendo "pronto" para um
 * envio que a Meta nao aceita.
 */
export async function criarModeloDaFinalidade(
  contaId: number,
  finalidadeId: string,
): Promise<{ nome: string; status: string }> {
  const finalidade = finalidadePorId(finalidadeId);
  if (!finalidade) throw new BusinessRuleError("Finalidade desconhecida");

  const cred = await repo.credenciais(contaId);
  if (!cred) throw new BusinessRuleError("O numero escolhido esta sem token cadastrado.");

  /*
   * ⚠️ Um pedido de cada vez por finalidade. Sem esta trava, dois cliques no
   * botao viram dois modelos na Meta com nomes proximos, e o teto de modelos da
   * conta e do cliente.
   */
  const vinculos = await repo.vinculosDaConta(contaId);
  const atual = vinculos.find((v) => v.finalidade === finalidadeId);

  if (atual?.solicitacaoStatus === "PENDING") {
    throw new BusinessRuleError("Já há um modelo desta finalidade em análise na Meta.");
  }

  /*
   * Os exemplos saem na ordem dos MARCADORES do corpo sugerido, e nao na ordem
   * do catalogo: a Meta confere posicao por posicao contra os `{{n}}`, e o texto
   * sugerido de cobranca cita o ticket antes do valor.
   */
  const exemplos = finalidade.parametrosSugeridos.map(
    (chave) => finalidade.variaveis.find((v) => v.chave === chave)?.exemplo ?? "exemplo",
  );

  const resultado = await cloud.criarModelo(cred, {
    nome: finalidade.nomeSugerido,
    idioma: IDIOMA_PADRAO,
    categoria: finalidade.categoria,
    corpo: finalidade.corpoSugerido,
    exemplos,
    botao: finalidade.botao
      ? {
          texto: "Acessar fatura",
          /*
           * ⚠️ Sempre `https`, e sem barra dobrada. A Meta recusa botao em
           * `http`, e `APP_URL` cai em `http://localhost` quando ninguem
           * configurou — o modelo seria criado com um endereco que ela nao
           * aceita, e a recusa nao diria que o problema era o esquema.
           */
          url: `${serverEnv().APP_URL.replace(/^http:\/\//, "https://").replace(/\/+$/, "")}/p/`,
          exemplo: "a3f9c2e1b7",
        }
      : null,
  });

  /*
   * Grava o pedido JA com o mapeamento. Ele e nosso e conhecido antes da
   * resposta: e o que permite o vinculo se completar sozinho na aprovacao.
   */
  await repo.solicitarModelo(contaId, {
    finalidade: finalidadeId,
    nome: finalidade.nomeSugerido,
    idioma: IDIOMA_PADRAO,
    parametros: finalidade.parametrosSugeridos,
    botaoParam: finalidade.botao?.chave ?? null,
    corpo: finalidade.corpoSugerido,
    campos: finalidade.parametrosSugeridos.length,
  });

  logger.info("modelo pedido a Meta", { contaId, finalidade: finalidadeId });

  return { nome: finalidade.nomeSugerido, status: resultado.status };
}

/**
 * Pergunta a Meta se o modelo pedido ja foi decidido.
 *
 * ⚠️ So faz sentido enquanto ha pedido PENDENTE, e quem para de perguntar e a
 * tela: aqui, um pedido ja resolvido devolve o que esta gravado sem sair para a
 * rede. E a trava que impede o laco de consulta virar chamada eterna a Meta.
 */
export async function conferirSolicitacao(
  contaId: number,
  finalidadeId: string,
): Promise<VinculoDeModelo | null> {
  const vinculos = await repo.vinculosDaConta(contaId);
  const atual = vinculos.find((v) => v.finalidade === finalidadeId) ?? null;

  if (!atual || atual.solicitacaoStatus !== "PENDING" || !atual.solicitacaoNome) return atual;

  const cred = await repo.credenciais(contaId);
  if (!cred) return atual;

  const resposta = await cloud.consultarModelo(cred, atual.solicitacaoNome);

  // Sem resposta, ou ainda pendente: nada mudou, e gravar por gravar so
  // acrescentaria escrita a cada checagem.
  if (!resposta || resposta.status === "PENDING") return atual;

  await repo.resolverSolicitacao(contaId, finalidadeId, resposta.status, resposta.motivo);

  const atualizados = await repo.vinculosDaConta(contaId);
  return atualizados.find((v) => v.finalidade === finalidadeId) ?? null;
}

/** O idioma dos modelos que o sistema cria. */
const IDIOMA_PADRAO = "pt_BR";

export async function removerVinculo(contaId: number, finalidade: string): Promise<void> {
  await repo.removerVinculo(contaId, finalidade);
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
): Promise<{
  conversa: Conversa;
  mensagens: Mensagem[];
  atendimento: AtendimentoDaConversa | null;
}> {
  const conversa = await obterConversa(empresaId, id);
  const mensagens = await repo.listarMensagens(empresaId, id);

  /*
   * Vem junto da conversa, e nao numa chamada propria: o resumo aparece no
   * mesmo instante que a thread. Buscado a parte, ele entraria depois, e um
   * cartao que surge sozinho em cima do campo de escrita chega justamente
   * quando a pessoa ja comecou a digitar.
   */
  const atendimento = await repo.atendimentoDaConversa(empresaId, id);

  if (conversa.naoLidas > 0) {
    await repo.zerarNaoLidas(empresaId, id);
    conversa.naoLidas = 0;
  }

  return { conversa, mensagens, atendimento };
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

  /*
   * ⚠️ Clique duplo NAO manda duas vezes.
   *
   * A tela ja desabilita o botao enquanto envia, mas rede lenta faz a pessoa
   * clicar de novo antes de a primeira resposta chegar, e um recarregamento no
   * meio reenvia o formulario. No WhatsApp isso nao se desfaz: o cliente ve as
   * duas.
   */
  const segredo = serverEnv().WHATSAPP_WEBHOOK_SEGREDO;

  if (segredo) {
    const repetida = await repo.saidaRepetida(segredo, conversaId, corpo).catch(() => null);

    if (repetida != null) {
      const anterior = await repo.buscarMensagem(empresaId, repetida);

      if (anterior) {
        logger.info("envio repetido descartado", { conversaId, mensagemId: repetida });
        return anterior;
      }
    }
  }

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
    texto: previaDoCorpo(modelo.corpo, parametros),
  });
}

/**
 * Manda a mensagem de uma FINALIDADE, com o modelo que o cliente vinculou.
 *
 * Dispara para um TELEFONE, sem depender de conversa existente — diferente de
 * `enviarModelo`, que parte de uma conversa aberta no painel. Aqui quem chama e
 * a cobranca: o cliente pode nunca ter escrito, e modelo aprovado e justamente
 * o que a Meta deixa enviar nesse caso. A conversa e criada de qualquer forma,
 * para o disparo aparecer no painel e a resposta cair no mesmo lugar.
 *
 * ⚠️ Recebe os valores por NOME, e nao em ordem. A ordem e do modelo dele, nao
 * nossa: quem sabe que o `{{3}}` daquele texto e o vencimento e o vinculo,
 * gravado na tela de modelos. Passar array aqui traria de volta exatamente o
 * acoplamento que o vinculo existe para desfazer.
 *
 * ⚠️ Sem vinculo, NAO cai em nenhum nome por convencao. Um `cobranca` chutado
 * acertaria em quem seguiu a sugestao e mandaria para o modelo errado em quem
 * nao seguiu, e o erro so apareceria no cliente.
 */
export async function dispararFinalidade(
  empresaId: number,
  usuarioId: string,
  destino: { telefone: string; nome: string | null },
  finalidade: ChaveDeFinalidade,
  valores: Record<string, string>,
): Promise<Mensagem> {
  const conta = await contaParaDisparo(empresaId);

  /*
   * As credenciais e os vinculos saem JUNTOS, e a conta e resolvida uma vez so.
   *
   * ⚠️ Antes isto passava por `dispararModelo`, que resolvia a conta de novo
   * por dentro: dois `listarContas` por mensagem enviada. Num disparo de
   * cobranca em lote, isso e uma consulta desperdicada por parcela.
   */
  const [cred, vinculos] = await Promise.all([
    repo.credenciais(conta.id),
    repo.vinculosDaConta(conta.id),
  ]);

  if (!cred) throw new BusinessRuleError("O numero escolhido esta sem token cadastrado.");

  const vinculo = vinculos.find((v) => v.finalidade === finalidade);
  const rotulo = finalidadePorId(finalidade)?.rotulo ?? finalidade;

  if (!vinculo) {
    throw new BusinessRuleError(
      `Nenhum modelo do WhatsApp está vinculado a "${rotulo}" neste número. Configure em Configuração do WhatsApp, aba Modelos.`,
    );
  }

  /*
   * ⚠️ Linha existente NAO significa vinculo pronto.
   *
   * Enquanto o modelo padrao esta em analise, a linha ja existe com o
   * mapeamento gravado, mas sem `modeloNome`: a Meta ainda nao aprovou. Enviar
   * ali seria pedir a ela um template que nao esta no catalogo dela.
   */
  const modeloVinculado = vinculo.modeloNome;

  if (!modeloVinculado) {
    throw new BusinessRuleError(
      vinculo.solicitacaoStatus === "PENDING"
        ? `O modelo de "${rotulo}" ainda está em análise na Meta. Assim que ela aprovar, o envio libera sozinho.`
        : `Nenhum modelo do WhatsApp está vinculado a "${rotulo}" neste número. Configure em Configuração do WhatsApp, aba Modelos.`,
    );
  }

  const parametros = vinculo.parametros.map((chave) => {
    const v = valores[chave];

    /*
     * Faltar valor e ERRO, e nao um espaco em branco.
     *
     * A Meta aceita string vazia e entrega a mensagem com um buraco no meio da
     * frase. Melhor o envio falhar aqui, na tela de quem clicou, do que sair
     * "sua parcela de R$ vence em" para o cliente.
     */
    if (v == null) {
      throw new BusinessRuleError(
        `O vínculo de "${rotulo}" pede "${chave}", que esta tela não tem para dar. Refaça o vínculo em Configuração do WhatsApp.`,
      );
    }

    return v;
  });

  const urlDoBotao = vinculo.botaoParam ? valores[vinculo.botaoParam] : undefined;

  const conversa = await repo.garantirConversa(
    empresaId,
    conta.id,
    destino.telefone,
    destino.nome,
  );

  /*
   * ⚠️ Vai DIRETO, sem reler a lista de modelos na Meta.
   *
   * O vinculo ja foi conferido contra ela quando foi salvo, e o resultado ficou
   * gravado. Reconferir a cada mensagem multiplicava por empresa, por usuario e
   * por parcela: um lote de 200 cobrancas gastava 200 leituras para descobrir o
   * que ja se sabia, e a Meta limita chamadas.
   *
   * O preco e que um modelo que saiu de aprovado depois do vinculo so aparece
   * na primeira falha. Por isso a recusa e ANOTADA no vinculo logo abaixo: a
   * tela de configuracao passa a mostrar o problema, em vez de continuar
   * dizendo "pronto" ate alguem reabrir e salvar por acaso.
   */
  let wamid: string;

  try {
    wamid = await cloud.enviarModelo(
      cred,
      destino.telefone,
      modeloVinculado,
      vinculo.idioma,
      parametros,
      urlDoBotao,
    );
  } catch (err) {
    const causa = err instanceof Error ? err.message : String(err);

    await repo.marcarVinculoComErro(conta.id, finalidade, causa);
    throw err;
  }

  return gravarOuAvisar(empresaId, conversa.id, usuarioId, {
    wamid,
    tipo: "template",
    /*
     * Grava o corpo JA PREENCHIDO: o modelo cru deixaria o historico com
     * `{{1}}` no lugar do valor, e ninguem saberia quanto foi cobrado de quem.
     *
     * O corpo vem do VINCULO. Ele e uma copia do texto no momento em que foi
     * conferido: se o cliente reescreveu o modelo na Meta e nao revalidou aqui,
     * o historico guarda a versao antiga — que ainda diz o que foi cobrado.
     */
    texto: previaDoCorpo(vinculo.corpo ?? "", parametros),
  });
}

/** O numero por onde o sistema fala quando ninguem escolheu um. */
async function contaParaDisparo(empresaId: number): Promise<ContaWhatsapp> {
  const contas = await listarContas(empresaId);
  const conta = contas.find((c) => c.ativo && c.temToken);

  if (!conta) {
    throw new BusinessRuleError(
      "Nenhum numero de WhatsApp ativo com token. Confira em Configuracao de contas.",
    );
  }

  return conta;
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
