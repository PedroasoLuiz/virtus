/** Contratos de dominio do modulo clientes. */

/**
 * A tabela `clientes` do banco herdado serve tres papeis com flags booleanas
 * (cliente / fornecedor / colaborador). O dominio expoe isso como uma lista de
 * papeis, que e como o negocio realmente pensa.
 */
export type PapelPessoa = "cliente" | "fornecedor" | "colaborador";

export type Cliente = {
  id: number;
  razao: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  email: string | null;
  contato: string | null;
  responsavel: string | null;
  papeis: PapelPessoa[];
  grupoId: number | null;
  /** Todo cliente tem um. O padrao e o "Geral" da empresa. */
  centroCustoId: number | null;
  centroCustoNome: string | null;
  ativo: boolean;
};

export type ClienteNovo = {
  razao: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  email?: string | null;
  contato?: string | null;
  responsavel?: string | null;
  papeis: PapelPessoa[];
  grupoId?: number | null;
  /** Omitido, o gatilho `trg_clientes_centro_padrao` preenche com o "Geral". */
  centroCustoId?: number | null;
};

/**
 * Um telefone ou e-mail da pessoa.
 *
 * ⚠️ Tabela propria, e nao mais campos em `clientes`. Uma empresa tem o e-mail do
 * financeiro, o do comercial e o telefone de cada um: guardar UM de cada obrigava
 * a escolher qual perder. Os campos `contato` e `email` de `clientes` continuam
 * existindo e passam a significar o PRINCIPAL — o que a cobranca usa.
 */
export type ContatoDaPessoa = {
  id: number;
  tipo: "telefone" | "email";
  valor: string;
  /** "Financeiro", "Comercial"… O que este contato e dentro da empresa. */
  rotulo: string | null;
};

/** Por onde a tabela de pessoas pode ordenar. */
export type CampoDeOrdem =
  | "id"
  | "razao"
  | "cnpj"
  | "contato"
  | "email"
  | "responsavel";

/** Quantas pessoas ha em cada papel. Alimenta o filtro. */
export type ContagemPorPapel = {
  total: number;
  cliente: number;
  fornecedor: number;
  colaborador: number;
};

export type FiltroClientes = {
  busca?: string;
  papel?: PapelPessoa;
  ativo?: boolean;
  ordem?: CampoDeOrdem;
  dir?: "asc" | "desc";
};
