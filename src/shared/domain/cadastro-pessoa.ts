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

export type PendenciaDoCadastro = "documento" | "data";

export type CadastroConferivel = {
  cnpj: string | null;
  dataNascimento: string | null;
};

export function pendenciasDoCadastro(p: CadastroConferivel): PendenciaDoCadastro[] {
  const pendencias: PendenciaDoCadastro[] = [];

  /*
   * ⚠️ Conta DIGITO, e nao caracteres.
   *
   * O legado guarda documento formatado, com ponto e barra, e um cadastro antigo
   * chega a ter a palavra "Nao informado" escrita na coluna. Onze ou catorze
   * digitos e a unica leitura que separa documento de recado.
   */
  const digitos = (p.cnpj ?? "").replace(/\D/g, "");
  if (digitos.length !== 11 && digitos.length !== 14) pendencias.push("documento");

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
