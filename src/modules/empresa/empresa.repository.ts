import { serverClient } from "@/infra/supabase/client";
import { primeiroPreenchido } from "@/shared/utils/texto";

/**
 * O emitente dos documentos: quem assina o cabecalho de todo PDF do sistema.
 *
 * ⚠️ Um arquivo so para a regra. Ela estava escrita identica em
 * `faturas.repository` e `tickets.repository`, e o extrato ia virar a terceira
 * copia. Cada uma e um lugar a mais para o cabecalho mudar num documento e nao
 * nos outros — e documento que sai para cliente com endereco divergente do
 * anterior nao se explica.
 *
 * ⚠️ A razao social cai para o fantasia e depois para o nome. O cadastro
 * herdado tem empresa com um dos tres vazio, e um cabecalho em branco no papel
 * e pior que o nome curto.
 */
export type EmpresaParaDocumento = {
  razaoSocial: string | null;
  endereco: string | null;
  cnpj: string | null;
  logo: string | null;
};

export async function dadosDaEmpresa(empresaId: number): Promise<EmpresaParaDocumento> {
  const supabase = await serverClient();
  const { data } = await supabase
    .from("empresas")
    .select("razaosocial, fantasia, nome, cnpj, logo, logradouro, bairro, cidade, cep")
    .eq("id", empresaId)
    .maybeSingle();

  const e = data as Record<string, string | null> | null;

  return {
    razaoSocial: primeiroPreenchido(e?.razaosocial, e?.fantasia, e?.nome),
    endereco: primeiroPreenchido(
      [e?.logradouro, e?.bairro, e?.cidade, e?.cep].filter(Boolean).join(" · "),
    ),
    cnpj: primeiroPreenchido(e?.cnpj),
    logo: primeiroPreenchido(e?.logo),
  };
}
