import { serverClient } from "@/infra/supabase/client";

/**
 * Vinculo do usuario com a empresa.
 *
 * Responde "este usuario pertence a esta empresa?". Os modulos liberados vem do
 * plano e sao resolvidos pelo modulo `plataforma` — aqui so o tenant.
 */

export type Acesso = {
  empresaId: number;
  empresaNome: string;
};

export async function buscarAcesso(usuarioId: string, empresaId: number): Promise<Acesso | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuariosxempresas")
    .select("empresas!inner(id, fantasia, razaosocial, ativo)")
    .eq("fkUser", usuarioId)
    .eq("fkEmpresa", empresaId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const empresa = data.empresas as unknown as {
    id: number;
    fantasia: string | null;
    razaosocial: string | null;
    ativo: boolean | null;
  };

  if (empresa.ativo === false) return null;

  return {
    empresaId: empresa.id,
    empresaNome: empresa.fantasia ?? empresa.razaosocial ?? `Empresa ${empresa.id}`,
  };
}
