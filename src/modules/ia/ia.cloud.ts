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

export async function responderEmJson<T>(
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
