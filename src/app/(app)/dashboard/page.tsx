import { sessaoUI } from "@/shared/auth/sessao-ui";
import { projecao } from "@/modules/fluxo-caixa/fluxo-caixa.service";
import { relatorio } from "@/modules/relatorios/relatorios.service";
import { hoje, type DataISO } from "@/shared/utils/datas";
import { SemEmpresa } from "../sem-empresa";
import { Painel } from "./painel";

/**
 * A visao geral.
 *
 * ⚠️ Ela NAO tem consulta propria. Tudo que aparece aqui ja e respondido por
 * algum servico do sistema — a projecao de caixa, e os dois lados do relatorio
 * de parcelas. Escrever uma terceira consulta "do painel" criaria um quarto
 * lugar onde a mesma soma pode divergir, e o dia em que os numeros discordassem
 * ninguem saberia qual esta certo.
 *
 * ⚠️ As tres em PARALELO. Sao perguntas independentes; em fila, a tela abriria
 * na soma da mais lenta sem ganhar nada com isso.
 *
 * ⚠️ Nenhuma delas pode derrubar a pagina. Esta e a primeira tela depois do
 * login: com uma consulta lancando, a pessoa entraria no sistema e receberia um
 * erro em vez da casa. O painel sabe desenhar o pedaco que faltou.
 */
export default async function DashboardPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  const empresaId = ctx.empresaId;
  const [de, ate] = mesCorrente();

  const [caixa, aReceber, aPagar] = await Promise.all([
    projecao(empresaId, daquiASeisMeses()).catch(() => null),
    relatorio(empresaId, "receber", de, ate).catch(() => null),
    /*
     * ⚠️ `true` no fim: a fatura de CARTAO entra no que sai.
     *
     * O parametro e opcional e nasce falso, porque no PDF quem decide e quem
     * emite. Aqui nao ha quem decida: o painel afirma "a pagar no mes", e uma
     * fatura de cartao vencendo no dia 22 e dinheiro saindo no mes — omiti-la
     * fazia o numero fechar cinco mil abaixo do que a empresa realmente deve,
     * sem nada na tela dizendo que faltava alguma coisa.
     */
    relatorio(empresaId, "pagar", de, ate, true).catch(() => null),
  ]);

  return <Painel caixa={caixa} aReceber={aReceber} aPagar={aPagar} />;
}

/**
 * Primeiro e ultimo dia do mes de hoje.
 *
 * ⚠️ O mes INTEIRO, e nao "de hoje em diante". O que venceu na primeira quinzena
 * e continua em aberto e justamente o que se veio olhar; um periodo comecando
 * hoje esconderia o atraso, que e a informacao mais urgente da tela.
 */
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

/**
 * Seis meses de horizonte para a curva.
 *
 * ⚠️ Nao doze, como na emissao do fluxo. Aqui a curva e um resumo de canto de
 * tela: com doze pontos, os proximos tres meses — que sao os que se decide em
 * cima — ficam espremidos no primeiro quarto do desenho. Quem precisa do ano
 * inteiro emite o relatorio.
 */
function daquiASeisMeses(): DataISO {
  const [ano, mes, dia] = hoje().split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + 6, dia));

  return d.toISOString().slice(0, 10) as DataISO;
}
