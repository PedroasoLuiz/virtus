import "server-only";
import type { PainelDoCliente } from "@/modules/insights/insights.types";

/**
 * Cache curto do painel, na memoria do servidor.
 *
 * O painel e caro: uma rodada e desempenho, campanhas, criativos, Pagina, perfil
 * e publicacoes, vezes o numero de contas do cliente. E o dado do dia de ontem
 * nao muda mais; o de hoje muda devagar, e a propria Meta atrasa metrica em ate
 * 48 horas. Repetir a chamada a cada ida e volta entre Anuncios e Organico paga
 * caro por uma resposta identica.
 *
 * ⚠️ A EMPRESA entra na chave, sempre. Sem ela, o painel de um cliente serviria
 * a outra empresa que tivesse um cliente de mesmo id — e o isolamento por tenant
 * do sistema inteiro seria contornado por um cache.
 *
 * ⚠️ Nada disso vai para o BANCO, e isso continua sendo decisao. Guardado, o
 * numero envelhece e alguem apresenta o de tres semanas atras achando que e o de
 * agora; e passaria a existir uma segunda verdade para explicar quando nao
 * batesse com o Gerenciador de Anuncios. Cache expira sozinho; tabela, nao.
 *
 * ⚠️ O TOKEN nao entra na chave nem no valor. Ele nem chega aqui: quem guarda e
 * o resultado ja montado, sem credencial nenhuma dentro.
 */

const VALIDADE_MS = 5 * 60_000;

/**
 * ⚠️ Teto de entradas, porque isto vive na memoria do processo. Sem limite, uma
 * pessoa varrendo periodos deixaria um painel por combinacao de data guardado
 * ate o processo morrer.
 */
const TETO = 200;

type Entrada = {
  /** A promessa, e nao o valor. Ver abaixo. */
  resposta: Promise<PainelDoCliente>;
  em: number;
};

const memoria = new Map<string, Entrada>();

function chave(empresaId: number, cliente: string, de: string, ate: string): string {
  return `${empresaId}|${cliente}|${de}|${ate}`;
}

/**
 * Devolve o painel guardado, ou chama `montar` e guarda o resultado.
 *
 * ⚠️ Guarda a PROMESSA, e nao o valor pronto. Duas pessoas abrindo o mesmo
 * cliente ao mesmo tempo caem na mesma promessa e a Meta e consultada uma vez;
 * guardando so o valor, as duas veriam o cache vazio e as duas rodadas
 * aconteceriam.
 *
 * ⚠️ Promessa que FALHA e removida na hora. Guardada, o erro da Meta ficaria
 * grudado por cinco minutos e a tela continuaria quebrada depois de o problema
 * ter passado — que e o pior tipo de cache.
 */
export async function painelComCache(
  empresaId: number,
  cliente: string,
  de: string,
  ate: string,
  montar: () => Promise<PainelDoCliente>,
): Promise<PainelDoCliente> {
  const k = chave(empresaId, cliente, de, ate);
  const agora = Date.now();

  const guardada = memoria.get(k);
  if (guardada && agora - guardada.em < VALIDADE_MS) return guardada.resposta;

  const resposta = montar();
  memoria.set(k, { resposta, em: agora });

  resposta.catch(() => {
    // So apaga se ainda for esta: uma consulta nova pode ter tomado o lugar.
    if (memoria.get(k)?.resposta === resposta) memoria.delete(k);
  });

  if (memoria.size > TETO) limpar(agora);

  return resposta;
}

/**
 * ⚠️ Tira as vencidas primeiro, e so entao as mais velhas. Removendo pela ordem
 * de insercao direto, uma entrada recem-criada sairia enquanto uma vencida fica.
 */
function limpar(agora: number) {
  for (const [k, e] of memoria) {
    if (agora - e.em >= VALIDADE_MS) memoria.delete(k);
  }

  for (const k of memoria.keys()) {
    if (memoria.size <= TETO) break;
    memoria.delete(k);
  }
}
