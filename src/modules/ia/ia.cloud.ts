import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import type { CredencialIA } from "@/modules/ia/ia.types";

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
 * Tenta cada credencial na ordem ate uma responder.
 *
 * ⚠️ E o motivo de existir mais de uma. Provedor cai, estoura cota e recusa
 * conteudo, e nesses tres casos a resposta certa nao e desistir do atendimento:
 * e perguntar ao proximo da fila. Todas falharem devolve `null`, que o servico
 * ja trata como "sem resposta automatica".
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

    logger.warn("provedor de IA nao respondeu, tentando o proximo", {
      provedor: cred.provedor,
      modelo: cred.modelo,
      ordem: cred.ordem,
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
  return cred.provedor === "gemini"
    ? peloGemini<T>(cred, instrucao, conversa, esquema, imagens)
    : peloCompativel<T>(cred, instrucao, conversa, esquema, imagens);
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

export { AppError };
