/**
 * Tipos do schema do Postgres.
 *
 * ⚠️ ARQUIVO PROVISORIO, ESCRITO A MAO. Substituir por geracao automatica assim
 * que houver acesso ao projeto:
 *
 *   npx supabase gen types typescript --project-id gewshjjyqdfdcjtwlyas \
 *     > src/infra/supabase/database.types.ts
 *
 * Cobre so as tabelas tocadas pelos modulos ja implementados. Colunas em
 * camelCase porque e assim que estao no banco herdado do FlutterFlow (ver
 * docs/03) — a traducao para o dominio acontece no repositorio, nao aqui.
 */

/**
 * ⚠️ O banco mistura convencoes: timestamps sao snake_case (`created_at`),
 * mas as chaves estrangeiras sao camelCase (`fkEmpresa`). Nao e engano de
 * transcricao — e assim que o FlutterFlow deixou. Ver docs/03.
 */
type Timestamps = {
  created_at: string | null;
  updated_at: string | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
};

/**
 * Projeto — camada de execucao, separada da de dinheiro. Ver docs/11.
 */
export type ProjetoRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  idtenant: number | null;
  nome: string;
  descricao: string | null;
  fkCliente: number | null;
  modalidade: string;
  situacao: string;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
  cancelado: boolean;
  fkEmpresa: number;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
};

/** Coluna do quadro de demandas. Por PROJETO — dev e marketing tem etapas diferentes. */
export type ProjetoStatusRow = {
  id: number;
  created_at: string;
  fkProjeto: number;
  descricao: string;
  indice: number;
  cor: string;
  ativo: boolean;
  conclui: boolean;
};

export type ProjetoDemandaRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkProjeto: number;
  fkStatus: number | null;
  titulo: string;
  descricao: string | null;
  fkResponsavel: string | null;
  inicio: string | null;
  prazo: string | null;
  ordem: number;
  valor: number;
  concluida_em: string | null;
  fkOrdem: number | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
};

/**
 * Quais tickets o projeto gerou.
 *
 * Tabela, e nao coluna em `projetos`: escopo fechado com aditivo tem mais de um,
 * e a coluna unica so cabia o primeiro.
 */
/** Quais contratos cobrem o projeto. Um projeto grande costuma ter mais de um. */
export type ProjetoContratoRow = {
  id: number;
  created_at: string;
  fkProjeto: number;
  fkContrato: number;
  fkUserCriacao: string | null;
};

export type ProjetoOrdemRow = {
  id: number;
  created_at: string;
  fkProjeto: number;
  fkOrdem: number;
  fkUserCriacao: string | null;
};

/** Subitem da tarefa. Tabela, e nao texto marcado: o que interessa e contar. */
export type DemandaItemRow = {
  id: number;
  created_at: string;
  fkDemanda: number;
  descricao: string;
  feito: boolean;
  ordem: number;
  fkUserCriacao: string | null;
};

/** Sem `updated_at`: comentario editado apaga em silencio o que foi combinado. */
export type DemandaComentarioRow = {
  id: number;
  created_at: string;
  fkDemanda: number;
  fkUsuario: string | null;
  texto: string;
};

export type DemandaAnexoRow = {
  id: number;
  created_at: string;
  fkDemanda: number;
  url: string;
  nome: string | null;
  tipo: string | null;
  fkUserCriacao: string | null;
};

export type ContratoRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkCliente: number | null;
  fkModelo: number | null;
  numero: string | null;
  descricao: string | null;
  inicio: string | null;
  fim: string | null;
  valor: number | null;
  ativo: boolean | null;
  deletado: boolean | null;
  periodicidade: string;
  dia_vencimento: number | null;
  proxima_competencia: string | null;
  fkEmpresa: number | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
};

export type ContratoCompetenciaRow = {
  id: number;
  created_at: string;
  fkContrato: number;
  competencia: string;
  fkOrdem: number | null;
  valor: number;
  fkUserCriacao: string | null;
};

