import { resolveMx } from "node:dns/promises";
import { logger } from "@/shared/utils/logger";

/**
 * O dominio do e-mail aceita correio?
 *
 * ⚠️ Isto verifica o DOMINIO, e nao a caixa. Saber se "financeiro@" existe dentro
 * de "empresa.com.br" exige bater na porta do servidor de destino, e servidor
 * serio responde "talvez" para qualquer nome para nao virar lista de e-mails
 * validos. O que da para afirmar de fora e se ha para onde entregar.
 *
 * ⚠️ Na duvida, PASSA. DNS cai, demora e mente; recusando o cadastro por um
 * timeout, a tela culparia a pessoa pelo problema da rede. So barra quando a
 * resposta e definitiva: o dominio existe e nao tem para onde entregar, ou nao
 * existe.
 */
export async function dominioAceitaEmail(email: string): Promise<boolean> {
  const dominio = email.split("@")[1]?.trim().toLowerCase();
  if (!dominio) return false;

  try {
    const mx = await Promise.race([
      resolveMx(dominio),
      // Meio segundo. Passado isso a resposta nao chega a tempo de servir a quem
      // esta esperando o botao de salvar responder.
      new Promise<null>((ok) => setTimeout(() => ok(null), 500)),
    ]);

    // `null` e o estouro do tempo: sem resposta, nao ha o que afirmar.
    if (mx === null) return true;

    return mx.length > 0;
  } catch (erro) {
    const codigo = (erro as { code?: string }).code;

    // ENOTFOUND e NXDOMAIN sao respostas: este dominio nao existe.
    if (codigo === "ENOTFOUND" || codigo === "ENODATA") return false;

    logger.warn("dns.mx.indefinido", { dominio, codigo });
    return true;
  }
}
