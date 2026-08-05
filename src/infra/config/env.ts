import { z } from "zod";

/**
 * Leitura e validacao de ambiente. Unico lugar do sistema que le process.env.
 *
 * Config de servidor falha alto: um deploy sem variavel obrigatoria quebra com
 * mensagem clara, em vez de dar `undefined` dentro de uma chamada de rede tres
 * camadas abaixo.
 *
 * A config do Supabase e a excecao: em vez de derrubar o processo, expoe
 * `supabaseConfigurado`. Isso deixa a UI subir e mostrar a tela de configuracao
 * num clone recem-clonado, enquanto a API continua recusando qualquer chamada.
 * Falha visivel, nao silenciosa.
 */

const supabaseSchema = z.object({
  url: z.url(),
  anonKey: z.string().min(20),
});

const supabaseParse = supabaseSchema.safeParse({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const supabaseConfigurado = supabaseParse.success;

export const publicEnv = {
  get NEXT_PUBLIC_SUPABASE_URL(): string {
    if (!supabaseParse.success) throw new Error(MSG_SUPABASE);
    return supabaseParse.data.url;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY(): string {
    if (!supabaseParse.success) throw new Error(MSG_SUPABASE);
    return supabaseParse.data.anonKey;
  },
};

const MSG_SUPABASE =
  "Supabase nao configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (ver .env.example)";

/**
 * Variavel opcional que aceita a linha EM BRANCO como "nao configurada".
 *
 * `.env.example` lista toda chave com o valor vazio, e o `.env.local` nasce de
 * uma copia dele — entao `CHAVE=` e o estado NORMAL de quem ainda nao preencheu.
 * Sem este preprocess, `z.string().min(1).optional()` recebe `""` (que nao e
 * `undefined`), reprova, e `serverEnv()` derruba a configuracao INTEIRA: uma
 * linha em branco de integracao que ninguem usa vira 500 em toda rota do
 * sistema, com "Erro interno" e nenhuma pista.
 *
 * Custou exatamente isso ao ligar o WhatsApp, com `WHATSAPP_APP_SECRET=` vazio.
 */
const opcional = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().min(1).optional(),
);

/**
 * Nao ha `SUPABASE_SERVICE_ROLE_KEY` aqui de proposito: a aplicacao roda
 * inteira sob o token do usuario, com RLS. Chave que nao existe no contrato
 * nao vaza por descuido.
 */
const serverSchema = z.object({
  /**
   * Segredo que protege as funcoes de ingestao do webhook.
   *
   * Espelha `whatsappconfig.segredo` no banco. E o UNICO segredo de WhatsApp
   * que ainda vive no ambiente: token, App Secret e verify token passaram a ser
   * por conta, guardados no `supabase_vault` e cadastrados na tela.
   *
   * Ele nao identifica conta nem autentica a Meta — quem faz isso e o HMAC com
   * o App Secret daquela conta. O papel dele e so impedir que alguem de posse
   * do anon key, que e publico e vai no bundle, chame as funcoes direto.
   */
  WHATSAPP_WEBHOOK_SEGREDO: opcional,
  EMAILJS_SERVICE_ID: opcional,
  EMAILJS_TEMPLATE_ID: opcional,
  EMAILJS_USER_ID: opcional,
  APP_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().default("http://localhost:3000")),
});

let cache: z.infer<typeof serverSchema> | null = null;

/** Config server-side. Lazy porque nao pode ser avaliada no bundle do cliente. */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() nao pode ser chamado no cliente");
  }
  if (!cache) {
    const r = serverSchema.safeParse(process.env);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Configuracao de servidor invalida: ${campos}`);
    }
    cache = r.data;
  }
  return cache;
}

export const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "local") as
  | "production"
  | "preview"
  | "local";

export const isProd = appEnv === "production";