export type ClienteCentroCustoRow = {
  id: number;
  created_at: string;
  fkCliente: number;
  fkCentroCusto: number;
  fkUserCriacao: string | null;
};

export type ClienteEnderecoRow = {
  id: number;
  created_at: string;
  fkCliente: number | null;
  fkCentroCusto: number | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  principal: boolean | null;
};

export type ClienteRow = Timestamps & {
  id: number;
  fkEmpresa: number | null;
  razao: string | null;
  nomefantasia: string | null;
  cnpj: string | null;
  contato: string | null;
  responsavel: string | null;
  email: string | null;
  urlicon: string | null;
  fkGrupo: number | null;
  fkCentroCusto: number | null;
  ativo: boolean | null;
  cliente: boolean | null;
  fornecedor: boolean | null;
  colaborador: boolean | null;
};

export type FaturaRow = Timestamps & {
  id: number;
  fkEmpresa: number | null;
  idtenant: number | null;
  fkCliente: number | null;
  dataInicio: string | null;
  dataFim: string | null;
  status: string | null;
  cancelada: boolean | null;
  total: number | null;
  observacoes: string | null;
  rodape: string | null;
  parcelas: number | null;
};


/** Anexo da conta inteira. Nota e boleto ficam na PARCELA, nao aqui. */
/** Quanto de um pagamento foi para uma parcela. Um PIX se reparte; uma parcela junta varios. */
export type PagamentoParcelaRow = {
  id: number;
  created_at: string;
  fkPagamento: number;
  fkParcela: number;
  valor: number;
  /**
   * Acrescimo recebido junto. Fica FORA de `valor` de proposito: o gatilho
   * `recalcula_baixa_da_parcela` soma so `valor` para decidir se a parcela
   * quitou, entao juros e multa entram no caixa sem abater divida nenhuma.
   */
  juros: number;
  multa: number;
  /** Quanto esta baixa perdoou. Existe para o estorno saber o que devolver. */
  desconto: number;
  fkUserCriacao: string | null;
};

/** Multa e juros por atraso. Sem cliente = padrao da empresa. */
export type ParametroCobrancaRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
  fkEmpresa: number;
  fkCliente: number | null;
  multa_percentual: number;
  juros_percentual: number;
  juros_periodo: "MES" | "DIA";
  carencia_dias: number;
};

export type PagamentoRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkEmpresa: number | null;
  fkContaBancaria: number | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
  /** Conferido no extrato do banco. Gesto humano: nada marca sozinho. */
  conciliado: boolean | null;
  data: string | null;
  tipo: string | null;
  natureza: string | null;
  descricao: string | null;
  valor: number | null;
  comprovante: string | null;
  origem: string | null;
  observacoes: string | null;
  fkCentroCusto: number | null;
  titulo: string | null;
  nome: string | null;
};

export type ContaBancariaRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
  apelido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  ativo: boolean | null;
  fkEmpresa: number | null;
  logo: string | null;
  limite: number | null;
  /** Saldo de partida. O saldo de hoje e ele mais tudo que passou. */
  saldoinicial: number | null;
};

/** Saldo calculado por conta. View: saldo inicial + entradas - saidas. */
export type SaldoRow = {
  conta_id: number;
  apelido: string | null;
  banco: string | null;
  conta: string | null;
  limite: number | null;
  saldo: number | null;
};

export type FaturaAnexoRow = {
  id: number;
  created_at: string;
  fkFatura: number;
  fkUserCriacao: string | null;
  nome: string;
  caminho: string;
  tipo: string | null;
};

