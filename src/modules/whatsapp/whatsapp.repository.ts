import { anonClient, serverClient } from "@/infra/supabase/client";
import type {
  AtendimentoDaConversa,
  ClienteCandidato,
  ContaWhatsapp,
  Conversa,
  Credenciais,
  Mensagem,
  ResultadoDoEvento,
} from "@/modules/whatsapp/whatsapp.types";

/** Unica porta de acesso aos dados do WhatsApp. */

const COLUNAS_CONVERSA =
  'id, "fkConta", telefone, nome, "fkCliente", ultima_em, ultimo_texto, ultimo_tipo, ultima_direcao, nao_lidas, janela_expira_em, bot_respondendo_em';

/**
 * O nome do cliente vem por join, nao copiado para a conversa: renomear o
 * cadastro tem de refletir no painel.
 *
 * ⚠️ `whatsappconversas` tem UMA so FK para `clientes`, entao o embed simples
 * basta. Se um dia entrar uma segunda (ex.: fornecedor), isto vira PGRST201 e
 * passa a exigir o nome da constraint.
 */
const RELACAO_CLIENTE = "clientes(razao, urlicon)";

const COLUNAS_MENSAGEM =
  'id, direcao, tipo, texto, midia_id, midia_mime, midia_nome, status, erro, enviada_em, "fkUser"';

type LinhaConversa = {
  id: number;
  fkConta: number;
  telefone: string;
  nome: string | null;
  fkCliente: number | null;
  ultima_em: string | null;
  ultimo_texto: string | null;
  ultimo_tipo: string | null;
  ultima_direcao: "entrada" | "saida" | null;
  nao_lidas: number;
  janela_expira_em: string | null;
  bot_respondendo_em: string | null;
  clientes?: { razao: string | null; urlicon: string | null } | null;
};

type LinhaMensagem = {
  id: number;
  direcao: "entrada" | "saida";
  tipo: string;
  texto: string | null;
  midia_id: string | null;
  midia_mime: string | null;
  midia_nome: string | null;
  status: string | null;
  erro: string | null;
  enviada_em: string;
  fkUser: string | null;
};

// ── Contas (numeros) ────────────────────────────────────────────

/**
 * Contas da empresa, SEM segredo.
 *
 * Via RPC porque `whatsappcontas` nao tem policy — ela guarda referencia a
 * segredo, entao fica fechada por padrao e so funcao `security definer` le. A
 * checagem de tenant mora dentro da funcao, nao no parametro.
 */
export async function listarContas(empresaId: number): Promise<ContaWhatsapp[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("whatsapp_contas_da_empresa", {
    p_empresa: empresaId,
  });

  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id,
    apelido: c.apelido,
    numero: c.numero,
    phoneNumberId: c.phone_number_id,
    wabaId: c.waba_id,
    apiVersao: c.api_versao,
    ativo: c.ativo,
    temToken: c.tem_token,
    temAppSecret: c.tem_app_secret,
    verifyToken: c.verify_token,
    botRespondeTodos: c.bot_responde_todos ?? false,
    botNumeros: c.bot_numeros ?? null,
  }));
}

/**
 * Credenciais para falar com a Meta, com o token saindo do vault.
 *
 * ⚠️ O retorno tem token em claro. Nunca devolver ao navegador nem colocar em
 * log — nem no de erro.
 */
export async function credenciais(contaId: number): Promise<Credenciais | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("whatsapp_credenciais", {
    p_conta: contaId,
  });

  if (error) throw error;

  const linha = data?.[0];
  if (!linha) return null;

  return {
    phoneNumberId: linha.phone_number_id,
    wabaId: linha.waba_id,
    apiVersao: linha.api_versao,
    token: linha.token,
  };
}

export async function salvarConta(
  empresaId: number,
  entrada: {
    id: number | null;
    apelido: string | null;
    numero: string | null;
    phoneNumberId: string;
    wabaId: string | null;
    apiVersao: string;
    verifyToken: string | null;
    token: string | null;
    appSecret: string | null;
    botRespondeTodos: boolean;
    botNumeros: string | null;
  },
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("whatsapp_salvar_conta", {
    p_id: entrada.id,
    p_empresa: empresaId,
    p_apelido: entrada.apelido,
    p_numero: entrada.numero,
    p_phone_number_id: entrada.phoneNumberId,
    p_waba_id: entrada.wabaId,
    p_api_versao: entrada.apiVersao,
    p_verify_token: entrada.verifyToken,
    p_token: entrada.token,
    p_app_secret: entrada.appSecret,
    p_bot_responde_todos: entrada.botRespondeTodos,
    p_bot_numeros: entrada.botNumeros,
  });

  if (error) throw error;
  return data as number;
}

