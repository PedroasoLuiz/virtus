import { serverClient } from "@/infra/supabase/client";
import type { Persona } from "@/modules/atendimento/personas.types";

/**
 * Porta de dados das personas.
 *
 * Direto na tabela, sob RLS: quem le e escreve aqui e o usuario logado, e a
 * policy de tenant ja separa as empresas. Funcao `security definer` so existe
 * do lado do bot, que roda sem sessao.
 */

const COLUNAS = 'id, "fkConta", "fkSetor", nome, descricao, pode_resolver, permissoes, ativo';

type Linha = {
  id: number;
  fkConta: number | null;
  fkSetor: number | null;
  nome: string;
  descricao: string | null;
  pode_resolver: string | null;
  permissoes: unknown;
  ativo: boolean;
};

function paraPersona(l: Linha): Persona {
  return {
    id: l.id,
    contaId: l.fkConta,
    setorId: l.fkSetor,
    nome: l.nome,
    descricao: l.descricao,
    podeResolver: l.pode_resolver,
    // `jsonb` chega como `unknown`: so lista de texto interessa, e vazio e o
    // estado honesto para qualquer outra coisa.
    permissoes: Array.isArray(l.permissoes) ? (l.permissoes as string[]) : [],
    ativo: l.ativo,
  };
}

export async function listar(empresaId: number): Promise<Persona[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("iapersonas")
    .select(COLUNAS)
    .eq("fkEmpresa", empresaId)
    .order("nome");

  if (error) throw error;
  return (data ?? []).map((l) => paraPersona(l as unknown as Linha));
}

export async function salvar(
  empresaId: number,
  usuarioId: string,
  entrada: {
    id: number | null;
    contaId: number | null;
    setorId: number | null;
    nome: string;
    descricao: string | null;
    podeResolver: string | null;
    permissoes: string[];
    ativo: boolean;
  },
): Promise<Persona> {
  const supabase = await serverClient();

  const campos = {
    fkEmpresa: empresaId,
    fkConta: entrada.contaId,
    fkSetor: entrada.setorId,
    nome: entrada.nome,
    descricao: entrada.descricao,
    pode_resolver: entrada.podeResolver,
    permissoes: entrada.permissoes,
    ativo: entrada.ativo,
  };

  const { data, error } = entrada.id
    ? await supabase
        .from("iapersonas")
        .update({ ...campos, updated_at: new Date().toISOString(), fkUserModificacao: usuarioId })
        .eq("id", entrada.id)
        .eq("fkEmpresa", empresaId)
        .select(COLUNAS)
        .single()
    : await supabase
        .from("iapersonas")
        .insert({ ...campos, fkUserCriacao: usuarioId })
        .select(COLUNAS)
        .single();

  if (error) throw error;
  return paraPersona(data as unknown as Linha);
}

export async function excluir(empresaId: number, id: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("iapersonas")
    .delete()
    .eq("id", id)
    .eq("fkEmpresa", empresaId);

  if (error) throw error;
}

/**
 * Os setores da empresa, so id e nome.
 *
 * Mora aqui e nao num modulo proprio porque hoje o unico lugar que precisa
 * escolher setor e o cadastro de persona. Quando a fila de atendimento tiver
 * tela, ela leva isto junto.
 */
export async function listarSetores(
  empresaId: number,
): Promise<{ id: number; nome: string }[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("setores")
    .select("id, nome")
    .eq("fkEmpresa", empresaId)
    .eq("ativo", true)
    .order("nome");

  if (error) throw error;
  return data ?? [];
}