export type FaturaParcelaRow = Timestamps & {
  id: number;
  fkFatura: number | null;
  numeroparcela: number | null;
  vencimento: string | null;
  valor: number | null;
  acrescimo: number | null;
  desconto: number | null;
  total: number | null;
  pago: boolean | null;
  fkPagamento: number | null;
  observacoes: string | null;
  nfs: string | null;
  boleto: string | null;
  /** O que o cliente manda ao pagar. Nota e boleto vao; este volta. */
  comprovante: string | null;
  /** Credencial do link publico da parcela. Nulo = nao compartilhada. */
  token: string | null;
};

export type ContaPagarRow = Timestamps & {
  id: number;
  fkEmpresa: number | null;
  fkFornecedor: number | null;
  descricao: string | null;
  total: number | null;
  fkCentroCusto: number | null;
  pago: boolean | null;
  cancelada: boolean | null;
  fkStatus: number | null;
  data: string | null;
  observacoes: string | null;
};

export type ContaPagarParcelaRow = Timestamps & {
  id: number;
  fkContaPagar: number | null;
  numeroparcela: number | null;
  vencimento: string | null;
  valor: number | null;
  acrescimo: number | null;
  desconto: number | null;
  total: number | null;
  pago: boolean | null;
  fkPagamento: number | null;
  nfs: string | null;
  boleto: string | null;
  /** Credencial do link publico da parcela. Nulo = nao compartilhada. */
  token: string | null;
  observacoes: string | null;
};

export type ServicoRow = Timestamps & {
  id: number;
  fkEmpresa: number | null;
  descricao: string | null;
  valor: number | null;
  cnae: string | null;
  fkCentroCusto: number | null;
  ativo: boolean | null;
  deletado: boolean | null;
};

export type CentroCustoRow = Timestamps & {
  id: number;
  fkEmpresa: number | null;
  descricao: string;
  tipo: string;
  ativo: boolean;
};

export type EmpresaRow = {
  id: number;
  created_at: string;
  razaosocial: string | null;
  fantasia: string | null;
  nome: string | null;
  cnpj: string | null;
  logo: string | null;
  ativo: boolean | null;
};

/** Perfil do usuario. PK e `fkUser` (uuid de auth.users), nao ha `id`. */
export type UsuarioRow = {
  created_at: string;
  fkUser: string;
  nome: string | null;
  email: string | null;
  ativo: boolean | null;
  externo: boolean | null;
};

export type UsuarioEmpresaRow = {
  id: number;
  created_at: string;
  fkUser: string | null;
  fkEmpresa: number | null;
};

/**
 * Plataforma SaaS — modelo que JA EXISTE no banco.
 *
 * ⚠️ `produtos` neste schema e produto de ESTOQUE (codigo de barras, NCM,
 * preco de custo), nao produto SaaS. O que define o que a empresa pode usar e
 * `planos`, atraves das flags `modulo_*`, ligado por `assinaturas`.
 */
export type PlanoRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  preco_mensal: number | null;
  preco_anual: number | null;
  max_usuarios: number | null;
  max_empresas: number | null;
  max_clientes: number | null;
  max_faturas_mes: number | null;
  max_os_mes: number | null;
  max_storage_mb: number | null;
  modulo_financeiro: boolean | null;
  modulo_os: boolean | null;
  modulo_manutencao: boolean | null;
  modulo_estoque: boolean | null;
  modulo_crm: boolean | null;
  modulo_contratos: boolean | null;
  modulo_chat: boolean | null;
  destaque: boolean | null;
  ordem: number | null;
};

export type AssinaturaRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkEmpresa: number;
  fkPlano: number;
  fkUserCriacao: string | null;
  status: string;
  periodicidade: string | null;
  inicio: string;
  fim: string | null;
  trial_fim: string | null;
  preco: number | null;
  desconto: number | null;
  observacoes: string | null;
  cancelada_em: string | null;
  cancelada_motivo: string | null;
};

/**
 * Ticket — no banco a tabela se chama `ordensservico`, herdada da aplicacao de
 * origem e referenciada pelas RPCs `get_*`. O nome "Ticket" e da interface;
 * renomear no banco quebraria aquele sistema sem ganho. Ver docs/10.
 */
