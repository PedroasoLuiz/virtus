/** Contratos de dominio do modulo clientes. */

/**
 * A tabela `clientes` do banco herdado serve tres papeis com flags booleanas
 * (cliente / fornecedor / colaborador). O dominio expoe isso como uma lista de
 * papeis, que e como o negocio realmente pensa.
 */
export type PapelPessoa =
  | "cliente"
  | "fornecedor"
  | "colaborador"
  | "transportadora"
  | "corretor";

/*
 * ⚠️ Lista fechada, e nao texto livre.
 *
 * Sao os regimes que a Receita reconhece, e o valor daqui decide imposto na nota.
 * Digitado a mao, "Simples", "simples nacional" e "SN" virariam tres regimes
 * diferentes para o mesmo cadastro.
 *
 * ⚠️ Mora AQUI, e nao no schema: a tela precisa deles para desenhar o seletor, e
 * importar o schema arrastaria o zod inteiro para o pacote do navegador.
 */
export const REGIMES = [
  "Simples Nacional",
  "MEI",
  "Lucro Presumido",
  "Lucro Real",
  "Imune ou isento",
] as const;

/** Diante do ICMS. E o que decide se a nota destaca imposto para esta pessoa. */
export const CLASSIFICACOES = [
  "Contribuinte de ICMS",
  "Contribuinte isento",
  "Não contribuinte",
] as const;

export type Cliente = {
  id: number;
  razao: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  email: string | null;
  contato: string | null;
  /**
   * ⚠️ LEITURA. E o responsavel do contato PRINCIPAL, resolvido pela view.
   *
   * A coluna de `clientes` foi apagada: responsavel e de cada telefone e de cada
   * e-mail. Quem grava e a aba de contatos; aqui ele so aparece porque a
   * listagem mostra, ordena e busca por ele.
   */
  responsavel: string | null;
  papeis: PapelPessoa[];
  grupoId: number | null;
  /** Todo cliente tem um. O padrao e o "Geral" da empresa. */
  centroCustoId: number | null;
  centroCustoNome: string | null;
  /**
   * Nascimento da pessoa fisica, fundacao da juridica.
   *
   * ⚠️ Uma data so para os dois casos, em `aaaa-mm-dd`. E a mesma data na vida do
   * cadastro, e duas colunas fariam a tela escolher qual ler a cada vez que o
   * documento troca de tamanho.
   */
  dataNascimento: string | null;
  inscricaoMunicipal: string | null;
  inscricaoEstadual: string | null;
  regimeTributario: string | null;
  /** Diante do ICMS: contribuinte, isento ou nao contribuinte. */
  classificacaoTributaria: string | null;
  ativo: boolean;
};

export type ClienteNovo = {
  razao: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  email?: string | null;
  contato?: string | null;
  papeis: PapelPessoa[];
  grupoId?: number | null;
  /** Omitido, o gatilho `trg_clientes_centro_padrao` preenche com o "Geral". */
  centroCustoId?: number | null;
  dataNascimento?: string | null;
  inscricaoMunicipal?: string | null;
  inscricaoEstadual?: string | null;
  regimeTributario?: string | null;
  classificacaoTributaria?: string | null;
  /**
   * O endereco que nasce junto com a pessoa.
   *
   * ⚠️ So no CADASTRO. Depois disso, endereco se mexe na aba dele: aqui ele
   * existe porque a consulta do CNPJ traz um pronto, e pedir para a pessoa
   * salvar, abrir a aba e digitar de novo o que a Receita ja entregou seria
   * jogar fora o unico motivo de a consulta existir.
   */
  endereco?: Omit<EnderecoDaPessoa, "id" | "principal"> | null;
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
  /**
   * Quem atende neste contato.
   *
   * ⚠️ E do CONTATO, e nao do cadastro. O telefone do financeiro e o e-mail do
   * comercial tem gente diferente do outro lado, e um responsavel unico na ficha
   * mandava todo mundo falar com a mesma pessoa.
   *
   * `clientes.responsavel` continua existindo e passa a significar o responsavel
   * do contato PRINCIPAL — e a mesma denormalizacao de `contato` e `email`, e e
   * o que a listagem mostra e ordena.
   */
  responsavel: string | null;
  /**
   * O nome de quem entra no portal com este e-mail, quando ha alguem.
   *
   * ⚠️ Nao e coluna: sai do cruzamento com quem tem acesso a este cadastro. Vale
   * so para e-mail, e a aba usa para marcar que aquela linha e a porta de
   * entrada de alguem — apaga-la tira o contato e deixa o acesso sem destino.
   */
  usuario?: string | null;
};

/** Um endereco da pessoa. */
export type EnderecoDaPessoa = {
  id: number;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  principal: boolean;
};

/**
 * Onde a empresa paga esta pessoa, ou de onde ela recebe.
 *
 * ⚠️ Nao e conta bancaria da EMPRESA. Aquelas tem saldo, limite e extrato, e
 * entram no fluxo de caixa; estas sao dado de terceiro, para preencher um
 * pagamento — e nunca para conciliar.
 */
export type DadoBancarioDaPessoa = {
  id: number;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  /** Quem recebe, quando nao e a propria pessoa do cadastro. */
  titular: string | null;
  documento: string | null;
  pixTipo: string | null;
  pixChave: string | null;
  principal: boolean;
};

/** Um usuario com acesso aos dados desta pessoa. */
export type UsuarioDaPessoa = {
  id: string;
  nome: string | null;
  email: string | null;
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
  transportadora: number;
  corretor: number;
};

export type FiltroClientes = {
  busca?: string;
  papel?: PapelPessoa;
  ativo?: boolean;
  ordem?: CampoDeOrdem;
  dir?: "asc" | "desc";
};
