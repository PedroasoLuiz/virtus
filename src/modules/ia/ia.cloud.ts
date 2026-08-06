import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import type { CredencialIA } from "@/modules/ia/ia.types";
import {
  testeDeErroDeRede,
  testeFalhou,
  testeInconclusivo,
  testeOk,
  tempoDaChamada,
  type ResultadoDoTeste,
} from "@/shared/domain/teste-conexao";

/**
 * Porta de saida para o provedor de IA.
 *
 * Mesma posicao de `whatsapp.cloud.ts`: fica ao lado do repositorio, nao dentro
 * dele. `repository` e a porta do banco, e misturar as duas faria o service
 * depender de uma palavra so para duas redes com falhas muito diferentes.
 *
 * ⚠️ Nunca importar de componente de cliente: a chave nao pode ir para o bundle.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * OpenAI e DeepSeek falam o MESMO protocolo, o `chat/completions`. Muda a base
 * e o nome do modelo, entao um cliente serve os dois: escrever dois seria
 * manter duas copias do mesmo tratamento de erro.
 */
const BASE_COMPATIVEL: Record<"openai" | "deepseek", string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
};

/**
 * Quanto esperamos pela resposta.
 *
 * ⚠️ Isto roda depois do 200 do webhook, entao demorar nao faz a Meta reentregar
 * — mas faz a funcao serverless ficar de pe pagando tempo, e faz o cliente
 * esperar por uma resposta que ja perdeu a graca. Vinte segundos e o teto do
 * util: passou disso, atender por pessoa e melhor mesmo.
 */
const LIMITE_MS = 20_000;

type RespostaGemini = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; status?: string };
  promptFeedback?: { blockReason?: string };
};

/**
 * Pede ao modelo uma resposta em JSON, conforme o esquema.
 *
 * `responseSchema` e nao "por favor devolva JSON" no texto: o modelo passa a ser
 * OBRIGADO pelo formato do lado do provedor. Sem isso ele devolve markdown, ou
 * um campo a mais, ou o JSON dentro de uma frase — e o `parse` quebra em
 * producao, nao no teste.
 */
/**
 * Uma imagem que vai junto da conversa.
 *
 * ⚠️ Vai INLINE, em base64, e nao por URL. A midia da Meta so abre com o token
 * no cabecalho, e o link expira em cinco minutos: mandar a URL faria o provedor
 * receber um 401 ou um link morto.
 */
export type ImagemParaOModelo = {
  mime: string;
  conteudo: ArrayBuffer;
};

/**
 * Fala com a credencial do numero.
 *
 * ⚠️ A lista tem ZERO ou UMA credencial, e nao uma fila. Desde que cada numero
 * aponta para a sua chave, por causa do rateio, nao ha reserva para cair:
 * provedor fora do ar deixa aquele numero sem resposta automatica ate voltar.
 * E deliberado — gasto atribuido ao setor errado e pior que resposta que nao
 * saiu.
 *
 * Continua recebendo lista porque o servico nao precisa saber disso: vazio ja
 * significa "nao ha o que tentar", e devolver `null` cai no mesmo caminho de
 * "sem resposta automatica" que ja existia.
 */
export async function responderComReserva<T>(
  credenciais: CredencialIA[],
  instrucao: string,
  conversa: string,
  esquema: Record<string, unknown>,
  imagens: ImagemParaOModelo[] = [],
): Promise<T | null> {
  for (const cred of credenciais) {
    const r = await responderEmJson<T>(cred, instrucao, conversa, esquema, imagens);
    if (r != null) return r;

    logger.warn("provedor de IA nao respondeu", {
      provedor: cred.provedor,
      modelo: cred.modelo,
    });
  }

  return null;
}

export async function responderEmJson<T>(
  cred: CredencialIA,
  instrucao: string,
  conversa: string,
  esquema: Record<string, unknown>,
  imagens: ImagemParaOModelo[] = [],
): Promise<T | null> {
  if (cred.provedor === "gemini") {
    return peloGemini<T>(cred, instrucao, conversa, esquema, imagens);
  }

  if (cred.provedor === "anthropic") {
    return peloAnthropic<T>(cred, instrucao, conversa, esquema, imagens);
  }

  return peloCompativel<T>(cred, instrucao, conversa, esquema, imagens);
}

