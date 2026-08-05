import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/infra/config/env";
import type { Database } from "@/infra/supabase/database.types";

/**
 * Client do Supabase para componente de cliente.
 *
 * Existe separado de `client.ts` porque aquele importa `next/headers`, e
 * `"use client"` marca o modulo inteiro: bastaria um componente de tela
 * importa-lo para o build quebrar arrastando `cookies()` para o navegador.
 *
 * Uso unico e deliberado: assinar o Realtime. Leitura e escrita continuam indo
 * pela API — o painel nao consulta tabela direto, senao a regra da janela de 24h
 * teria duas implementacoes.
 *
 * Sujeito a RLS como qualquer outro: a assinatura do Realtime so entrega linha
 * que a policy do usuario deixa passar.
 */
export function browserSupabase() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
