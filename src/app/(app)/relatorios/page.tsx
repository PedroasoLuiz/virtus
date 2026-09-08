import { sessaoUI } from "@/shared/auth/sessao-ui";
import { relatorio } from "@/modules/relatorios/relatorios.service";
import { dadosDaEmpresa } from "@/modules/empresa/empresa.repository";
import { hoje, type DataISO } from "@/shared/utils/datas";
import { SemEmpresa } from "../sem-empresa";
import { RelatoriosTela } from "./relatorios-tela";

export default async function RelatoriosPage() {
  const { ctx, usuarioNome } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * Abre no MES CORRENTE, do dia 1 ao ultimo.
   *
   * ⚠️ E nao "de hoje em diante". O relatorio serve para fechar o mes: o que
   * venceu na primeira quinzena e continua em aberto e justamente o que se veio
   * cobrar, e um periodo comecando hoje o esconderia.
   */
  const [de, ate] = mesCorrente();

  const [inicial, empresa] = await Promise.all([
    relatorio(ctx.empresaId, "receber", de, ate),
    /*
     * A empresa vai junto porque o relatorio IMPRIME: o PDF e montado no
     * navegador, e o cabecalho do documento nao pode depender de uma segunda ida
     * ao servidor no meio do clique de imprimir. Mesmo caminho da DRE.
     */
    dadosDaEmpresa(ctx.empresaId),
  ]);

  return (
    <RelatoriosTela
      inicial={inicial}
      empresa={empresa}
      emitidoPor={usuarioNome ?? ""}
    />
  );
}

/** Primeiro e ultimo dia do mes de hoje. */
function mesCorrente(): [DataISO, DataISO] {
  const [ano, mes] = hoje().split("-").map(Number);

  /* Dia zero do mes SEGUINTE e o ultimo dia deste: evita a tabela de quantos
     dias tem cada mes, e acerta fevereiro bissexto sozinho. */
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const doisDigitos = String(mes).padStart(2, "0");

  return [
    `${ano}-${doisDigitos}-01` as DataISO,
    `${ano}-${doisDigitos}-${String(ultimo).padStart(2, "0")}` as DataISO,
  ];
}
