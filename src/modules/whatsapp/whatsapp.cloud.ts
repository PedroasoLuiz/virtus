import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError, BusinessRuleError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import type { Credenciais, Modelo, TipoDeEnvio } from "@/modules/whatsapp/whatsapp.types";
import {
  testeDeErroDeRede,
  testeFalhou,
  testeInconclusivo,
  testeOk,
  tempoDaChamada,
  type ResultadoDoTeste,
} from "@/shared/domain/teste-conexao";

/**
 * Porta de saida para a Graph API da Meta.
 *
 * Fica ao lado do repositorio, nao dentro dele: `repository` e a porta do banco,
 * e misturar as duas faria o service depender de uma so palavra para duas redes
 * com falhas muito diferentes. O service chama as duas; ninguem alem dele chama
 * esta.
 *
 * ⚠️ Nunca importar de componente de cliente: o token nao pode ir para o bundle
 * do navegador. `serverEnv()` e `node:crypto` derrubam o build se isso
 * acontecer — e a protecao que sobra enquanto o pacote `server-only` nao
 * estiver no projeto.
 */

const BASE = "https://graph.facebook.com";

/*
 * As credenciais chegam por PARAMETRO, uma por conta.
 *
 * Antes vinham do ambiente, o que amarrava o sistema inteiro a um numero so.
 * Agora cada empresa cadastra os seus, e o token sai do `supabase_vault` no
 * momento do envio — nunca fica em variavel de ambiente nem em coluna.
 */

type RespostaEnvio = {
  messages?: { id: string }[];
  error?: { message?: string; code?: number; error_data?: { details?: string } };
};

/** Envia texto livre. So vale dentro da janela de 24h — quem confere e o service. */
export async function enviarTexto(
  cred: Credenciais,
  para: string,
  texto: string,
): Promise<string> {
  const { token, phoneNumberId: phoneId, apiVersao: versao } = cred;

  return despachar(`${BASE}/${versao}/${phoneId}/messages`, token, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: para,
    type: "text",
    // `preview_url` ligado: link de boleto e de fatura e o que mais viaja por
    // aqui, e a previa e o que faz o cliente reconhecer que e legitimo.
    text: { preview_url: true, body: texto },
  });
}

/**
 * Sobe o arquivo para a Meta e devolve o id da midia.
 *
 * Envio de anexo sao SEMPRE duas chamadas: primeiro sobe o arquivo, depois
 * manda a mensagem referenciando o id. Nao existe enviar bytes junto com a
 * mensagem.
 *
 * O id vale 30 dias e serve para reenviar o mesmo arquivo sem subir de novo.
 */
export async function subirMidia(
  cred: Credenciais,
  arquivo: Blob,
  nome: string,
  mime: string,
): Promise<string> {
  const { token, phoneNumberId: phoneId, apiVersao: versao } = cred;

  /*
   * A Meta quer o mime PURO: `audio/ogg`, nunca `audio/ogg;codecs=opus`.
   *
   * O `MediaRecorder` do navegador devolve sempre com o parametro de codec
   * junto, e mandar assim faz o upload ser recusado — foi o que impediu a
   * mensagem de voz de sair na primeira versao.
   */
  const mimePuro = mime.split(";")[0].trim();

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimePuro);
  // Reembrulha com o mime limpo: o `Content-Type` da parte do multipart sai do
  // proprio Blob, e o original ainda carregaria o codec.
  form.append("file", new Blob([arquivo], { type: mimePuro }), nome);

  const resposta = await fetch(`${BASE}/${versao}/${phoneId}/media`, {
    method: "POST",
    // Sem `Content-Type` a mao: o fetch precisa escrever o boundary do
    // multipart, e defini-lo aqui quebra o corpo de um jeito que a Meta
    // responde com um erro que nao menciona o boundary.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const corpo = (await resposta.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };

  if (!resposta.ok || !corpo.id) {
    const kb = Math.round(arquivo.size / 1024);

    logger.error("falha ao subir midia para o whatsapp", {
      status: resposta.status,
      detalhe: corpo.error?.message,
      mimeOriginal: mime,
      mimeEnviado: mimePuro,
      bytes: arquivo.size,
    });

    /*
     * O formato entra na mensagem de proposito.
     *
     * "Media upload error" sozinho nao diz nada acionavel, e a causa quase
     * sempre e o formato: cada navegador grava num container diferente, e a
     * Cloud API aceita uma lista curta. Sabendo qual foi, da para decidir entre
     * trocar de navegador e converter o arquivo.
     */
    throw new BusinessRuleError(
      `O WhatsApp recusou o arquivo (${mimePuro}, ${kb} KB): ` +
        `${corpo.error?.message ?? "erro desconhecido"}`,
    );
  }

  return corpo.id;
}

/** Manda um anexo ja subido. `tipo` tem de casar com o MIME do upload. */
export async function enviarMidia(
  cred: Credenciais,
  para: string,
  tipo: TipoDeEnvio,
  midiaId: string,
  legenda: string | null,
  nomeDoArquivo: string | null,
): Promise<string> {
  const { token, phoneNumberId: phoneId, apiVersao: versao } = cred;

  // Legenda so vale em imagem, video e documento — a Meta recusa a mensagem
  // inteira se ela vier em audio, em vez de ignorar o campo.
  const aceitaLegenda = tipo !== "audio";

  const conteudo: Record<string, string> = { id: midiaId };
  if (aceitaLegenda && legenda) conteudo.caption = legenda;
  if (tipo === "document" && nomeDoArquivo) conteudo.filename = nomeDoArquivo;

  return despachar(
    `${BASE}/${versao}/${phoneId}/messages`,
    token,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: para,
      type: tipo,
      [tipo]: conteudo,
    },
  );
}

