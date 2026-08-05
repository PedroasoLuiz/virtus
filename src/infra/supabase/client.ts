import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/infra/config/env";
import type { Database } from "@/infra/supabase/database.types";

/**
 * Unica porta de entrada para o client do Supabase.
 *
 * Nenhum modulo fora de `*.repository.ts` importa este arquivo. Service,
 * controller e rota nao sabem que existe Supabase — trocar de banco deve tocar
 * apenas os repositorios.
 *
 * ⚠️ TODO acesso a dados passa pelo token do usuario, sob RLS.
 *
 * Nao existe mais client administrativo. O isolamento por empresa vive no banco
 * (policies de tenant aplicadas em 01/08/2026) e a aplicacao nao tem como
 * contorna-lo, nem por engano. Se um dia um webhook precisar rodar sem usuario,
 * o client de service role volta num arquivo proprio marcado `server-only` —
 * nunca neste, que e importado por tudo.
 */

/** Client do navegador. Sujeito a RLS. */
export function browserClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Client SEM sessao, para quem e chamado de fora: hoje so o webhook do
 * WhatsApp, que a Meta invoca sem cookie nenhum.
 *
 * Continua sendo o anon key sob RLS — nao e porta dos fundos. O webhook nao le
 * nem escreve tabela direto: chama uma funcao `security definer` que exige um
 * segredo compartilhado, mesma saida usada na pagina publica da cobranca.
 *
 * Existe separado de `serverClient()` porque `cookies()` num contexto sem
 * requisicao estoura, e o silencio do try/catch de escrita esconderia isso.
 */
export function anonClient() {
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}

/** Client de servidor com a sessao do usuario. Sujeito a RLS. */
export async function serverClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components nao podem escrever cookie. O middleware e quem
          // renova o token; aqui a falha e esperada e inofensiva.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* noop */
          }
        },
      },
    },
  );
}