export async function definirAtiva(contaId: number, ativo: boolean): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc("whatsapp_desativar_conta", {
    p_id: contaId,
    p_ativo: ativo,
  });

  if (error) throw error;
}

/**
 * App Secret da conta dona de um `phone_number_id`.
 *
 * Roda sem sessao, no webhook. O `phone_number_id` vem do corpo NAO CONFIADO e
 * serve so para escolher a chave — quem autentica e o HMAC conferido logo
 * depois. O `segredo` global e o que impede um portador do anon key de usar
 * isto como oraculo.
 */
export async function appSecretDoNumero(
  segredo: string,
  phoneNumberId: string,
): Promise<string | null> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("whatsapp_app_secret_do_numero", {
    p_segredo: segredo,
    p_phone_number_id: phoneNumberId,
  });

  if (error) throw error;
  return data ?? null;
}

/**
 * O handshake da Meta bate com alguma conta ativa?
 *
 * ⚠️ Vai com o segredo global mesmo o GET da Meta nao tendo um. A funcao e
 * executavel por `anon`, e sem portao ela responderia "sim/nao" para qualquer
 * palpite de verify token — um oraculo de forca bruta aberto a quem tem o anon
 * key. O segredo vive so no servidor, entao so o webhook consegue perguntar.
 */
export async function verifyTokenValido(segredo: string, token: string): Promise<boolean> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("whatsapp_verify_token_valido", {
    p_segredo: segredo,
    p_token: token,
  });

  if (error) throw error;
  return data === true;
}

// ── Conversas ───────────────────────────────────────────────────

export async function listarConversas(
  empresaId: number,
  contaId: number | undefined,
  busca: string | undefined,
): Promise<Conversa[]> {
  const supabase = await serverClient();

  let query = supabase
    .from("whatsappconversas")
    .select(`${COLUNAS_CONVERSA}, ${RELACAO_CLIENTE}`)
    .eq("fkEmpresa", empresaId);

  // Cada numero tem a propria caixa de entrada, como no WhatsApp Business.
  if (contaId != null) query = query.eq("fkConta", contaId);

  if (busca) {
    const termo = `%${busca}%`;
    query = query.or(`telefone.ilike.${termo},nome.ilike.${termo}`);
  }

  // `nulls first` seria pior: conversa sem mensagem nenhuma subiria ao topo.
  const { data, error } = await query
    .order("ultima_em", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []).map((l) => paraConversa(l as unknown as LinhaConversa));
}

/**
 * A conversa daquele contato naquele numero, criando se ainda nao existir.
 *
 * ⚠️ Necessaria porque cobranca sai do sistema para quem talvez nunca tenha
 * escrito: ate agora toda conversa nascia de uma mensagem RECEBIDA.
 *
 * ⚠️ O casamento e pelos 8 ULTIMOS digitos, dentro do banco, e nao por
 * igualdade. O cadastro guarda "(35) 9 9898-2044" e a Meta manda
 * "553598982044", sem o nono digito: comparacao exata abria uma conversa nova
 * ao lado da que ja existia, com o historico todo do outro lado.
 */
export async function garantirConversa(
  empresaId: number,
  contaId: number,
  telefone: string,
  nome: string | null,
): Promise<Conversa> {
  const supabase = await serverClient();

  const { data: id, error } = await supabase.rpc("whatsapp_garantir_conversa", {
    p_empresa: empresaId,
    p_conta: contaId,
    p_telefone: telefone,
    p_nome: nome,
  });

  if (error) throw error;

  const conversa = await buscarConversa(empresaId, id as number);
  if (!conversa) throw new Error("conversa criada mas nao encontrada");

  return conversa;
}

export async function buscarConversa(empresaId: number, id: number): Promise<Conversa | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("whatsappconversas")
    .select(`${COLUNAS_CONVERSA}, ${RELACAO_CLIENTE}`)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? paraConversa(data as unknown as LinhaConversa) : null;
}

/**
 * O que a triagem entendeu desta conversa, para quem for responder.
 *
 * Ultimo atendimento e nao "o aberto": encerrado tambem interessa, porque a
 * pergunta que este dado responde e "o que essa pessoa queria?", e ela vale
 * igual depois de a fila ter fechado o caso.
 *
 * Sem `fkEmpresa` explicito seria a RLS sozinha barrando o vazamento. Ela barra,
 * mas o filtro fica escrito assim mesmo: uma politica trocada por engano nao
 * pode virar leitura de conversa alheia.
 */