/**
 * Manda um modelo aprovado. E o unico caminho para quem esta fora da janela.
 *
 * Os parametros sao posicionais e a ORDEM importa: a Meta so confere a
 * quantidade, entao trocar dois de lugar passa pela validacao e chega errado no
 * cliente.
 */
export async function enviarModelo(
  cred: Credenciais,
  para: string,
  nome: string,
  idioma: string,
  parametros: string[],
  /**
   * O pedaco variavel da URL do botao.
   *
   * ⚠️ E o SUFIXO, nao a URL inteira. O modelo aprovado guarda o comeco fixo
   * (`https://.../p/{{1}}`) e a Meta so aceita completar o que falta: mandar a
   * URL completa aqui produziria um link com o dominio duas vezes.
   */
  urlDoBotao?: string,
): Promise<string> {
  const { token, phoneNumberId: phoneId, apiVersao: versao } = cred;

  const componentes: Record<string, unknown>[] = [];

  if (parametros.length > 0) {
    componentes.push({
      type: "body",
      parameters: parametros.map((text) => ({ type: "text", text })),
    });
  }

  if (urlDoBotao) {
    componentes.push({
      type: "button",
      sub_type: "url",
      // Indice do botao no modelo, em texto. Um botao so: sempre "0".
      index: "0",
      parameters: [{ type: "text", text: urlDoBotao }],
    });
  }

  return despachar(
    `${BASE}/${versao}/${phoneId}/messages`,
    token,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: para,
      type: "template",
      template: {
        name: nome,
        language: { code: idioma },
        ...(componentes.length > 0 ? { components: componentes } : {}),
      },
    },
  );
}

/**
 * Modelos aprovados da conta.
 *
 * Filtra por APPROVED porque modelo em revisao ou reprovado nao pode ser
 * enviado — oferecer na tela so produziria erro no clique. Foi o caso do
 * `cobranca`, que ficou PENDING depois de uma edicao.
 */
