import "server-only";
import { AppError } from "@/shared/errors/app-error";

/**
 * Envio de e-mail, pelo Resend.
 *
 * Substitui o EmailJS do legado, que e feito para rodar no NAVEGADOR — a chave
 * dele e publica por design. Aqui a chave e secreta e nunca leva prefixo
 * `NEXT_PUBLIC_`: com ele, o Next embute a variavel no bundle do cliente.
 *
 * `import "server-only"` no topo faz o build QUEBRAR se algum componente de tela
 * importar este arquivo por engano. E a rede de seguranca que impede o vazamento
 * de acontecer em silencio.
 */

const ENDPOINT = "https://api.resend.com/emails";

export type Anexo = {
  nome: string;
  /** Conteudo do arquivo. Vai no proprio e-mail, nao como link. */
  conteudo: ArrayBuffer;
};

export async function enviarEmail(entrada: {
  para: string[];
  assunto: string;
  html: string;
  anexos?: Anexo[];
  responderPara?: string;
}): Promise<string> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.RESEND_FROM;

  /*
   * Falta de configuracao e erro de OPERACAO, nao do usuario — por isso a
   * mensagem diz o que fazer em vez de "nao foi possivel enviar".
   */
  if (!chave) {
    throw new AppError(
      "INTERNAL",
      500,
      "Envio de e-mail nao configurado: falta RESEND_API_KEY",
    );
  }
  if (!remetente) {
    throw new AppError(
      "INTERNAL",
      500,
      "Envio de e-mail nao configurado: falta RESEND_FROM com um dominio verificado",
    );
  }
  if (entrada.para.length === 0) {
    throw new AppError("VALIDATION_ERROR", 422, "Nenhum destinatario");
  }

  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remetente,
      to: entrada.para,
      subject: entrada.assunto,
      html: entrada.html,
      reply_to: entrada.responderPara,
      attachments: entrada.anexos?.map((a) => ({
        filename: a.nome,
        content: Buffer.from(a.conteudo).toString("base64"),
      })),
    }),
  });

  const corpo = (await resposta.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!resposta.ok) {
    /*
     * A mensagem do Resend vem para a tela porque ela e acionavel: "domain is
     * not verified", "you can only send to your own address". Escondida atras de
     * um "falha no envio", cada uma dessas viraria meia hora de investigacao.
     */
    throw new AppError(
      "INTERNAL",
      502,
      corpo?.message ?? "O provedor de e-mail recusou o envio",
    );
  }

  return corpo?.id ?? "";
}
