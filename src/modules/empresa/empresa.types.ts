/**
 * O cadastro da propria empresa.
 *
 * ⚠️ Nao confundir com `EmpresaParaDocumento`, no repositorio ao lado. Aquela e
 * a LEITURA que o cabecalho dos PDFs faz, ja resolvida (razao social caindo para
 * fantasia, endereco em uma linha so). Esta e a empresa como ela e digitada, um
 * campo por coluna, e e a unica forma que o formulario pode editar. Uma so para
 * os dois usos obrigaria o PDF a repetir as quedas em cada lugar que imprime.
 */
export type CadastroDaEmpresa = {
  id: number;

  /* ── Identidade ──────────────────────────────────────────────────────── */
  razaoSocial: string;
  fantasia: string;
  /*
   * O APELIDO. Coluna `nome`, a mais curta das tres.
   *
   * ⚠️ Nao e sinonimo de fantasia. "VIRTUS SERVICOS DE TECNOLOGIA LTDA" e a
   * razao social, "Virtus Tecnologias" e o fantasia, e "Virtus" e como as
   * pessoas da casa chamam a empresa. E o apelido que cabe numa coluna de
   * tabela e num cartao de duzentos pixels.
   */
  apelido: string;
  cnpj: string;
  ie: string;
  inscricaoMunicipal: string;
  logo: string;
  /** Caminho do certificado A1 no bucket privado. Vazio quando nao ha. */
  certificado: string;

  /* ── Contato ─────────────────────────────────────────────────────────── */
  email: string;
  contato: string;

  /* ── Endereco ────────────────────────────────────────────────────────── */
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  codigoIbge: string;
};

/**
 * O que o formulario manda de volta.
 *
 * ⚠️ Sem o `id`: a empresa a salvar e a ATIVA da sessao, e nao uma que o cliente
 * escolhe. Aceitando um id daqui, trocar um numero no navegador seria uma
 * tentativa de editar o cadastro de outro tenant — a RLS barraria, mas o
 * servidor nao deve nem chegar a perguntar.
 *
 * ⚠️ Sem `logo` e sem `certificado`: os dois sao ARQUIVO, e arquivo tem caminho
 * proprio. Viajando como texto no formulario, um salvar de quem nunca abriu a
 * aba de documentos apagaria os dois.
 */
export type EdicaoDaEmpresa = Omit<CadastroDaEmpresa, "id" | "logo" | "certificado">;

/**
 * Quanto a empresa ocupa, e quanto ela tem direito de ocupar.
 *
 * ⚠️ O teto vem do PLANO (`max_storage_mb`), e nao de uma constante. Free tem
 * 500 MB, Starter 2 GB, Pro 10 GB — e e por essa coluna que espaco extra vai ser
 * vendido. Um numero fixo no codigo faria a primeira venda exigir deploy.
 *
 * ⚠️ Teto `null` e ILIMITADO, e nao "nao sei". E o que o Enterprise tem hoje. A
 * tela mostra o usado sem barra: uma barra sem fim para onde correr nao mede
 * nada.
 */
export type ArmazenamentoDaEmpresa = {
  usadoBytes: number;
  limiteMb: number | null;
};