/**
 * O caminho `messages`, da Anthropic.
 *
 * Cliente proprio porque nada bate com os outros dois: a chave vai em
 * `x-api-key` e nao em `Authorization`, a versao da API e um cabecalho, e a
 * instrucao do sistema e um campo de primeiro nivel, nao uma mensagem.
 *
 * ⚠️ O formato do JSON e obtido por FERRAMENTA, e nao por `response_format`.
 * Declarar uma unica ferramenta e forcar o uso dela e o jeito de a Anthropic
 * garantir esquema: sem isso ela devolve o JSON dentro de um texto explicativo,
 * e o `parse` quebra em producao, nao no teste.
 */
async function peloAnthropic<T>(
  cred: CredencialIA,
  instrucao: string,
  conversa: string,
  esquema: Record<string, unknown>,
  imagens: ImagemParaOModelo[],
): Promise<T | null> {
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), LIMITE_MS);

  try {
    const conteudo: Record<string, unknown>[] = [{ type: "text", text: conversa }];

    for (const i of imagens) {
      conteudo.push({
        type: "image",
        source: {
          type: "base64",
          media_type: i.mime,
          data: Buffer.from(i.conteudo).toString("base64"),
        },
      });
    }

    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controle.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cred.chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cred.modelo,
        max_tokens: 1024,
        temperature: 0.2,
        system: instrucao,
        messages: [{ role: "user", content: conteudo }],
        tools: [{ name: "responder", description: "Devolve a resposta.", input_schema: esquema }],
        tool_choice: { type: "tool", name: "responder" },
      }),
    });

    const corpo = (await resposta.json().catch(() => ({}))) as {
      content?: { type: string; input?: unknown }[];
      error?: { message?: string };
    };

    if (!resposta.ok) {
      // A chave NAO entra no log, nem truncada.
      logger.error("provedor de IA recusou a chamada", {
        provedor: cred.provedor,
        status: resposta.status,
        modelo: cred.modelo,
        detalhe: corpo.error?.message,
      });
      return null;
    }

    // O objeto ja vem estruturado no `input` da ferramenta: nao ha texto para
    // interpretar, e por isso nao ha `JSON.parse` aqui.
    const uso = corpo.content?.find((c) => c.type === "tool_use");
    return (uso?.input as T) ?? null;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("provedor de IA passou do tempo", {
        provedor: cred.provedor,
        modelo: cred.modelo,
        limiteMs: LIMITE_MS,
      });
      return null;
    }

    logger.error("falha ao falar com o provedor de IA", {
      provedor: cred.provedor,
      erro: err instanceof Error ? err.message : err,
    });
    return null;
  } finally {
    clearTimeout(prazo);
  }
}

/**
 * O caminho `chat/completions`, de OpenAI e DeepSeek.
 *
 * `json_schema` com `strict` e o equivalente ao `responseSchema` do Gemini: o
 * formato passa a ser obrigacao do provedor, e nao um pedido no texto.
 */