export async function atendimentoDaConversa(
  empresaId: number,
  conversaId: number,
): Promise<AtendimentoDaConversa | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("atendimentos")
    .select(
      "id, intencao, resumo, confianca, situacao, created_at, lead_nome, lead_empresa, lead_email, setores(nome)",
    )
    .eq("fkEmpresa", empresaId)
    .eq("fkConversa", conversaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // `setores` volta como objeto ou lista dependendo de como o PostgREST resolve
  // a relacao. Normalizar aqui evita a checagem espalhada pela tela.
  const setor = Array.isArray(data.setores) ? data.setores[0] : data.setores;

  return {
    id: data.id,
    intencao: data.intencao,
    resumo: data.resumo,
    confianca: data.confianca == null ? null : Number(data.confianca),
    situacao: data.situacao as AtendimentoDaConversa["situacao"],
    setorNome: setor?.nome ?? null,
    leadNome: data.lead_nome,
    leadEmpresa: data.lead_empresa,
    leadEmail: data.lead_email,
    criadoEm: data.created_at,
  };
}

export async function listarMensagens(
  empresaId: number,
  conversaId: number,
): Promise<Mensagem[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("whatsappmensagens")
    .select(COLUNAS_MENSAGEM)
    .eq("fkEmpresa", empresaId)
    .eq("fkConversa", conversaId)
    .order("enviada_em", { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data ?? []).map((l) => paraMensagem(l as unknown as LinhaMensagem));
}

/**
 * Cadastros cujo telefone casa com o da conversa.
 *
 * Devolve TODOS os candidatos, nao o "melhor": quando ha mais de um, a conversa
 * fica sem vinculo de proposito (ver `whatsapp_cliente_do_telefone` no banco), e
 * esta lista e o que explica ao usuario POR QUE ela ficou sem — em vez de a tela
 * so mostrar um numero solto sem dizer que conhece cinco cadastros com ele.
 *
 * O criterio e o mesmo da ingestao: 8 ultimos digitos. O nono digito do celular
 * entra e sai do cadastro, e comparar o numero inteiro erra mais do que acerta.
 */
export async function clientesDoTelefone(
  empresaId: number,
  telefone: string,
): Promise<ClienteCandidato[]> {
  const supabase = await serverClient();

  // Via RPC e nao `.from("clientes")`: o filtro compara DIGITOS, e `contato` vem
  // mascarado no cadastro — pelo PostgREST o LIKE seria no texto cru e nao
  // casaria. A funcao e SECURITY INVOKER, entao a RLS continua respondendo.
  const { data, error } = await supabase.rpc("whatsapp_clientes_do_telefone", {
    p_empresa: empresaId,
    p_telefone: telefone,
  });

  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id,
    razao: c.razao ?? "",
    nomeFantasia: c.nomefantasia,
    contato: c.contato,
    cnpj: c.cnpj,
    ativo: c.ativo ?? true,
  }));
}

/** O que gravar depois de a Meta aceitar. Serve texto, anexo e modelo. */
export type SaidaGravavel = {
  wamid: string;
  tipo: string;
  texto: string | null;
  midiaId?: string | null;
  midiaMime?: string | null;
  midiaNome?: string | null;
};

/** Grava do nosso lado o que a Meta ja aceitou. O `wamid` liga os dois. */
export async function registrarEnviada(
  empresaId: number,
  conversaId: number,
  usuarioId: string,
  saida: SaidaGravavel,
): Promise<Mensagem> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("whatsappmensagens")
    .insert({
      fkEmpresa: empresaId,
      fkConversa: conversaId,
      fkUser: usuarioId,
      wamid: saida.wamid,
      direcao: "saida",
      tipo: saida.tipo,
      texto: saida.texto,
      midia_id: saida.midiaId ?? null,
      midia_mime: saida.midiaMime ?? null,
      midia_nome: saida.midiaNome ?? null,
      status: "enviado",
      enviada_em: new Date().toISOString(),
    })
    .select(COLUNAS_MENSAGEM)
    .single();

  if (error) throw error;

  // A previa da lista e derivada, nao ha gatilho para ela: enviar sem atualizar
  // deixaria a conversa parada no ultimo texto do cliente.
  const { error: erroConversa } = await supabase
    .from("whatsappconversas")
    .update({
      ultima_em: data.enviada_em,
      ultimo_texto: saida.texto,
      ultimo_tipo: saida.tipo,
      ultima_direcao: "saida",
    })
    .eq("fkEmpresa", empresaId)
    .eq("id", conversaId);

  if (erroConversa) throw erroConversa;

  return paraMensagem(data as unknown as LinhaMensagem);
}

