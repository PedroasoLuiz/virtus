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

/** O que a IA pode resolver sozinha num setor, e com que voz. */
export type PersonaRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkEmpresa: number;
  /** Nulo vale para todos os numeros da empresa. */
  fkConta: number | null;
  /** Nulo e a persona geral, usada quando o setor nao tem uma propria. */
  fkSetor: number | null;
  nome: string;
  descricao: string | null;
  /** O que ela nao faz: o jeito, e nao o assunto. */
  evitar: string | null;
  /** A mensagem de boas-vindas. Vazia usa a padrao do sistema. */
  saudacao: string | null;
  pode_resolver: string | null;
  /** Os ids das consultas que ela pode fazer. Ver `atendimento/permissoes.ts`. */
  permissoes: string[];
  ativo: boolean;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
};

/** O que a triagem entendeu de um contato. Vira tarefa ou e recusado. */
export type AtendimentoRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  fkEmpresa: number;
  fkConversa: number;
  fkCliente: number | null;
  fkSetor: number | null;
  fkResponsavel: string | null;
  intencao: string | null;
  resumo: string | null;
  confianca: number | null;
  situacao: string;
  lead_nome: string | null;
  lead_empresa: string | null;
  lead_email: string | null;
  fkDemanda: number | null;
  motivo_recusa: string | null;
  encerrado_em: string | null;
  /** Quando saiu o lembrete de "voce ainda esta ai?". */
  lembrete_em: string | null;
  fkUserCriacao: string | null;
  fkUserModificacao: string | null;
};

export type SetorRow = {
  id: number;
  created_at: string;
  fkEmpresa: number;
  nome: string;
  descricao: string | null;
  quando_usar: string | null;
  ativo: boolean;
};

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
  updated_at: string | null;
  fkUserCriacao: string | null;
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
  email: string | null;
  urlicon: string | null;
  fkGrupo: number | null;
  fkCentroCusto: number | null;
  /** Nascimento da pessoa fisica ou fundacao da juridica: a mesma data. */
  datanascimento: string | null;
  inscricaomunicipal: string | null;
  inscricaoestadual: string | null;
  regimetributario: string | null;
  classificacaotributaria: string | null;
  ativo: boolean | null;
  cliente: boolean | null;
  fornecedor: boolean | null;
  colaborador: boolean | null;
  transportadora: boolean | null;
  corretor: boolean | null;
};

/**
 * A leitura da listagem de pessoas.
 *
 * ⚠️ Traz `responsavel` do CONTATO principal e o nome do centro ja resolvido.
 * `clientes.responsavel` nao existe mais: o responsavel e de cada telefone e de
 * cada e-mail, e a view escolhe o do principal para quem precisa de um so.
 */
