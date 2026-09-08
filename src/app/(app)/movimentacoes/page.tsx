import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listar as listarMovimentacoes } from "@/modules/movimentacoes/movimentacoes.service";
import { listar as listarContas } from "@/modules/contas/contas.repository";
import { dadosDaEmpresa } from "@/modules/empresa/empresa.repository";
import { hoje, type DataISO } from "@/shared/utils/datas";
import { SemEmpresa } from "../sem-empresa";
import { MovimentacoesTela } from "./movimentacoes-tela";

/**
 * Transferencias entre as contas da propria empresa.
 *
 * ⚠️ Nao e recebimento nem pagamento: nada entra ou sai da empresa, o dinheiro
 * so troca de lugar. As duas pontas nascem amarradas pelo mesmo identificador, e
 * a DRE as ignora pelo `tipo` — contadas, elas inflariam faturamento e custo ao
 * mesmo tempo, pelo mesmo valor.
 */
export default async function MovimentacoesPage() {
  const { ctx, usuarioNome } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /* Os noventa dias que se conferem: transferencia se olha perto do extrato, e
     um ano inteiro traria centenas de linhas para achar a da semana passada. */
  const [de, ate] = ultimosNoventaDias();

  const [inicial, contas, empresa] = await Promise.all([
    listarMovimentacoes(ctx.empresaId, de, ate),
    listarContas(ctx.empresaId),
    /*
     * A empresa vai junto porque a tela IMPRIME: o PDF e montado no navegador, e
     * o cabecalho do documento nao pode depender de uma segunda ida ao servidor
     * no meio do clique de imprimir. Mesmo caminho da DRE e do fluxo.
     */
    dadosDaEmpresa(ctx.empresaId),
  ]);

  return (
    <MovimentacoesTela
      inicial={inicial}
      contas={contas}
      de={de}
      ate={ate}
      empresa={empresa}
      emitidoPor={usuarioNome ?? ""}
    />
  );
}

function ultimosNoventaDias(): [DataISO, DataISO] {
  const fim = hoje();
  const inicio = new Date(Date.parse(fim) - 90 * 24 * 60 * 60 * 1000);
  return [inicio.toISOString().slice(0, 10) as DataISO, fim];
}
