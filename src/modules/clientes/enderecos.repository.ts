import { serverClient } from "@/infra/supabase/client";
import type { EnderecoDaPessoa } from "@/modules/clientes/clientes.types";

/** Os enderecos de uma pessoa. Um deles e o principal, e sai na nota fiscal. */

export async function enderecosDaPessoa(clienteId: number): Promise<EnderecoDaPessoa[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientesenderecos")
    .select("id, cep, logradouro, numero, complemento, bairro, cidade, uf, principal")
    .eq("fkCliente", clienteId)
    // O principal primeiro: e o que a nota fiscal usa, e o que se procura ao abrir.
    .order("principal", { ascending: false })
    .order("id");

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id as number,
    cep: (l.cep as string | null) || null,
    logradouro: (l.logradouro as string | null) || null,
    numero: (l.numero as string | null) || null,
    complemento: (l.complemento as string | null) || null,
    bairro: (l.bairro as string | null) || null,
    cidade: (l.cidade as string | null) || null,
    uf: (l.uf as string | null) || null,
    principal: Boolean(l.principal),
  }));
}

export async function criarEndereco(
  clienteId: number,
  usuarioId: string,
  entrada: Omit<EnderecoDaPessoa, "id">,
): Promise<void> {
  const supabase = await serverClient();

  /*
   * ⚠️ O primeiro endereco nasce PRINCIPAL, mesmo sem ninguem pedir.
   *
   * "Nenhum principal" e um estado que nao serve a ninguem: a nota fiscal
   * precisa de um endereco, e com todos iguais o sistema escolheria sozinho de
   * um jeito que a tela nao mostra.
   */
  const existentes = await enderecosDaPessoa(clienteId);
  const principal = entrada.principal || existentes.length === 0;

  if (principal) await limparPrincipalDeEndereco(clienteId);

  const { error } = await supabase.from("clientesenderecos").insert({
    fkCliente: clienteId,
    fkUserCriacao: usuarioId,
    cep: entrada.cep,
    logradouro: entrada.logradouro,
    numero: entrada.numero,
    complemento: entrada.complemento,
    bairro: entrada.bairro,
    cidade: entrada.cidade,
    uf: entrada.uf,
    principal,
  });

  if (error) throw error;
}

export async function definirEnderecoPrincipal(
  clienteId: number,
  enderecoId: number,
): Promise<void> {
  const supabase = await serverClient();

  await limparPrincipalDeEndereco(clienteId);

  const { error } = await supabase
    .from("clientesenderecos")
    .update({ principal: true })
    .eq("fkCliente", clienteId)
    .eq("id", enderecoId);

  if (error) throw error;
}

/** ⚠️ Um principal por pessoa: o anterior cai antes de o novo subir. */
async function limparPrincipalDeEndereco(clienteId: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("clientesenderecos")
    .update({ principal: false })
    .eq("fkCliente", clienteId)
    .eq("principal", true);

  if (error) throw error;
}

/**
 * ⚠️ O `principal` NAO vem daqui.
 *
 * Ele e exclusivo entre os enderecos da pessoa, e mexer nele exige derrubar o
 * anterior: quem cuida disso e `definirEnderecoPrincipal`. Aceitando o campo aqui,
 * uma correcao de numero da casa poderia deixar dois principais.
 */
export async function atualizarEndereco(
  clienteId: number,
  enderecoId: number,
  entrada: Omit<EnderecoDaPessoa, "id" | "principal">,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("clientesenderecos")
    .update({
      cep: entrada.cep,
      logradouro: entrada.logradouro,
      numero: entrada.numero,
      complemento: entrada.complemento,
      bairro: entrada.bairro,
      cidade: entrada.cidade,
      uf: entrada.uf,
    })
    .eq("fkCliente", clienteId)
    .eq("id", enderecoId);

  if (error) throw error;
}

export async function excluirEndereco(clienteId: number, enderecoId: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("clientesenderecos")
    .delete()
    .eq("fkCliente", clienteId)
    .eq("id", enderecoId);

  if (error) throw error;
}
