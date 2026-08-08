/**
 * Como uma conta bancaria se chama na tela.
 *
 * ⚠️ Um arquivo so para a regra. Ela estava escrita identica em tres modulos —
 * `contas`, `faturas` e `recebimentos` —, e cada copia era um lugar a mais para
 * o formato mudar em uma tela e nao nas outras. O mesmo dinheiro aparecia como
 * "Sicoob · 916-393-0" na baixa e "Sicoob Principal" no seletor, e nada dizia
 * que eram a mesma conta.
 */

import { nomeDoBanco } from "@/shared/domain/brasil";

/**
 * ⚠️ O NUMERO vem na frente do banco, e nao o contrario.
 *
 * Quem confere uma baixa contra o extrato tem duas contas do mesmo banco na
 * frente, e o que as separa e o numero: com o banco primeiro, as duas linhas
 * comecam igual e a leitura so descobre a diferenca no fim. O numero e o dado
 * que discrimina, e por isso ele abre.
 *
 * ⚠️ O banco entra pelo NOME, sem o codigo da Febraban. "916-393-0 | 756 -
 * Sicoob" poe dois numeros na mesma celula e o olho para para descobrir qual
 * deles e a conta.
 *
 * ⚠️ O nome CURTO da lista ganha do apelido, e o apelido e a rede de seguranca.
 *
 * Nos oito cadastros que existem, `apelido` guarda o nome longo da Febraban
 * ("BANCO SICOOB S.A.", "BCO COOPERATIVO SICREDI S.A.") e `banco` guarda so o
 * codigo. O nome longo numa celula de tabela empurra o numero da conta para
 * fora, e "S.A." nao ajuda ninguem a reconhecer a conta; a lista responde
 * "Sicoob". Quando o codigo nao esta na lista, o apelido volta a valer, porque
 * um nome comprido ainda identifica e um codigo solto nao.
 */
export function nomeDaConta(dados: {
  id?: number | null;
  apelido?: string | null;
  banco?: string | null;
  conta?: string | null;
}): string {
  const numero = dados.conta?.trim() || null;
  const apelido = dados.apelido?.trim() || null;
  const banco = nomeDoBanco(dados.banco) ?? apelido;

  if (numero && banco) return `${numero} | ${banco}`;

  // Sem o par, vale o que houver de mais reconhecivel. O id fecha a lista
  // porque uma conta sem apelido, sem banco e sem numero ainda precisa de um
  // nome para aparecer num seletor.
  return apelido ?? numero ?? banco ?? (dados.id != null ? `Conta ${dados.id}` : "");
}