export type TicketRow = {
  id: number;
  idtenant: number | null;
  created_at: string;
  updated_at: string | null;
  titulo: string | null;
  descricao: string | null;
  apontamento: string | null;
  status: string | null;
  prioridade: string | null;
  local: string | null;
  dataprevisaoinicio: string | null;
  dataprevisaofim: string | null;
  datainicio: string | null;
  datafim: string | null;
  cancelada: boolean | null;
  origem: string;
  fkCliente: number | null;
  fkCentroCusto: number | null;
  fkEndereco: number | null;
  fkStatus: number | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
  fkEmpresa: number | null;
};

/**
 * Coluna do quadro de tickets.
 *
 * Quem cria e o usuario. As quatro com `chave` preenchida sao do sistema:
 * `sistema = true` impede excluir e desativar, porque o gatilho de faturamento
 * move o ticket para elas pelo nome da chave.
 */
export type TicketStatusRow = {
  id: number;
  created_at: string;
  descricao: string | null;
  indice: number | null;
  ativo: boolean | null;
  chave: string | null;
  sistema: boolean;
  cor: string | null;
  fkUserCriacao: string | null;
  fkEmpresa: number | null;
};

/** Despesa adicional de um servico do ticket. */
export type TicketServicoDespesaRow = {
  id: number;
  created_at: string;
  fkItem: number;
  descricao: string;
  valor: number;
  fkUserCriacao: string | null;
};

export type TicketServicoRow = {
  id: number;
  created_at: string;
  fkOrdem: number | null;
  fkServico: number | null;
  /** A tarefa de projeto que originou a linha. Nulo em servico digitado a mao. */
  fkDemanda: number | null;
  fkUserCriacao: string | null;
  quantidade: number;
  valor: number;
  desconto: number | null;
  acrescimo: number | null;
  total: number;
  descricao: string | null;
  observacoes: string | null;
  data: string | null;
  unidade: string;
};

/**
 * De onde veio cada parcela de valor de uma conta a receber.
 *
 * Arco exclusivo: `origem` discrimina e exatamente uma FK vem preenchida —
 * mesmo padrao que `movimentacoes` ja usa neste banco. `fkVenda` entra com o
 * modulo de estoque.
 */
export type FaturaOrigemRow = {
  id: number;
  created_at: string;
  fkUserCriacao: string | null;
  fkFatura: number;
  origem: "TICKET" | "CONTRATO";
  fkOrdem: number | null;
  fkContrato: number | null;
  valor: number;
  observacoes: string | null;
};

/** View `vw_origens_faturamento`: total, faturado e saldo por origem. */
export type OrigemFaturamentoRow = {
  tipo: string;
  origem_id: number;
  empresa_id: number | null;
  cliente_id: number | null;
  descricao: string;
  status: string | null;
  cancelada: boolean | null;
  encerrado_em: string | null;
  total: number;
  faturado: number;
  saldo: number;
  qtd_contas: number;
};

export type MenuFavoritoRow = {
  id: number;
  created_at: string;
  fkUser: string;
  fkEmpresa: number;
  rota: string;
  ordem: number;
};