export type ClienteListaRow = Omit<ClienteRow, "id"> & {
  id: number;
  responsavel: string | null;
  centrocusto_nome: string | null;
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
  /** Quando o dinheiro se moveu para o cliente: e ela que fecha a parcela. */
  data: string | null;
  /**
   * Quando o dinheiro CAI na conta.
   *
   * ⚠️ Nao e a mesma coisa que `data`. Cartao credita em D+30: o cliente nao deve
   * mais desde o dia da compra, e o extrato so ve o dinheiro um mes depois.
   */
  data_credito: string | null;
  /** O que a adquirente reteve. Vira lancamento de despesa proprio. */
  taxa: number | null;
  /**
   * Quando o dinheiro se move NA CONTA: coluna GERADA pelo banco.
   *
   * ⚠️ Nao se escreve nela — o Postgres recusa. E `data_credito` quando ha, e
   * `data` quando nao, e e por ela que o extrato, o saldo e a conciliacao
   * perguntam.
   */
  data_caixa: string | null;
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
  /**
   * Credencial do link publico da parcela.
   *
   * NOT NULL com default `gen_random_uuid()`: toda parcela nasce com um. Antes
   * ele so era criado no envio por e-mail, e o portal do cliente nao tinha como
   * abrir a cobranca de quem nunca recebeu e-mail. Ter um token gerado nao
   * publica nada — publica quem manda o link; zerar a coluna revoga.
   */
  token: string;
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

/**
 * Conversa do WhatsApp — uma por telefone dentro de um numero.
 *
 * ⚠️ `whatsappcontas` NAO tem tipo aqui de proposito: a tabela guarda o segredo
 * do webhook, esta com RLS sem policy e nao e legivel pelo PostgREST. Quem a le
 * e a funcao `whatsapp_registrar_evento`, dentro do banco.
 */
export type WhatsappConversaRow = {
  id: number;
  created_at: string;
  fkEmpresa: number;
  fkConta: number;
  fkCliente: number | null;
  telefone: string;
  nome: string | null;
  ultima_em: string | null;
  ultimo_texto: string | null;
  /** Tipo da ultima mensagem. Alimenta o icone da previa, como no WhatsApp. */
  ultimo_tipo: string | null;
  ultima_direcao: "entrada" | "saida" | null;
  nao_lidas: number;
  /** Marcado durante a triagem. O painel trava o campo de escrita enquanto isso. */
  bot_respondendo_em: string | null;
  /** Fim da janela de 24h da Meta. Fora dela so template passa. */
  janela_expira_em: string | null;
  /** Fora da caixa de entrada. O historico continua inteiro. */
  arquivada: boolean;
};

export type WhatsappEtiquetaRow = {
  id: number;
  created_at: string;
  fkEmpresa: number;
  nome: string;
  /** Slug do design system: `verde`, `azul`, `ambar`, `vermelho`, `roxo`, `cinza`. */
  cor: string;
  /** Exclusao e logica: apagar levaria junto a marca de todas as conversas. */
  ativo: boolean;
};

export type WhatsappConversaEtiquetaRow = {
  id: number;
  created_at: string;
  fkConversa: number;
  fkEtiqueta: number;
  /** Quem marcou. Nulo quando veio de fora do painel. */
  fkUser: string | null;
};

export type WhatsappMensagemRow = {
  id: number;
  created_at: string;
  fkEmpresa: number;
  fkConversa: number;
  fkUser: string | null;
  /** Id da Meta. UNIQUE — e o que torna a ingestao do webhook idempotente. */
  wamid: string | null;
  direcao: "entrada" | "saida";
  tipo: string;
  texto: string | null;
  midia_id: string | null;
  midia_mime: string | null;
  midia_nome: string | null;
  status: string | null;
  erro: string | null;
  enviada_em: string;
};

/**
 * Contatos alem do principal de uma pessoa.
 *
 * `clientes.contato` continua sendo o principal e continua valendo: a resolucao
 * de telefone do WhatsApp olha as duas fontes.
 */
export type ClienteContatoRow = {
  id: number;
  created_at: string;
  fkCliente: number;
  fkUserCriacao: string | null;
  /**
   * ⚠️ `whatsapp` e legado do FlutterFlow e nao e mais criado pela tela: o
   * telefone do WhatsApp e o mesmo telefone, e um tipo so para ele fazia o
   * mesmo numero aparecer duas vezes na agenda.
   */
  tipo: "telefone" | "whatsapp" | "email";
  valor: string;
  /** De quem e este contato dentro da empresa: financeiro, comercial, a pessoa. */
  rotulo: string | null;
  /** Quem atende NESTE contato: o financeiro e o comercial sao gente diferente. */
  responsavel: string | null;
  ativo: boolean;
};

export type UsuarioClienteRow = {
  id: number;
  created_at: string;
  fkUser: string;
  fkCliente: number;
  fkUserCriacao: string | null;
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
      vw_clientes_lista: { Row: ClienteListaRow; Insert: never; Update: never; Relationships: [] };
      clientescontatos: { Row: ClienteContatoRow; Insert: Partial<ClienteContatoRow>; Update: Partial<ClienteContatoRow>; Relationships: [] };
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
      usuariosxclientes: { Row: UsuarioClienteRow; Insert: Partial<UsuarioClienteRow>; Update: Partial<UsuarioClienteRow>; Relationships: [] };
      usuariosxempresas: { Row: UsuarioEmpresaRow; Insert: Partial<UsuarioEmpresaRow>; Update: Partial<UsuarioEmpresaRow>; Relationships: [] };
      planos: { Row: PlanoRow; Insert: Partial<PlanoRow>; Update: Partial<PlanoRow>; Relationships: [] };
      faturasorigens: { Row: FaturaOrigemRow; Insert: Partial<FaturaOrigemRow>; Update: Partial<FaturaOrigemRow>; Relationships: [] };
      ordensservico: { Row: TicketRow; Insert: Partial<TicketRow>; Update: Partial<TicketRow>; Relationships: [] };
      ordensservicoxservicos: { Row: TicketServicoRow; Insert: Partial<TicketServicoRow>; Update: Partial<TicketServicoRow>; Relationships: [] };
      ordensservicoxservicosdespesas: { Row: TicketServicoDespesaRow; Insert: Partial<TicketServicoDespesaRow>; Update: Partial<TicketServicoDespesaRow>; Relationships: [] };
      ordensservicostatus: { Row: TicketStatusRow; Insert: Partial<TicketStatusRow>; Update: Partial<TicketStatusRow>; Relationships: [] };
      menufavoritos: { Row: MenuFavoritoRow; Insert: Partial<MenuFavoritoRow>; Update: Partial<MenuFavoritoRow>; Relationships: [] };
      assinaturas: { Row: AssinaturaRow; Insert: Partial<AssinaturaRow>; Update: Partial<AssinaturaRow>; Relationships: [] };
      whatsappconversas: { Row: WhatsappConversaRow; Insert: Partial<WhatsappConversaRow>; Update: Partial<WhatsappConversaRow>; Relationships: [] };
      whatsappmensagens: { Row: WhatsappMensagemRow; Insert: Partial<WhatsappMensagemRow>; Update: Partial<WhatsappMensagemRow>; Relationships: [] };
      clientesbancarios: {
        Row: {
          id: number;
          created_at: string;
          fkCliente: number;
          fkUserCriacao: string | null;
          banco: string | null;
          agencia: string | null;
          conta: string | null;
          tipo: string | null;
          titular: string | null;
          documento: string | null;
          pix_tipo: string | null;
          pix_chave: string | null;
          principal: boolean;
          ativo: boolean;
        };
        Insert: Partial<{
          fkCliente: number;
          fkUserCriacao: string | null;
          banco: string | null;
          agencia: string | null;
          conta: string | null;
          tipo: string | null;
          titular: string | null;
          documento: string | null;
          pix_tipo: string | null;
          pix_chave: string | null;
          principal: boolean;
          ativo: boolean;
        }>;
        Update: Partial<{
          banco: string | null;
          agencia: string | null;
          conta: string | null;
          tipo: string | null;
          titular: string | null;
          documento: string | null;
          pix_tipo: string | null;
          pix_chave: string | null;
          principal: boolean;
          ativo: boolean;
        }>;
        Relationships: [];
      };
      whatsappetiquetas: { Row: WhatsappEtiquetaRow; Insert: Partial<WhatsappEtiquetaRow>; Update: Partial<WhatsappEtiquetaRow>; Relationships: [] };
      whatsappconversasetiquetas: { Row: WhatsappConversaEtiquetaRow; Insert: Partial<WhatsappConversaEtiquetaRow>; Update: Partial<WhatsappConversaEtiquetaRow>; Relationships: [] };
      iapersonas: { Row: PersonaRow; Insert: Partial<PersonaRow>; Update: Partial<PersonaRow>; Relationships: [] };
      atendimentos: { Row: AtendimentoRow; Insert: Partial<AtendimentoRow>; Update: Partial<AtendimentoRow>; Relationships: [] };
      setores: { Row: SetorRow; Insert: Partial<SetorRow>; Update: Partial<SetorRow>; Relationships: [] };
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
      /**
       * Ingestao do webhook do WhatsApp. SECURITY DEFINER porque roda sem
       * sessao; `p_segredo` e o que substitui a sessao.
       *
       * A empresa NAO vem por parametro — sai do `phone_number_id` cadastrado.
       * Foi por receber empresa por parametro que `get_contasreceber` vazava.
       */
      /**
       * SECURITY INVOKER: a RLS de `clientes` responde pelo tenant, entao
       * `p_empresa` aqui e filtro e nao autorizacao.
       */
      whatsapp_clientes_do_telefone: {
        Args: { p_empresa: number; p_telefone: string };
        Returns: {
          id: number;
          razao: string | null;
          nomefantasia: string | null;
          contato: string | null;
          cnpj: string | null;
          ativo: boolean | null;
        }[];
      };
      /**
       * Contas de WhatsApp da empresa, SEM segredo.
       *
       * SECURITY DEFINER porque `whatsappcontas` nao tem policy (guarda
       * referencia a segredo, entao fica fechada). A checagem de tenant mora
       * DENTRO da funcao, nao no parametro.
       */
      clientes_contagem_por_papel: {
        Args: { p_empresa: number; p_inativos?: boolean };
        Returns: {
          total: number;
          cliente: number;
          fornecedor: number;
          colaborador: number;
          transportadora: number;
          corretor: number;
        }[];
      };
      whatsapp_contatos_para_conversa: {
        Args: { p_conta: number; p_busca?: string | null; p_limite?: number };
        Returns: {
          cliente_id: number;
          nome: string | null;
          icone: string | null;
          telefone: string;
          conversa_id: number | null;
        }[];
      };
      whatsapp_vinculos_da_conta: {
        Args: { p_conta: number };
        Returns: {
          finalidade: string;
          modelo_nome: string;
          idioma: string;
          parametros: unknown;
          botao_param: string | null;
          corpo: string | null;
          campos: number;
          validado_em: string | null;
          erro: string | null;
          erro_em: string | null;
          solicitacao_nome: string | null;
          solicitacao_status: string | null;
          solicitacao_motivo: string | null;
          solicitacao_em: string | null;
        }[];
      };
      whatsapp_parcela_para_segunda_via: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: {
          cliente_nome: string | null;
          valor: number;
          vencimento: string;
          tickets: string;
          token: string;
        }[];
      };
      whatsapp_vinculo_do_bot: {
        Args: { p_segredo: string; p_conversa: number; p_finalidade: string };
        Returns: {
          modelo_nome: string;
          idioma: string;
          parametros: unknown;
          botao_param: string | null;
          corpo: string | null;
        }[];
      };
      whatsapp_vinculos_da_empresa: {
        Args: { p_empresa: number };
        Returns: {
          conta: number;
          finalidade: string;
          modelo_nome: string | null;
          idioma: string;
          parametros: unknown;
          botao_param: string | null;
          corpo: string | null;
          campos: number;
          validado_em: string | null;
          erro: string | null;
          erro_em: string | null;
          solicitacao_nome: string | null;
          solicitacao_status: string | null;
          solicitacao_motivo: string | null;
          solicitacao_em: string | null;
        }[];
      };
      whatsapp_vinculo_da_finalidade: {
        Args: { p_empresa: number; p_finalidade: string };
        Returns: {
          conta: number;
          modelo_nome: string | null;
          idioma: string;
          parametros: unknown;
          botao_param: string | null;
          corpo: string | null;
          campos: number;
          solicitacao_status: string | null;
        }[];
      };
      whatsapp_solicitar_modelo: {
        Args: {
          p_conta: number;
          p_finalidade: string;
          p_nome: string;
          p_idioma: string;
          p_parametros: string[];
          p_botao_param: string | null;
          p_corpo: string;
          p_campos: number;
        };
        Returns: undefined;
      };
      whatsapp_resolver_solicitacao: {
        Args: {
          p_conta: number;
          p_finalidade: string;
          p_status: string;
          p_motivo: string | null;
        };
        Returns: undefined;
      };
      whatsapp_salvar_vinculo: {
        Args: {
          p_conta: number;
          p_finalidade: string;
          p_modelo: string;
          p_idioma: string;
          p_parametros: string[];
          p_botao_param: string | null;
          p_corpo: string | null;
          p_campos: number;
        };
        Returns: undefined;
      };
      whatsapp_vinculo_falhou: {
        Args: { p_conta: number; p_finalidade: string; p_erro: string };
        Returns: undefined;
      };
      whatsapp_remover_vinculo: {
        Args: { p_conta: number; p_finalidade: string };
        Returns: undefined;
      };
      /** Contexto do bot. A empresa sai da conversa, nunca do parametro. */
      /** Liga e desliga o aviso de "a IA esta respondendo" no painel. */
      whatsapp_bot_respondendo: {
        Args: { p_segredo: string; p_conversa: number; p_ativo: boolean };
        Returns: undefined;
      };
      whatsapp_contexto_do_bot: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: {
          empresa: number;
          telefone: string;
          nome: string | null;
          cliente_id: number | null;
          cliente_nome: string | null;
          atendimento_id: number | null;
          atendimento_situacao: string | null;
          atendimento_setor: string | null;
          atendimento_setor_id: number | null;
          atendimento_intencao: string | null;
          atendimento_aceito: boolean;
          tentativas: number;
          humano_respondeu: boolean;
          primeiro_contato: boolean;
          conta_bot_ativo: boolean;
          conta_responde_todos: boolean;
          conta_numeros: string | null;
        }[];
      };
      bot_conversas_pendentes: {
        Args: { p_segredo: string; p_minutos: number };
        Returns: { conversa_id: number; acao: string }[];
      };
      atendimento_marcar_lembrete: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: undefined;
      };
      whatsapp_verificacao_abrir: {
        Args: { p_segredo: string; p_conversa: number; p_documento: string };
        Returns: { cliente_id: number; email_mascarado: string }[];
      };
      whatsapp_verificacao_confirmar: {
        Args: { p_segredo: string; p_conversa: number; p_hash: string };
        Returns: number | null;
      };
      whatsapp_verificacao_estado: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: { etapa: string; email_mascarado: string }[];
      };
      whatsapp_verificacao_cancelar: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: undefined;
      };
      ia_provedores_da_empresa: {
        Args: { p_empresa: number };
        Returns: {
          id: number;
          nome: string;
          provedor: string;
          modelo: string;
          ativo: boolean;
          tem_chave: boolean;
          chave_final: string | null;
          em_uso: number;
        }[];
      };
      /** ⚠️ Devolve a chave em CLARO, do vault. So para a rota de teste. */
      ia_chave_para_teste: {
        Args: { p_id: number };
        Returns: { provedor: string; modelo: string; chave: string }[];
      };
      /** ⚠️ Devolve a chave em CLARO, do vault. Uma linha, ou nenhuma. */
      ia_credenciais_da_conversa: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: { provedor: string; modelo: string; chave: string }[];
      };
      ia_numero_teste: {
        Args: { p_empresa: number };
        Returns: string | null;
      };
      ia_salvar_provedor: {
        Args: {
          p_empresa: number;
          p_id: number | null;
          p_nome: string;
          p_provedor: string;
          p_modelo: string;
          p_ativo: boolean;
          p_chave: string | null;
        };
        Returns: number;
      };
      ia_salvar_numero_teste: {
        Args: { p_empresa: number; p_numero: string | null };
        Returns: undefined;
      };
      ia_remover_provedor: {
        Args: { p_empresa: number; p_id: number };
        Returns: undefined;
      };
      personas_do_bot: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: {
          nome: string;
          descricao: string | null;
          evitar: string | null;
          saudacao: string | null;
          pode_resolver: string | null;
          setor_id: number | null;
          setor_nome: string | null;
          permissoes: unknown;
        }[];
      };
      whatsapp_saida_repetida: {
        Args: { p_segredo: string; p_conversa: number; p_texto: string; p_segundos: number };
        Returns: number | null;
      };
      whatsapp_reservar_espera: {
        Args: { p_segredo: string; p_conversa: number; p_segundos: number };
        Returns: boolean;
      };
      whatsapp_liberar_espera: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: undefined;
      };
      whatsapp_garantir_conversa: {
        Args: { p_empresa: number; p_conta: number; p_telefone: string; p_nome: string | null };
        Returns: number;
      };
      whatsapp_titulos_do_cliente: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: {
          fatura: number;
          parcela: number | null;
          vencimento: string;
          valor: number;
          vencida: boolean;
          origem: string | null;
        }[];
      };
      whatsapp_servicos_da_empresa: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: { descricao: string; valor: number | null }[];
      };
      whatsapp_email_do_cliente: {
        Args: { p_segredo: string; p_cliente: number };
        Returns: string | null;
      };
      whatsapp_verificacao_conferir: {
        Args: { p_segredo: string; p_conversa: number; p_hash: string };
        Returns: boolean;
      };
      whatsapp_verificado: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: { cliente_id: number; cliente_nome: string; vale_ate: string }[];
      };
      whatsapp_saldo_do_cliente: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: {
          em_aberto: number;
          vencidas: number;
          proximo_vencimento: string | null;
          valor_do_proximo: number | null;
        }[];
      };
      atendimento_pede_humano: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: undefined;
      };
      atendimento_abandonar: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: undefined;
      };
      setores_do_bot: {
        Args: { p_segredo: string; p_empresa: number };
        Returns: { id: number; nome: string; quando_usar: string | null }[];
      };
      mensagens_do_bot: {
        Args: { p_segredo: string; p_conversa: number; p_limite: number };
        Returns: {
          direcao: string;
          tipo: string;
          texto: string | null;
          do_bot: boolean;
          enviada_em: string;
          midia_id: string | null;
          midia_mime: string | null;
        }[];
      };
      /** ⚠️ Grava com `fkUser` NULO: e o que marca a mensagem como do bot. */
      whatsapp_registrar_saida_do_bot: {
        Args: { p_segredo: string; p_conversa: number; p_wamid: string; p_texto: string };
        Returns: number;
      };
      atendimento_do_bot: {
        Args: {
          p_segredo: string;
          p_conversa: number;
          p_intencao: string | null;
          p_resumo: string | null;
          p_confianca: number | null;
          p_setor: number | null;
          p_situacao: string;
          p_novo: boolean;
          p_lead_nome: string | null;
          p_lead_empresa: string | null;
          p_lead_email: string | null;
        };
        Returns: number;
      };
      whatsapp_credenciais_do_bot: {
        Args: { p_segredo: string; p_conversa: number };
        Returns: {
          phone_number_id: string;
          waba_id: string | null;
          api_versao: string;
          token: string;
        }[];
      };
      gerar_demanda_do_atendimento: {
        Args: {
          p_atendimento: number;
          p_projeto: number;
          p_usuario: string | null;
          p_titulo: string | null;
          p_responsavel: string | null;
        };
        Returns: number;
      };
      whatsapp_contas_da_empresa: {
        Args: { p_empresa: number };
        Returns: {
          id: number;
          apelido: string | null;
          numero: string | null;
          phone_number_id: string;
          waba_id: string | null;
          api_versao: string;
          ativo: boolean;
          tem_token: boolean;
          tem_app_secret: boolean;
          verify_token: string | null;
          bot_ativo: boolean;
          bot_responde_todos: boolean;
          bot_numeros: string | null;
          ia_credencial: number | null;
        }[];
      };
      /** ⚠️ Devolve o token em CLARO, do vault. Nunca sai do servidor. */
      whatsapp_credenciais: {
        Args: { p_conta: number };
        Returns: {
          phone_number_id: string;
          waba_id: string | null;
          api_versao: string;
          token: string;
        }[];
      };
      whatsapp_salvar_conta: {
        Args: {
          p_id: number | null;
          p_empresa: number;
          p_apelido: string | null;
          p_numero: string | null;
          p_phone_number_id: string;
          p_waba_id: string | null;
          p_api_versao: string;
          p_verify_token: string | null;
          p_token: string | null;
          p_app_secret: string | null;
          p_bot_responde_todos: boolean;
          p_bot_numeros: string | null;
          p_bot_ativo: boolean;
          p_ia_credencial: number | null;
        };
        Returns: number;
      };
      whatsapp_desativar_conta: {
        Args: { p_id: number; p_ativo: boolean };
        Returns: undefined;
      };
      /** O `p_segredo` impede que o anon key vire oraculo de verify token. */
      whatsapp_verify_token_valido: {
        Args: { p_segredo: string; p_token: string };
        Returns: boolean;
      };
      /** App Secret da conta dona do numero. Gated pelo segredo global. */
      whatsapp_app_secret_do_numero: {
        Args: { p_segredo: string; p_phone_number_id: string };
        Returns: string | null;
      };
      whatsapp_registrar_evento: {
        Args: { p_segredo: string; p_payload: unknown };
        /**
         * `ignorados` traz o `phone_number_id` de todo evento que nao casou com
         * nenhuma conta, e `campos` o `field` de tudo que passou. Existem para o
         * log dizer O QUE chegou: sem isso, evento descartado e silencio.
         */
        Returns: {
          gravadas: number;
          ignorados: string[];
          campos: string[];
          /** Conversas com mensagem nova. Vazio na reentrega: nada foi gravado. */
          conversas: number[];
        };
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
