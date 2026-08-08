import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";

/**
 * O que a ficha da pessoa edita, em texto.
 *
 * ⚠️ Tudo string, inclusive o que e numero e data no banco. Campo de formulario
 * guarda o que a pessoa digitou, e "" no meio de uma digitacao nao e zero nem
 * data invalida: e alguem ainda escrevendo. A conversao acontece uma vez, na
 * hora de mandar.
 *
 * ⚠️ Mora fora do drawer porque a aba de Informacoes tambem le e escreve nele. No
 * arquivo do drawer, a aba precisaria importar do proprio pai — e um arquivo de
 * quinhentas linhas exportando um tipo para o filho e o comeco de uma bola de
 * barbante.
 */
export type Form = {
  razao: string;
  nomeFantasia: string;
  cnpj: string;
  dataNascimento: string;
  email: string;
  contato: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  regimeTributario: string;
  classificacaoTributaria: string;
  papeis: PapelPessoa[];
  ativo: boolean;
  /**
   * O endereco que a consulta do CNPJ trouxe.
   *
   * ⚠️ So no cadastro NOVO, e so por causa dela. Depois que a pessoa existe, o
   * endereco se mexe na aba dele, que sabe de principal, de varios e de exclusao.
   */
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  } | null;
};

export function inicial(cliente: Cliente | null): Form {
  return {
    razao: cliente?.razao ?? "",
    nomeFantasia: cliente?.nomeFantasia ?? "",
    cnpj: cliente?.cnpj ?? "",
    dataNascimento: cliente?.dataNascimento ?? "",
    email: cliente?.email ?? "",
    contato: cliente?.contato ?? "",
    inscricaoMunicipal: cliente?.inscricaoMunicipal ?? "",
    inscricaoEstadual: cliente?.inscricaoEstadual ?? "",
    regimeTributario: cliente?.regimeTributario ?? "",
    classificacaoTributaria: cliente?.classificacaoTributaria ?? "",
    papeis: cliente?.papeis ?? ["cliente"],
    ativo: cliente?.ativo ?? true,
    endereco: null,
  };
}

