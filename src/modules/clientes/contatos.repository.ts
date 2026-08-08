import { serverClient } from "@/infra/supabase/client";
import type { ContatoDaPessoa } from "@/modules/clientes/clientes.types";

/**
 * Telefones e e-mails de uma pessoa.
 *
 * ⚠️ Arquivo proprio, e nao mais um trecho do repositorio de clientes. Aquele
 * arquivo tinha oitocentas linhas e cinco assuntos — pessoa, contato, endereco,
 * conta e acesso —, e mexer no telefone obrigava a rolar por tudo para achar as
 * quarenta linhas que interessavam.
 */

/**
 * ⚠️ A RLS de `clientescontatos` casa pela pessoa dona, entao ela ja recusa
 * cadastro de outra empresa. O `empresaId` nao entra na consulta por isso: ele
 * seria uma segunda regra de isolamento para manter em dia com a policy.
 */
export async function contatosDaPessoa(clienteId: number): Promise<ContatoDaPessoa[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientescontatos")
    .select("id, tipo, valor, rotulo, responsavel")
    .eq("fkCliente", clienteId)
    .eq("ativo", true)
    .order("tipo")
    .order("id");

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id as number,
    tipo: l.tipo as ContatoDaPessoa["tipo"],
    valor: l.valor as string,
    rotulo: (l.rotulo as string | null) || null,
    responsavel: (l.responsavel as string | null) || null,
  }));
}

export async function criarContato(
  clienteId: number,
  usuarioId: string,
  entrada: {
    tipo: "telefone" | "email";
    valor: string;
    rotulo: string | null;
    responsavel: string | null;
  },
): Promise<ContatoDaPessoa> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientescontatos")
    .insert({
      fkCliente: clienteId,
      fkUserCriacao: usuarioId,
      tipo: entrada.tipo,
      valor: entrada.valor,
      rotulo: entrada.rotulo,
      responsavel: entrada.responsavel,
      ativo: true,
    })
    .select("id, tipo, valor, rotulo, responsavel")
    .single();

  if (error) throw error;

  return {
    id: data.id as number,
    tipo: data.tipo as ContatoDaPessoa["tipo"],
    valor: data.valor as string,
    rotulo: (data.rotulo as string | null) || null,
    responsavel: (data.responsavel as string | null) || null,
  };
}

/**
 * Corrige um contato que ja existe.
 *
 * ⚠️ O TIPO nao muda. Um telefone digitado na aba de e-mail se resolve apagando e
 * cadastrando do lado certo; deixar a linha trocar de lado faria o principal do
 * cadastro apontar para um valor que sumiu da lista onde estava.
 */
export async function atualizarContato(
  clienteId: number,
  contatoId: number,
  entrada: { valor: string; rotulo: string | null; responsavel: string | null },
): Promise<ContatoDaPessoa> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientescontatos")
    .update({
      valor: entrada.valor,
      rotulo: entrada.rotulo,
      responsavel: entrada.responsavel,
    })
    .eq("fkCliente", clienteId)
    .eq("id", contatoId)
    .select("id, tipo, valor, rotulo, responsavel")
    .single();

  if (error) throw error;

  return {
    id: data.id as number,
    tipo: data.tipo as ContatoDaPessoa["tipo"],
    valor: data.valor as string,
    rotulo: (data.rotulo as string | null) || null,
    responsavel: (data.responsavel as string | null) || null,
  };
}

/**
 * ⚠️ Desativa, e nao apaga.
 *
 * O telefone que saiu do cadastro e o mesmo que aparece numa conversa antiga do
 * WhatsApp e num envio de cobranca de tres meses atras. Apagando, aquele
 * historico perde a referencia de quem era.
 */
export async function desativarContato(clienteId: number, contatoId: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("clientescontatos")
    .update({ ativo: false })
    .eq("fkCliente", clienteId)
    .eq("id", contatoId);

  if (error) throw error;
}
