import { sessaoUI } from "@/shared/auth/sessao-ui";
import { projecao } from "@/modules/fluxo-caixa/fluxo-caixa.service";
import { dadosDaEmpresa } from "@/modules/empresa/empresa.repository";
import { hoje, type DataISO } from "@/shared/utils/datas";
import { SemEmpresa } from "../sem-empresa";
import { FluxoTela } from "./fluxo-tela";

export default async function FluxoDeCaixaPage() {
  const { ctx, usuarioNome } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * Doze meses a frente, e a tela estica.
   *
   * ⚠️ Nao e a ultima parcela cadastrada. Abrir ate agosto de 2027 por causa de
   * um consorcio faria a tabela nascer com vinte linhas, metade delas com uma
   * parcela so — e a pergunta de quem abre e sobre os proximos meses. Quem
   * precisa de mais estica no campo, ate o teto de dois anos.
   */
  const [inicial, empresa] = await Promise.all([
    projecao(ctx.empresaId, daquiAUmAno()),
    /*
     * A empresa vai junto porque a projecao IMPRIME: o PDF e montado no
     * navegador, e o cabecalho do documento nao pode depender de uma segunda ida
     * ao servidor no meio do clique de imprimir. Mesmo caminho da DRE.
     */
    dadosDaEmpresa(ctx.empresaId),
  ]);

  return (
    <FluxoTela
      inicial={inicial}
      empresa={empresa}
      emitidoPor={usuarioNome ?? ""}
    />
  );
}

function daquiAUmAno(): DataISO {
  const [ano, mes, dia] = hoje().split("-");
  return `${Number(ano) + 1}-${mes}-${dia}` as DataISO;
}