export type Database = {
  public: {
    Tables: {
      projetos: { Row: ProjetoRow; Insert: Partial<ProjetoRow>; Update: Partial<ProjetoRow>; Relationships: [] };
      projetosstatus: { Row: ProjetoStatusRow; Insert: Partial<ProjetoStatusRow>; Update: Partial<ProjetoStatusRow>; Relationships: [] };
      projetoscontratos: { Row: ProjetoContratoRow; Insert: Partial<ProjetoContratoRow>; Update: Partial<ProjetoContratoRow>; Relationships: [] };
      projetosordens: { Row: ProjetoOrdemRow; Insert: Partial<ProjetoOrdemRow>; Update: Partial<ProjetoOrdemRow>; Relationships: [] };
      projetosdemandas: { Row: ProjetoDemandaRow; Insert: Partial<ProjetoDemandaRow>; Update: Partial<ProjetoDemandaRow>; Relationships: [] };
      projetosdemandasitens: { Row: DemandaItemRow; Insert: Partial<DemandaItemRow>; Update: Partial<DemandaItemRow>; Relationships: [] };
      projetosdemandascomentarios: { Row: DemandaComentarioRow; Insert: Partial<DemandaComentarioRow>; Update: Partial<DemandaComentarioRow>; Relationships: [] };
      projetosdemandasanexos: { Row: DemandaAnexoRow; Insert: Partial<DemandaAnexoRow>; Update: Partial<DemandaAnexoRow>; Relationships: [] };
      contratos: { Row: ContratoRow; Insert: Partial<ContratoRow>; Update: Partial<ContratoRow>; Relationships: [] };
      contratoscompetencias: { Row: ContratoCompetenciaRow; Insert: Partial<ContratoCompetenciaRow>; Update: Partial<ContratoCompetenciaRow>; Relationships: [] };
      clientesxcentrocusto: { Row: ClienteCentroCustoRow; Insert: Partial<ClienteCentroCustoRow>; Update: Partial<ClienteCentroCustoRow>; Relationships: [] };
      clientesenderecos: { Row: ClienteEnderecoRow; Insert: Partial<ClienteEnderecoRow>; Update: Partial<ClienteEnderecoRow>; Relationships: [] };
      clientes: { Row: ClienteRow; Insert: Partial<ClienteRow>; Update: Partial<ClienteRow>; Relationships: [] };
      faturas: { Row: FaturaRow; Insert: Partial<FaturaRow>; Update: Partial<FaturaRow>; Relationships: [] };
      pagamentos: { Row: PagamentoRow; Insert: Partial<PagamentoRow>; Update: Partial<PagamentoRow>; Relationships: [] };
      pagamentosxparcelas: { Row: PagamentoParcelaRow; Insert: Partial<PagamentoParcelaRow>; Update: Partial<PagamentoParcelaRow>; Relationships: [] };
      contasbancarias: { Row: ContaBancariaRow; Insert: Partial<ContaBancariaRow>; Update: Partial<ContaBancariaRow>; Relationships: [] };
      parametroscobranca: { Row: ParametroCobrancaRow; Insert: Partial<ParametroCobrancaRow>; Update: Partial<ParametroCobrancaRow>; Relationships: [] };
      vwsaldo: { Row: SaldoRow; Insert: never; Update: never; Relationships: [] };
      faturasanexos: { Row: FaturaAnexoRow; Insert: Partial<FaturaAnexoRow>; Update: Partial<FaturaAnexoRow>; Relationships: [] };
      faturasparcelas: { Row: FaturaParcelaRow; Insert: Partial<FaturaParcelaRow>; Update: Partial<FaturaParcelaRow>; Relationships: [] };
      contaspagar: { Row: ContaPagarRow; Insert: Partial<ContaPagarRow>; Update: Partial<ContaPagarRow>; Relationships: [] };
      contaspagarparcelas: { Row: ContaPagarParcelaRow; Insert: Partial<ContaPagarParcelaRow>; Update: Partial<ContaPagarParcelaRow>; Relationships: [] };
      servicos: { Row: ServicoRow; Insert: Partial<ServicoRow>; Update: Partial<ServicoRow>; Relationships: [] };
      centrodecusto: { Row: CentroCustoRow; Insert: Partial<CentroCustoRow>; Update: Partial<CentroCustoRow>; Relationships: [] };
      empresas: { Row: EmpresaRow; Insert: Partial<EmpresaRow>; Update: Partial<EmpresaRow>; Relationships: [] };
      usuarios: { Row: UsuarioRow; Insert: Partial<UsuarioRow>; Update: Partial<UsuarioRow>; Relationships: [] };
      usuariosxempresas: { Row: UsuarioEmpresaRow; Insert: Partial<UsuarioEmpresaRow>; Update: Partial<UsuarioEmpresaRow>; Relationships: [] };
      planos: { Row: PlanoRow; Insert: Partial<PlanoRow>; Update: Partial<PlanoRow>; Relationships: [] };
      faturasorigens: { Row: FaturaOrigemRow; Insert: Partial<FaturaOrigemRow>; Update: Partial<FaturaOrigemRow>; Relationships: [] };
      ordensservico: { Row: TicketRow; Insert: Partial<TicketRow>; Update: Partial<TicketRow>; Relationships: [] };
      ordensservicoxservicos: { Row: TicketServicoRow; Insert: Partial<TicketServicoRow>; Update: Partial<TicketServicoRow>; Relationships: [] };
      ordensservicoxservicosdespesas: { Row: TicketServicoDespesaRow; Insert: Partial<TicketServicoDespesaRow>; Update: Partial<TicketServicoDespesaRow>; Relationships: [] };
      ordensservicostatus: { Row: TicketStatusRow; Insert: Partial<TicketStatusRow>; Update: Partial<TicketStatusRow>; Relationships: [] };
      menufavoritos: { Row: MenuFavoritoRow; Insert: Partial<MenuFavoritoRow>; Update: Partial<MenuFavoritoRow>; Relationships: [] };
      assinaturas: { Row: AssinaturaRow; Insert: Partial<AssinaturaRow>; Update: Partial<AssinaturaRow>; Relationships: [] };
    };
    Views: {
      vw_origens_faturamento: { Row: OrigemFaturamentoRow; Relationships: [] };
    };
    Functions: {
      /**
       * Grava os servicos do ticket numa transacao so — ver docs/10.
       *
       * Pelo PostgREST eram tres chamadas sem transacao entre elas, e uma falha
       * no meio deixava o ticket sem servico nenhum.
       */
      tickets_compartilhados: {
        Args: { p_token: string };
        Returns: unknown;
      };
      parcela_compartilhada: {
        Args: { p_token: string };
        Returns: {
          fatura_numero: number;
          parcela_numero: number;
          vencimento: string | null;
          total: number;
          pago: boolean;
          competencia_de: string | null;
          competencia_ate: string | null;
          empresa_nome: string;
          tem_nfs: boolean;
          tem_boleto: boolean;
        }[];
      };
      caminho_compartilhado: {
        Args: { p_token: string; p_tipo: string };
        Returns: string | null;
      };
      gerar_ticket_do_projeto: {
        Args: {
          p_projeto: number;
          p_usuario: string | null;
          p_valor: number;
          p_titulo: string | null;
        };
        Returns: number;
      };
      gerar_ticket_das_demandas: {
        Args: { p_demandas: number[]; p_usuario: string | null };
        Returns: number;
      };
      gerar_competencia_do_contrato: {
        Args: { p_contrato: number; p_usuario: string | null };
        Returns: number;
      };
      salvar_itens_do_ticket: {
        Args: { p_ordem: number; p_usuario: string | null; p_itens: unknown };
        Returns: undefined;
      };
      /**
       * Extrato de uma conta num periodo. Devolve `{ conta, saldo_inicial,
       * movimentos }` — o saldo de abertura soma tudo que veio ANTES do periodo,
       * que e a parte que erraria se fosse refeita no aplicativo.
       */
      /** Saldo de uma conta imediatamente antes de uma data. Alimenta a abertura do extrato. */
      saldo_da_conta_antes: {
        Args: { p_conta: number; p_data: string };
        Returns: number;
      };
      get_extratobancario: {
        Args: {
          pdatainicio: string;
          pdatafim: string;
          pfkempresa: number;
          pfkcontabancaria: number;
        };
        Returns: unknown;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
