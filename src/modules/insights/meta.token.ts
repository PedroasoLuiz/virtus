import "server-only";
import { serverEnv } from "@/infra/config/env";
import { AppError } from "@/shared/errors/app-error";

/**
 * Troca de token com a Meta.
 *
 * ⚠️ `server-only`, e nao por simetria: esta e a UNICA parte do sistema que toca
 * no App Secret. Um import deste arquivo a partir de componente cliente colocaria
 * o segredo do app inteiro no bundle — e o App Secret nao e de uma conta, e de
 * todas: com ele se forja token em nome de qualquer cliente conectado.
 */

const VERSAO = "v21.0";

/**
 * Quantos dias antes do vencimento a renovacao acontece.
 *
 * ⚠️ Sete, e nao um. A renovacao so funciona com o token AINDA VALIDO: esperando
 * o ultimo dia, um fim de semana sem ninguem abrir a tela mata a conexao, e o
 * unico caminho de volta e colar token na mao de novo.
 */
const DIAS_PARA_RENOVAR = 7;

export function appConfigurado(): boolean {
  const env = serverEnv();
  return !!env.META_APP_ID && !!env.META_APP_SECRET;
}

type Trocado = { token: string; expiraEm: string | null };

/**
 * Converte um token de curta duracao em um de 60 dias.
 *
 * ⚠️ Isto NAO depende de App Review, e e a diferenca entre colar token de hora em
 * hora e colar uma vez por mes. O review governa quem pode autorizar o app; a
 * troca governa quanto dura o que ja foi autorizado.
 *
 * ⚠️ Trocar um token JA longo devolve outro de 60 dias, contados de agora. E o
 * que permite a rotacao automatica sem ninguem digitar nada.
 */
export async function trocarPorLongoPrazo(token: string): Promise<Trocado> {
  const env = serverEnv();

  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    /*
     * ⚠️ Sem app configurado o token segue como veio, e o fluxo NAO quebra.
     *
     * Colar token curto e o caminho de teste, e ele tem de continuar existindo
     * enquanto o app nao esta pronto. Falhar aqui trocaria uma limitacao
     * conhecida por uma tela que nao conecta mais nada.
     */
    return { token, expiraEm: null };
  }

  const p = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: token,
  });

  const resposta = await fetch(
    `https://graph.facebook.com/${VERSAO}/oauth/access_token?${p.toString()}`,
    { cache: "no-store" },
  );

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok || !corpo?.access_token) {
    const detalhe = corpo?.error?.message ?? "A Meta recusou a troca do token";
    throw new AppError("EXTERNAL_ERROR", 502, `Meta: ${detalhe}`);
  }

  return {
    token: corpo.access_token as string,
    expiraEm: vencimento(corpo.expires_in),
  };
}

/**
 * Quando o token novo vence.
 *
 * ⚠️ A Meta devolve `expires_in` em SEGUNDOS, e as vezes nao devolve nada — o
 * que significa "nao expira" (token de System User). Nulo aqui e a resposta
 * honesta para esse caso; inventar uma data faria a tela avisar de um
 * vencimento que nao existe.
 */
function vencimento(expiresIn: unknown): string | null {
  const segundos = Number(expiresIn);
  if (!Number.isFinite(segundos) || segundos <= 0) return null;

  return new Date(Date.now() + segundos * 1000).toISOString();
}

/** Se esta na hora de renovar. Sem prazo conhecido, nao ha o que renovar. */
export function precisaRenovar(expiraEm: string | null): boolean {
  if (!expiraEm) return false;

  const faltam = new Date(expiraEm).getTime() - Date.now();
  return faltam < DIAS_PARA_RENOVAR * 86_400_000;
}