export async function listarModelos(cred: Credenciais): Promise<Modelo[]> {
  const { token, apiVersao: versao, wabaId: waba } = cred;

  if (!waba) {
    throw new AppError(
      "INTERNAL",
      503,
      "Este numero nao tem a conta (WABA) cadastrada, entao nao da para listar os modelos.",
    );
  }

  const resposta = await fetch(
    `${BASE}/${versao}/${waba}/message_templates?fields=name,status,category,language,components&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!resposta.ok) throw new AppError("INTERNAL", 502, "Falha ao listar os modelos");

  const corpo = (await resposta.json()) as { data?: ModeloBruto[] };

  return (corpo.data ?? [])
    .filter((t) => t.status === "APPROVED")
    .map(paraModelo);
}

/**
 * Confere as credenciais da Meta antes de gravar o numero.
 *
 * ⚠️ Le o proprio numero (`GET /{phone_number_id}`) em vez de mandar mensagem.
 * Uma leitura valida o token, o Phone number ID e a versao da API de uma vez so,
 * sem gastar conversa e sem escrever para ninguem — testar enviando faria cada
 * cadastro disparar uma mensagem de verdade para alguem.
 *
 * ⚠️ NAO valida tudo. O App Secret so se prova quando a Meta assina uma entrega,
 * e o Verify token so quando ela chama a URL de callback: nenhum dos dois tem
 * como ser conferido daqui, e a tela precisa dizer isso em vez de deixar o
 * "tudo certo" parecer mais amplo do que e.
 */
export async function testarConta(cred: Credenciais): Promise<ResultadoDoTeste> {
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), 12_000);
  const inicio = performance.now();

  try {
    const resposta = await fetch(
      `${BASE}/${cred.apiVersao}/${encodeURIComponent(cred.phoneNumberId)}?fields=display_phone_number,verified_name`,
      { signal: controle.signal, headers: { Authorization: `Bearer ${cred.token}` } },
    );

    const corpo = (await resposta.json().catch(() => ({}))) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string; code?: number; type?: string };
    };

    /*
     * O que a chamada revelou, sempre: ate na falha.
     *
     * ⚠️ O `display_phone_number` e a informacao mais valiosa da tela inteira.
     * Token certo com o Phone number ID de OUTRA linha passa em qualquer
     * validacao de formato, e sem isto so se descobre quando o cliente errado
     * recebe a mensagem.
     */
    const infos = [
      { rotulo: "Phone number ID", valor: cred.phoneNumberId },
      ...(corpo.display_phone_number
        ? [{ rotulo: "Número", valor: corpo.display_phone_number }]
        : []),
      ...(corpo.verified_name ? [{ rotulo: "Nome verificado", valor: corpo.verified_name }] : []),
      { rotulo: "Versão da API", valor: cred.apiVersao },
      {
        rotulo: "Resposta",
        valor: corpo.error?.code
          ? `HTTP ${resposta.status}, código ${corpo.error.code}`
          : `HTTP ${resposta.status}`,
      },
      tempoDaChamada(inicio),
    ];

    if (resposta.ok) {
      return testeOk(
        corpo.display_phone_number
          ? "A Meta aceitou as credenciais. Confira abaixo se o número é este mesmo."
          : "A Meta aceitou o token e o Phone number ID.",
        infos,
      );
    }

    const detalhe = corpo.error?.message ?? null;
    const codigo = corpo.error?.code;

    // 190 e o codigo da Meta para token invalido ou expirado, e e o erro mais
    // comum aqui: o token do API Setup dura 24 horas.
    if (resposta.status === 401 || codigo === 190) {
      return testeFalhou(
        "A Meta recusou o token. Se ele veio do API Setup, dura só 24 horas: gere um permanente em Usuários do sistema.",
        detalhe,
        infos,
      );
    }

    if (resposta.status === 404 || codigo === 803 || codigo === 100) {
      return testeFalhou(
        "A Meta não encontrou este Phone number ID, ou o token não tem acesso a ele.",
        detalhe,
        infos,
      );
    }

    // Versao inexistente responde 400 dizendo isso no texto. Vale barrar: a
    // versao errada quebra TODO envio depois, e em silencio.
    if (/unsupported.*version|unknown version/i.test(detalhe ?? "")) {
      return testeFalhou(
        `A Meta não reconhece a versão ${cred.apiVersao} da API.`,
        detalhe,
        infos,
      );
    }

    if (resposta.status === 429) {
      return testeInconclusivo(
        "A Meta está limitando as chamadas agora. Dá para salvar e conferir depois.",
        detalhe,
        infos,
      );
    }

    return testeInconclusivo(
      "A Meta respondeu com um erro que não dá para interpretar. Dá para salvar assim mesmo.",
      detalhe,
      infos,
    );
  } catch (err) {
    return testeDeErroDeRede(err);
  } finally {
    clearTimeout(prazo);
  }
}

type ModeloBruto = {
  name: string;
  status: string;
  category?: string;
  language?: string;
  components?: { type: string; text?: string; format?: string }[];
};

function paraModelo(t: ModeloBruto): Modelo {
  const parte = (tipo: string) => t.components?.find((c) => c.type === tipo);
  const corpo = parte("BODY")?.text ?? "";

  /*
   * Conta os `{{n}}` DISTINTOS, nao as ocorrencias: um modelo que repete
   * `{{1}}` no corpo continua pedindo um parametro so, e contar duas vezes
   * faria a tela exigir um campo que a Meta rejeita.
   */
  const marcadores = new Set(corpo.match(/\{\{\s*\d+\s*\}\}/g) ?? []);

  return {
    nome: t.name,
    idioma: t.language ?? "pt_BR",
    categoria: t.category ?? "",
    corpo,
    cabecalho: parte("HEADER")?.text ?? null,
    rodape: parte("FOOTER")?.text ?? null,
    parametros: marcadores.size,
  };
}

/** POST em `/messages` com o tratamento de erro comum aos tres tipos de envio. */
async function despachar(
  url: string,
  token: string,
  corpoEnviado: unknown,
): Promise<string> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpoEnviado),
  });

  const corpo = (await resposta.json().catch(() => ({}))) as RespostaEnvio;

  if (!resposta.ok) {
    const detalhe = corpo.error?.error_data?.details ?? corpo.error?.message ?? "erro desconhecido";

    logger.error("falha ao enviar whatsapp", {
      status: resposta.status,
      codigo: corpo.error?.code,
      detalhe,
    });

    if (corpo.error?.code === 131047) {
      throw new BusinessRuleError(
        "A janela de 24 horas fechou. Agora so um modelo aprovado pode ser enviado.",
      );
    }

    throw new BusinessRuleError(`O WhatsApp recusou a mensagem: ${detalhe}`);
  }

  const wamid = corpo.messages?.[0]?.id;
  if (!wamid) throw new AppError("INTERNAL", 502, "A Meta aceitou a mensagem mas nao devolveu id");

  return wamid;
}

/**
 * Baixa midia recebida (imagem, audio, documento).
 *
 * Sao dois saltos: a Meta devolve uma URL assinada e curta, e o download dela
 * TAMBEM exige o Bearer. Nao ha como dar essa URL ao navegador; por isso o
 * arquivo passa pelo servidor.
 */
export async function baixarMidia(
  cred: Credenciais,
  midiaId: string,
): Promise<{ conteudo: ArrayBuffer; mime: string }> {
  const { token, apiVersao: versao } = cred;
  const cabecalho = { Authorization: `Bearer ${token}` };

  const meta = await fetch(`${BASE}/${versao}/${midiaId}`, { headers: cabecalho });
  if (!meta.ok) throw new AppError("NOT_FOUND", 404, "Midia nao encontrada");

  const { url, mime_type } = (await meta.json()) as { url?: string; mime_type?: string };
  if (!url) throw new AppError("NOT_FOUND", 404, "Midia sem URL de download");

  const arquivo = await fetch(url, { headers: cabecalho });
  if (!arquivo.ok) throw new AppError("INTERNAL", 502, "Falha ao baixar a midia");

  return {
    conteudo: await arquivo.arrayBuffer(),
    mime: mime_type ?? arquivo.headers.get("content-type") ?? "application/octet-stream",
  };
}

/**
 * Confere a assinatura `X-Hub-Signature-256` do webhook.
 *
 * Prova que o POST veio da Meta e nao de quem descobriu a URL. Precisa do corpo
 * CRU: `JSON.parse` seguido de `stringify` reordena chave e muda o HMAC.
 */
export function assinaturaConfere(
  appSecret: string | null,
  corpoCru: string,
  cabecalho: string | null,
): boolean {
  const segredo = appSecret;
  if (!segredo || !cabecalho?.startsWith("sha256=")) return false;

  const esperado = createHmac("sha256", segredo).update(corpoCru, "utf8").digest();
  const recebido = Buffer.from(cabecalho.slice("sha256=".length), "hex");

  // `timingSafeEqual` estoura com tamanhos diferentes, e a comparacao tem de ser
  // de tempo constante: a ingenua vaza a assinatura byte a byte.
  if (esperado.length !== recebido.length) return false;
  return timingSafeEqual(esperado, recebido);
}
