import { createHash } from "node:crypto";
import { serverClient } from "@/infra/supabase/client";
import { ConflictError } from "@/shared/errors/app-error";

/**
 * Idempotencia de escrita financeira.
 *
 * ⚠️ O caso que isto resolve NAO e o duplo clique. Esse a tela ja cobre
 * travando o botao enquanto salva. O caso e o pedido que chega ao servidor, e
 * grava, e cuja RESPOSTA se perde no caminho de volta: quem esta na frente do
 * computador ve o erro de rede, clica de novo, e a mesma baixa entra duas vezes
 * sobre as mesmas parcelas. A segunda passa por todas as validacoes, porque do
 * ponto de vista do servidor ela e um pedido legitimo.
 *
 * ⚠️ Reservar e um INSERT, e nao um "consultar e depois gravar". Duas requisicoes
 * simultaneas passariam as duas pela consulta antes de qualquer uma gravar. O
 * indice unico e quem decide: uma grava, a outra leva 23505 e vira reenvio.
 */

/** Erro do Postgres para violacao de chave unica. */
const CHAVE_DUPLICADA = "23505";

export type Reserva =
  | { tipo: "seguir"; id: number }
  | { tipo: "repetido"; http: number; corpo: unknown }
  /** Chegou de novo antes de a primeira terminar. */
  | { tipo: "em_andamento" };

/**
 * Marca a chave como em uso, ou conta o que ja aconteceu com ela.
 *
 * A impressao do corpo entra junto porque a mesma chave com corpo diferente e
 * erro do cliente, e nao reenvio: devolver a resposta antiga esconderia dele que
 * a segunda intencao nunca foi gravada.
 */
export async function reservar(
  empresaId: number,
  chave: string,
  rota: string,
  corpo: unknown,
): Promise<Reserva> {
  const supabase = await serverClient();
  const impressao = impressaoDe(corpo);

  const { data, error } = await supabase
    .from("idempotencia")
    .insert({ fkEmpresa: empresaId, chave, rota, impressao })
    .select("id")
    .single();

  if (!error) return { tipo: "seguir", id: data.id };
  if (error.code !== CHAVE_DUPLICADA) throw error;

  const { data: anterior, error: erroLeitura } = await supabase
    .from("idempotencia")
    .select("impressao, resposta, http")
    .eq("fkEmpresa", empresaId)
    .eq("chave", chave)
    .maybeSingle();

  if (erroLeitura) throw erroLeitura;

  // A chave existe mas a linha nao aparece: ela e de outra empresa, e a RLS a
  // escondeu. Tratar como conflito e o certo — nao se pode confirmar nem negar.
  if (!anterior) throw new ConflictError("Esta chave de idempotência já foi usada");

  if (anterior.impressao !== impressao) {
    throw new ConflictError(
      "Esta chave de idempotência já foi usada com outros dados. Gere uma nova para enviar algo diferente.",
    );
  }

  // Sem resposta guardada, a primeira ainda esta correndo. Nao se devolve
  // sucesso aqui: a baixa pode ainda falhar, e o cliente ficaria achando que
  // gravou.
  if (anterior.http == null) return { tipo: "em_andamento" };

  return { tipo: "repetido", http: anterior.http, corpo: anterior.resposta };
}

/** Guarda o que a rota respondeu, para o reenvio receber o mesmo. */
export async function concluir(id: number, http: number, corpo: unknown): Promise<void> {
  const supabase = await serverClient();

  await supabase
    .from("idempotencia")
    .update({ http, resposta: corpo as never, concluido_em: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Solta a chave quando a operacao falhou.
 *
 * ⚠️ Falha nao se guarda. Guardando, o cliente que corrigiu o valor e tentou de
 * novo com a mesma chave receberia o erro antigo de volta, para sempre. Chave
 * queimada e chave que impede o acerto.
 */
export async function liberar(id: number): Promise<void> {
  const supabase = await serverClient();
  await supabase.from("idempotencia").delete().eq("id", id);
}

/**
 * A impressao do corpo.
 *
 * ⚠️ Chaves ordenadas antes do hash: `{a,b}` e `{b,a}` sao o mesmo pedido, e sem
 * a ordenacao o reenvio de um cliente que serializa diferente pareceria um corpo
 * novo — e seria recusado como conflito.
 */
function impressaoDe(corpo: unknown): string {
  return createHash("sha256").update(estavel(corpo)).digest("hex");
}

function estavel(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(estavel).join(",")}]`;

  const entradas = Object.entries(valor as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${estavel(v)}`);

  return `{${entradas.join(",")}}`;
}
