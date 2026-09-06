import { sessaoUI } from "@/shared/auth/sessao-ui";
import { dre } from "@/modules/dre/dre.service";
import { dadosDaEmpresa } from "@/modules/empresa/empresa.repository";
import { hoje } from "@/shared/utils/datas";
import { SemEmpresa } from "../sem-empresa";
import { DreTela } from "./dre-tela";

export default async function DrePage() {
  const { ctx, usuarioNome } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * O ano corrente, e nao o ultimo com movimento.
   *
   * Abrir no ano cheio mais recente pareceria mais util, mas esconderia um ano
   * corrente vazio — que e informacao, e nao ausencia dela.
   */
  const ano = Number(hoje().slice(0, 4));

  /*
   * O emitente e os dados da empresa vao junto porque a DRE imprime: o PDF e
   * montado no navegador, e o cabecalho do documento nao pode depender de uma
   * segunda ida ao servidor no meio do clique de imprimir.
   */
  const [inicial, empresa] = await Promise.all([
    dre(ctx.empresaId, ano),
    dadosDaEmpresa(ctx.empresaId),
  ]);

  return (
    <DreTela
      inicial={inicial}
      empresa={empresa}
      emitidoPor={usuarioNome ?? ""}
    />
  );
}
