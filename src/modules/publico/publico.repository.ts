import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/infra/config/env";
import type { Database } from "@/infra/supabase/database.types";
import { doBanco, type Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";
import type { CobrancaCompartilhada } from "@/modules/publico/publico.types";

/**
 * A parte do sistema que o CLIENTE ve, sem login.
 *
 * Cliente nao tem conta no VPay — cobrar nao pode exigir que ele entre num
 * sistema que nao e dele. O que substitui a sessao e o TOKEN do link: 128 bits
 * aleatorios, revogaveis zerando uma coluna.
 *
 * ⚠️ Client SEM cookie, de proposito. `serverClient()` le a sessao e a manda
 * junto; aqui isso seria pior que inutil — se um funcionario logado abrisse o
 * link do cliente, a consulta rodaria com os privilegios DELE, e o que a pagina
 * mostra deixaria de ser o que qualquer visitante ve. A pagina publica tem de se
 * comportar igual para todo mundo.
 *
 * ⚠️ Sem service role. Ela e a chave mestra do banco e nao existe neste projeto.
 * O acesso vem de duas funcoes `security definer` que devolvem so o necessario.
 */

function clienteAnonimo() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function cobrancaPorToken(token: string): Promise<CobrancaCompartilhada | null> {
  const supabase = clienteAnonimo();
  const { data, error } = await supabase.rpc("tickets_compartilhados", { p_token: token });

  if (error) throw error;

  const bruto = (data as CobrancaCompartilhada | null) ?? null;
  return bruto ? emCentavos(bruto) : null;
}

/**
 * ⚠️ O RPC devolve REAIS, e a tela formata CENTAVOS.
 *
 * Sem esta conversao a pagina mostrava uma parcela de 350,00 como "3,50" — cem
 * vezes menos, no documento que o cliente le para pagar.
 *
 * O bug passou porque a tela fazia `valor as Centavos`: o `as` desliga
 * justamente a checagem que o tipo marcado existe para fazer. A regra do
 * projeto vale aqui como em todo lugar — a conversao acontece na FRONTEIRA do
 * repositorio, e dali para dentro tudo e centavo.
 */
function emCentavos(c: CobrancaCompartilhada): CobrancaCompartilhada {
  return {
    ...c,
    tickets: c.tickets.map((t) => ({
      ...t,
      itens: t.itens.map((i) => ({
        ...i,
        valor: doBanco(i.valor),
        desconto: doBanco(i.desconto),
        acrescimo: doBanco(i.acrescimo),
        total: doBanco(i.total),
        despesas: i.despesas.map((d) => ({ ...d, valor: doBanco(d.valor) })),
      })),
      cobranca: t.cobranca.map((p) => ({ ...p, valor: doBanco(p.valor) })),
    })),
  };
}

export type ParcelaPublica = {
  faturaNumero: number;
  parcelaNumero: number;
  vencimento: DataISO | null;
  total: Centavos;
  pago: boolean;
  competenciaDe: DataISO | null;
  competenciaAte: DataISO | null;
  empresaNome: string;
  temNfs: boolean;
  temBoleto: boolean;
};

export async function parcelaPorToken(token: string): Promise<ParcelaPublica | null> {
  const supabase = clienteAnonimo();
  const { data, error } = await supabase.rpc("parcela_compartilhada", { p_token: token });

  if (error) throw error;
  const linha = (data ?? [])[0];
  if (!linha) return null;

  const dia = (v: string | null) => (v ? ((v.slice(0, 10)) as DataISO) : null);

  return {
    faturaNumero: linha.fatura_numero,
    parcelaNumero: linha.parcela_numero,
    vencimento: dia(linha.vencimento),
    total: doBanco(linha.total),
    pago: linha.pago,
    competenciaDe: dia(linha.competencia_de),
    competenciaAte: dia(linha.competencia_ate),
    empresaNome: linha.empresa_nome,
    temNfs: linha.tem_nfs,
    temBoleto: linha.tem_boleto,
  };
}

/**
 * Baixa o arquivo e devolve os bytes.
 *
 * A rota TRANSMITE o conteudo em vez de redirecionar para o Storage: assim o
 * caminho interno nunca chega ao navegador do cliente, e o unico endereco que
 * circula e o do link que nos demos — que da para revogar.
 */
export async function arquivoPorToken(
  token: string,
  tipo: "nfs" | "boleto",
): Promise<{ conteudo: Blob; nome: string } | null> {
  const supabase = clienteAnonimo();

  const { data: caminho, error } = await supabase.rpc("caminho_compartilhado", {
    p_token: token,
    p_tipo: tipo,
  });

  if (error) throw error;
  if (!caminho) return null;

  // Arquivo do legado: URL publica inteira, ja acessivel. Baixa direto.
  if (caminho.startsWith("http")) {
    const resposta = await fetch(caminho);
    if (!resposta.ok) return null;
    return { conteudo: await resposta.blob(), nome: nomeVisivel(tipo, caminho) };
  }

  const { data, error: erroDownload } = await supabase.storage
    .from("documentos")
    .download(caminho);

  if (erroDownload || !data) return null;
  return { conteudo: data, nome: nomeVisivel(tipo, caminho) };
}

/** O nome que o cliente ve ao salvar — nao o UUID interno. */
function nomeVisivel(tipo: "nfs" | "boleto", caminho: string): string {
  const extensao = (caminho.split(".").pop() ?? "pdf").toLowerCase().slice(0, 5);
  return `${tipo === "nfs" ? "nota-fiscal" : "boleto"}.${extensao}`;
}
