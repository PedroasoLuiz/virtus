import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarCentros } from "@/modules/cadastros/cadastros.service";
import { SemEmpresa } from "../sem-empresa";
import { PessoasTela } from "./pessoas-tela";

/**
 * ⚠️ A pagina NAO carrega mais as pessoas.
 *
 * Ela trazia duzentas de uma vez, e a tela buscava, ordenava e paginava na
 * memoria: funcionava com cem e mentia com trezentas. Agora quem pagina e busca
 * e o banco, e a tela pede a pagina que precisa.
 *
 * Os centros continuam vindo daqui: sao poucos, mudam raramente e o formulario
 * precisa deles abertos.
 */
export default async function PessoasPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const centros = await listarCentros(ctx.empresaId);

  // So os de RECEITA: cliente e origem de entrada, e oferecer um centro de
  // despesa aqui jogaria receita na coluna errada do DRE.
  const doCliente = centros
    .filter((c) => c.ativo && c.tipo === "RECEITA")
    .map((c) => ({ id: c.id, descricao: c.descricao }));

  return <PessoasTela centros={doCliente} />;
}
