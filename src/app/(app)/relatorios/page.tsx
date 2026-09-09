import { sessaoUI } from "@/shared/auth/sessao-ui";
import { dadosDaEmpresa } from "@/modules/empresa/empresa.repository";
import { SemEmpresa } from "../sem-empresa";
import { RelatoriosTela } from "./relatorios-tela";

/**
 * A pasta de relatorios.
 *
 * ⚠️ NAO carrega relatorio nenhum. Antes esta pagina abria ja com o contas a
 * receber do mes corrente consultado — e agora ela e uma lista de quatro
 * documentos que a pessoa vem escolher. Carregar um deles por antecipacao seria
 * pagar a consulta mais cara da tela para mostrar uma grade de icones.
 *
 * A empresa vai junto porque os documentos IMPRIMEM: o PDF e montado no
 * navegador, e o cabecalho nao pode depender de uma segunda ida ao servidor no
 * meio do clique de emitir.
 */
export default async function RelatoriosPage() {
  const { ctx, usuarioNome } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const empresa = await dadosDaEmpresa(ctx.empresaId);

  return <RelatoriosTela empresa={empresa} emitidoPor={usuarioNome ?? ""} />;
}
