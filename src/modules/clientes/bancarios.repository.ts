import { serverClient } from "@/infra/supabase/client";
import type { DadoBancarioDaPessoa } from "@/modules/clientes/clientes.types";

/**
 * Onde a empresa paga esta pessoa, ou de onde ela recebe.
 *
 * ⚠️ Nao e conta bancaria da EMPRESA. Aquelas tem saldo, limite e extrato, e
 * entram no fluxo de caixa; estas sao dado de terceiro, para preencher um
 * pagamento — e nunca para conciliar.
 */

export async function bancariosDaPessoa(clienteId: number): Promise<DadoBancarioDaPessoa[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientesbancarios")
    .select("id, banco, agencia, conta, tipo, titular, documento, pix_tipo, pix_chave, principal")
    .eq("fkCliente", clienteId)
    .eq("ativo", true)
    .order("principal", { ascending: false })
    .order("id");

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id as number,
    banco: (l.banco as string | null) || null,
    agencia: (l.agencia as string | null) || null,
    conta: (l.conta as string | null) || null,
    tipo: (l.tipo as string | null) || null,
    titular: (l.titular as string | null) || null,
    documento: (l.documento as string | null) || null,
    pixTipo: (l.pix_tipo as string | null) || null,
    pixChave: (l.pix_chave as string | null) || null,
    principal: Boolean(l.principal),
  }));
}

export async function criarBancario(
  clienteId: number,
  usuarioId: string,
  entrada: Omit<DadoBancarioDaPessoa, "id">,
): Promise<void> {
  const supabase = await serverClient();

  const existentes = await bancariosDaPessoa(clienteId);
  const principal = entrada.principal || existentes.length === 0;

  if (principal) {
    const { error: erroLimpar } = await supabase
      .from("clientesbancarios")
      .update({ principal: false })
      .eq("fkCliente", clienteId)
      .eq("principal", true);

    if (erroLimpar) throw erroLimpar;
  }

  const { error } = await supabase.from("clientesbancarios").insert({
    fkCliente: clienteId,
    fkUserCriacao: usuarioId,
    banco: entrada.banco,
    agencia: entrada.agencia,
    conta: entrada.conta,
    tipo: entrada.tipo,
    titular: entrada.titular,
    documento: entrada.documento,
    pix_tipo: entrada.pixTipo,
    pix_chave: entrada.pixChave,
    principal,
    ativo: true,
  });

  if (error) throw error;
}

/** ⚠️ Sem o `principal`, pelo mesmo motivo do endereco: ele e exclusivo. */
export async function atualizarBancario(
  clienteId: number,
  bancarioId: number,
  entrada: Omit<DadoBancarioDaPessoa, "id" | "principal">,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("clientesbancarios")
    .update({
      banco: entrada.banco,
      agencia: entrada.agencia,
      conta: entrada.conta,
      tipo: entrada.tipo,
      titular: entrada.titular,
      documento: entrada.documento,
      pix_tipo: entrada.pixTipo,
      pix_chave: entrada.pixChave,
    })
    .eq("fkCliente", clienteId)
    .eq("id", bancarioId);

  if (error) throw error;
}

/**
 * ⚠️ Desativa, e nao apaga.
 *
 * A conta que saiu do cadastro e a que consta num pagamento ja feito. Apagando,
 * a consulta de "para onde este dinheiro foi" fica sem resposta.
 */
export async function desativarBancario(clienteId: number, bancarioId: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("clientesbancarios")
    .update({ ativo: false })
    .eq("fkCliente", clienteId)
    .eq("id", bancarioId);

  if (error) throw error;
}
