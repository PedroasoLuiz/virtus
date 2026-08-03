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

export type FiltroClientes = {
  busca?: string;
  papel?: PapelPessoa;
  ativo?: boolean;
};
