/**
 * O que falta num cadastro de pessoa para ele poder virar fatura.
 *
 * ⚠️ O cadastro NASCE incompleto de proposito. Um orcamento para quem ainda nao
 * passou o CPF precisa de alguem para apontar, e exigir o documento na hora do
 * cadastro fazia o atendimento inventar numero para o botao liberar. Documento
 * inventado e pior do que documento em falta: ele passa despercebido.
 *
 * ⚠️ Quem cobra e o FATURAMENTO, e por isso a regra vive aqui e nao na tela. E o
 * momento em que o dado passa a ser necessario de verdade, e a tela de pessoas
 * so mostra o mesmo aviso lendo a mesma funcao.
 */

import { cnpjValido, cpfValido } from "@/shared/validators/comuns";

export type PendenciaDoCadastro = "documento" | "data";

/**
 * O documento e um documento de verdade?
 *
 * ⚠️ Confere os DIGITOS VERIFICADORES, e nao so o tamanho. O cadastro herdado tem
 * "00.000.000/0000-00" escrito em dois registros: catorze digitos, e nada. Pela
 * contagem, aquilo passava por CNPJ completo e liberava o faturamento de um
 * cliente sem documento nenhum.
 */
export function documentoValido(bruto: string | null): boolean {
  const d = (bruto ?? "").replace(/\D/g, "");

  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);

  return false;
}

export type CadastroConferivel = {
  cnpj: string | null;
  dataNascimento: string | null;
};

export function pendenciasDoCadastro(p: CadastroConferivel): PendenciaDoCadastro[] {
  const pendencias: PendenciaDoCadastro[] = [];

  if (!documentoValido(p.cnpj)) pendencias.push("documento");

  if (!p.dataNascimento) pendencias.push("data");

  return pendencias;
}

/** Se a pessoa e fisica, para o texto pedir nascimento em vez de fundacao. */
export function ehPessoaFisica(cnpj: string | null): boolean {
  return (cnpj ?? "").replace(/\D/g, "").length === 11;
}

/**
 * O que falta, em palavras, para caber numa frase.
 *
 * ⚠️ Diz o QUE falta, e nao "cadastro incompleto". Quem recebe o aviso na hora de
 * faturar precisa saber o que ir buscar, e uma mensagem generica manda a pessoa
 * abrir a ficha para descobrir sozinha.
 */
export function pendenciasEmPalavras(
  pendencias: PendenciaDoCadastro[],
  fisica: boolean,
): string {
  const nomes = pendencias.map((p) =>
    p === "documento" ? (fisica ? "o CPF" : "o CNPJ") : fisica ? "a data de nascimento" : "a data de fundação",
  );

  if (nomes.length === 0) return "";
  if (nomes.length === 1) return nomes[0];

  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
