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

import { documentoValido, ehCpf, limparDocumento } from "@/shared/domain/documento";

export { documentoValido };

export type PendenciaDoCadastro = "documento" | "data";

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
  return ehCpf(limparDocumento(cnpj ?? ""));
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
