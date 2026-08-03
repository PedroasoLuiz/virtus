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
 * Nao ha `SUPABASE_SERVICE_ROLE_KEY` aqui de proposito: a aplicacao roda
 * inteira sob o token do usuario, com RLS. Chave que nao existe no contrato
 * nao vaza por descuido.
 */
const serverSchema = z.object({
  WHATSAPP_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_ID: z.string().min(1).optional(),
  EMAILJS_SERVICE_ID: z.string().min(1).optional(),
  EMAILJS_TEMPLATE_ID: z.string().min(1).optional(),
  EMAILJS_USER_ID: z.string().min(1).optional(),
  APP_URL: z.url().default("http://localhost:3000"),
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