/**
 * Guarda o telefone da conversa como contato do cliente.
 *
 * Nao escreve `fkCliente` na conversa: quem faz isso e o gatilho
 * `clientescontatos_revincula_whatsapp`, no banco. Assim existe UMA regra de
 * vinculo, e ela vale tanto para quem cadastra pela tela quanto para quem mexe
 * direto no cadastro do cliente.
 *
 * A RLS de `clientescontatos` confere o tenant pelo cliente pai: nao da para
 * pendurar contato em cliente de outra empresa.
 */
export async function vincularCliente(
  conversaId: number,
  clienteId: number,
  telefone: string,
  rotulo: string | null,
  usuarioId: string,
): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase.from("clientescontatos").insert({
    fkCliente: clienteId,
    fkUserCriacao: usuarioId,
    tipo: "whatsapp",
    valor: telefone,
    rotulo,
  });

  if (error) throw error;
  void conversaId;
}

/**
 * Existe mensagem com esta midia DENTRO desta conversa?
 *
 * ⚠️ Sem esta pergunta a rota de midia autoriza pelo portador: bastava ter
 * sessao e uma conversa qualquer da propria empresa para pedir qualquer id de
 * midia, e o servidor buscaria na Meta com o token daquela conta. Conferir o
 * recurso, e nao so quem pede, e o que fecha isso.
 */
export async function midiaEhDaConversa(
  empresaId: number,
  conversaId: number,
  midiaId: string,
): Promise<boolean> {
  const supabase = await serverClient();

  const { count, error } = await supabase
    .from("whatsappmensagens")
    .select("id", { count: "exact", head: true })
    .eq("fkEmpresa", empresaId)
    .eq("fkConversa", conversaId)
    .eq("midia_id", midiaId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function zerarNaoLidas(empresaId: number, conversaId: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("whatsappconversas")
    .update({ nao_lidas: 0 })
    .eq("fkEmpresa", empresaId)
    .eq("id", conversaId);

  if (error) throw error;
}

/**
 * Ingestao do webhook.
 *
 * Sem sessao e sem empresa: a funcao no banco resolve o tenant pelo
 * `phone_number_id` do proprio payload e confere o segredo.
 *
 * `gravadas` conta mensagens NOVAS — reentrega da Meta devolve zero, e e assim
 * que se ve que a idempotencia funcionou. `ignorados` e `campos` existem para o
 * log: evento descartado em silencio e investigacao no escuro.
 */
export async function registrarEvento(
  segredo: string,
  payload: unknown,
): Promise<ResultadoDoEvento> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("whatsapp_registrar_evento", {
    p_segredo: segredo,
    p_payload: payload,
  });

  if (error) throw error;

  return {
    gravadas: data?.gravadas ?? 0,
    ignorados: data?.ignorados ?? [],
    campos: data?.campos ?? [],
    conversas: data?.conversas ?? [],
  };
}

function paraConversa(l: LinhaConversa): Conversa {
  return {
    id: l.id,
    contaId: l.fkConta,
    telefone: l.telefone,
    nome: l.nome,
    clienteId: l.fkCliente,
    clienteNome: l.clientes?.razao ?? null,
    clienteIcone: l.clientes?.urlicon || null,
    ultimaEm: l.ultima_em,
    ultimoTexto: l.ultimo_texto,
    ultimoTipo: l.ultimo_tipo,
    ultimaDirecao: l.ultima_direcao,
    naoLidas: l.nao_lidas,
    janelaExpiraEm: l.janela_expira_em,
    botRespondendoEm: l.bot_respondendo_em ?? null,
  };
}

function paraMensagem(l: LinhaMensagem): Mensagem {
  return {
    id: l.id,
    direcao: l.direcao,
    tipo: l.tipo,
    texto: l.texto,
    midiaId: l.midia_id,
    midiaMime: l.midia_mime,
    midiaNome: l.midia_nome,
    status: l.status,
    erro: l.erro,
    enviadaEm: l.enviada_em,
    // Saida sem usuario e do bot. Ver o comentario em `Mensagem`.
    doBot: l.direcao === "saida" && l.fkUser == null,
  };
}
