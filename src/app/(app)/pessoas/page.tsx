import { sessaoUI } from "@/shared/auth/sessao-ui";
import { SemEmpresa } from "../sem-empresa";
import { PessoasTela } from "./pessoas-tela";

/**
 * ⚠️ A pagina NAO carrega mais as pessoas.
 *
 * Ela trazia duzentas de uma vez, e a tela buscava, ordenava e paginava na
 * memoria: funcionava com cem e mentia com trezentas. Agora quem pagina e busca
 * e o banco, e a tela pede a pagina que precisa.
 *
 * ⚠️ Os centros de custo tambem sairam daqui. Eles eram da EMPRESA, e a ficha da
 * pessoa nao amarra mais o cadastro a nossa contabilidade: sao duas
 * contabilidades diferentes, e o cliente tera os proprios centros quando isso
 * for feito.
 */
export default async function PessoasPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  return <PessoasTela />;
}