async function peloCompativel<T>(
  cred: CredencialIA,
  instrucao: string,
  conversa: string,
  esquema: Record<string, unknown>,
  imagens: ImagemParaOModelo[],
): Promise<T | null> {
  const base = BASE_COMPATIVEL[cred.provedor as "openai" | "deepseek"];
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), LIMITE_MS);

  try {
    const conteudo: Record<string, unknown>[] = [{ type: "text", text: conversa }];

    for (const i of imagens) {
      conteudo.push({
        type: "image_url",
        image_url: { url: `data:${i.mime};base64,${Buffer.from(i.conteudo).toString("base64")}` },
      });
    }

    const resposta = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controle.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cred.chave}`,
      },
      body: JSON.stringify({
        model: cred.modelo,
        messages: [
          { role: "system", content: instrucao },
          { role: "user", content: conteudo },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "resposta",
            strict: true,
            // `additionalProperties: false` e exigencia do modo estrito da
            // OpenAI. O esquema do Gemini nao pede, entao entra aqui.
            schema: { ...esquema, additionalProperties: false },
          },
        },
        temperature: 0.2,
      }),
    });

    const corpo = (await resposta.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!resposta.ok) {
      // A chave NAO entra no log, nem truncada.
      logger.error("provedor de IA recusou a chamada", {
        provedor: cred.provedor,
        status: resposta.status,
        modelo: cred.modelo,
        detalhe: corpo.error?.message,
      });
      return null;
    }

    const texto = corpo.choices?.[0]?.message?.content;
    if (!texto) return null;

    return JSON.parse(texto) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("provedor de IA passou do tempo", {
        provedor: cred.provedor,
        modelo: cred.modelo,
        limiteMs: LIMITE_MS,
      });
      return null;
    }

    logger.error("falha ao falar com o provedor de IA", {
      provedor: cred.provedor,
      erro: err instanceof Error ? err.message : err,
    });
    return null;
  } finally {
    clearTimeout(prazo);
  }
}

async function peloGemini<T>(
  cred: CredencialIA,
  instrucao: string,
  conversa: string,
  esquema: Record<string, unknown>,
  imagens: ImagemParaOModelo[] = [],
): Promise<T | null> {
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), LIMITE_MS);

  try {
    const resposta = await fetch(
      `${BASE}/models/${encodeURIComponent(cred.modelo)}:generateContent`,
      {
        method: "POST",
        signal: controle.signal,
        headers: {
          "Content-Type": "application/json",
          // Cabecalho e nao query string: chave em URL vaza para log de acesso,
          // de proxy e de erro.
          "x-goog-api-key": cred.chave,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instrucao }] },
          contents: [
            {
              role: "user",
              parts: [
                { text: conversa },
                ...imagens.map((i) => ({
                  inlineData: {
                    mimeType: i.mime,
                    data: Buffer.from(i.conteudo).toString("base64"),
                  },
                })),
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: esquema,
            // Triagem nao pede criatividade: quer a mesma leitura para a mesma
            // frase, todo dia.
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        }),
      },
    );

    const corpo = (await resposta.json().catch(() => ({}))) as RespostaGemini;

    if (!resposta.ok) {
      // A chave NAO entra no log, nem truncada.
      logger.error("provedor de IA recusou a chamada", {
        status: resposta.status,
        modelo: cred.modelo,
        detalhe: corpo.error?.message,
      });
      return null;
    }

    if (corpo.promptFeedback?.blockReason) {
      logger.warn("provedor de IA bloqueou o conteudo", {
        motivo: corpo.promptFeedback.blockReason,
      });
      return null;
    }

    const texto = corpo.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) return null;

    return JSON.parse(texto) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("provedor de IA passou do tempo", { modelo: cred.modelo, limiteMs: LIMITE_MS });
      return null;
    }

    /*
     * Devolve `null` em vez de propagar.
     *
     * O bot e um COMPLEMENTO: falhar nele nao pode derrubar o recebimento da
     * mensagem, que ja aconteceu e esta gravado. Sem resposta automatica, a
     * conversa simplesmente espera uma pessoa — que e o comportamento de antes
     * do bot existir.
     */
    logger.error("falha ao falar com o provedor de IA", {
      erro: err instanceof Error ? err.message : err,
    });
    return null;
  } finally {
    clearTimeout(prazo);
  }
}

/**
 * Bate na porta do provedor com a chave e o modelo que a pessoa acabou de
 * digitar, antes de gravar.
 *
 * ⚠️ E uma geracao de verdade, minuscula, e nao um "listar modelos". Listar
 * confirma a chave e nao diz nada sobre o nome do modelo — que e justamente o
 * campo de texto livre, o que erra. Uma geracao de um token so valida os dois
 * de uma vez, e custa fracao de centavo.
 *
 * O prazo e menor que o do atendimento: aqui tem gente olhando a tela esperando.
 */
const LIMITE_TESTE_MS = 12_000;

export async function testarCredencial(cred: CredencialIA): Promise<ResultadoDoTeste> {
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), LIMITE_TESTE_MS);
  const inicio = performance.now();

  try {
    const { status, detalhe } = await bater(cred, controle.signal);

    /*
     * O que a chamada revelou, sempre: ate na falha.
     *
     * ⚠️ Numa falha, o status e o tempo sao o que separa "a chave esta errada"
     * de "a rede esta ruim". Mostrar so na vitoria esconderia justamente quando
     * eles importam.
     */
    const infos = [
      { rotulo: "Provedor", valor: cred.provedor },
      { rotulo: "Modelo", valor: cred.modelo },
      { rotulo: "Resposta", valor: `HTTP ${status}` },
      tempoDaChamada(inicio),
    ];

    if (status === 200) {
      return testeOk("Chave e modelo confirmados. O provedor respondeu.", infos);
    }

    /*
     * 401 e 403: a chave nao serve. Nao ha o que salvar aqui.
     *
     * Alguns provedores respondem 400 para chave malformada, mas 400 tambem
     * cobre corpo invalido nosso — por isso ele NAO entra como definitivo.
     */
    if (status === 401 || status === 403) {
      return testeFalhou("O provedor recusou esta chave.", detalhe, infos);
    }

    // 404: o nome do modelo nao existe nesse provedor. O erro mais comum, e o
    // motivo de o teste existir.
    if (status === 404 || (status === 400 && /model|not found/i.test(detalhe ?? ""))) {
      return testeFalhou(
        `O provedor não conhece o modelo "${cred.modelo}". Confira o nome exato.`,
        detalhe,
        infos,
      );
    }

    /*
     * 429 diz que a chave e VALIDA: ela foi reconhecida e barrada por cota.
     * Barrar o cadastro aqui seria impedir de configurar quem estourou a cota
     * do mes, que e exatamente quem precisa mexer na configuracao.
     */
    if (status === 429) {
      return testeInconclusivo(
        "A chave foi reconhecida, mas está sem cota agora. Dá para salvar; o atendimento volta quando a cota voltar.",
        detalhe,
        infos,
      );
    }

    return testeInconclusivo(
      "O provedor respondeu com um erro que não dá para interpretar. Dá para salvar assim mesmo.",
      detalhe,
      infos,
    );
  } catch (err) {
    return testeDeErroDeRede(err);
  } finally {
    clearTimeout(prazo);
  }
}

/** A menor chamada possivel em cada protocolo. So o status importa. */
async function bater(
  cred: CredencialIA,
  signal: AbortSignal,
): Promise<{ status: number; detalhe: string | null }> {
  const comum = { method: "POST" as const, signal };

  const resposta =
    cred.provedor === "gemini"
      ? await fetch(`${BASE}/models/${encodeURIComponent(cred.modelo)}:generateContent`, {
          ...comum,
          headers: { "Content-Type": "application/json", "x-goog-api-key": cred.chave },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ok" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        })
      : cred.provedor === "anthropic"
        ? await fetch("https://api.anthropic.com/v1/messages", {
            ...comum,
            headers: {
              "Content-Type": "application/json",
              "x-api-key": cred.chave,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: cred.modelo,
              max_tokens: 1,
              messages: [{ role: "user", content: "ok" }],
            }),
          })
        : await fetch(`${BASE_COMPATIVEL[cred.provedor as "openai" | "deepseek"]}/chat/completions`, {
            ...comum,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cred.chave}`,
            },
            body: JSON.stringify({
              model: cred.modelo,
              max_tokens: 1,
              messages: [{ role: "user", content: "ok" }],
            }),
          });

  if (resposta.ok) return { status: resposta.status, detalhe: null };

  const corpo = (await resposta.json().catch(() => ({}))) as { error?: { message?: string } };

  // A chave NAO entra no log, nem truncada.
  logger.info("teste de credencial de IA recusado", {
    provedor: cred.provedor,
    modelo: cred.modelo,
    status: resposta.status,
  });

  return { status: resposta.status, detalhe: corpo.error?.message ?? null };
}

export { AppError };
