import { anonClient } from "@/infra/supabase/client";
import type {
  ContextoDoBot,
  MensagemDoBot,
  SetorDoBot,
  SituacaoAtendimento,
} from "@/modules/atendimento/atendimento.types";
import type { Credenciais } from "@/modules/whatsapp/whatsapp.types";

/**
 * Porta de dados do BOT.
 *
 * ⚠️ Tudo aqui roda dentro do webhook, que nao tem sessao. Por isso usa
 * `anonClient` e todas as funcoes passam o segredo global — a autorizacao nao
 * vem do usuario, vem de o servidor conhecer um segredo que o navegador nao tem.
 *
 * A empresa NUNCA vai por parametro: sai sempre da conversa, dentro do banco.
 */

export async function contexto(
  segredo: string,
  conversaId: number,
): Promise<ContextoDoBot | null> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("whatsapp_contexto_do_bot", {
    p_segredo: segredo,
    p_conversa: conversaId,
  });

  if (error) throw error;

  const l = data?.[0];
  if (!l) return null;

  return {
    empresaId: l.empresa,
    telefone: l.telefone,
    nome: l.nome,
    clienteId: l.cliente_id,
    clienteNome: l.cliente_nome,
    atendimentoId: l.atendimento_id,
    atendimentoSituacao: (l.atendimento_situacao as SituacaoAtendimento | null) ?? null,
    atendimentoSetor: l.atendimento_setor ?? null,
    atendimentoIntencao: l.atendimento_intencao ?? null,
    atendimentoAceito: l.atendimento_aceito ?? false,
    tentativas: l.tentativas,
    humanoRespondeu: l.humano_respondeu,
  };
}

export async function setores(segredo: string, empresaId: number): Promise<SetorDoBot[]> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("setores_do_bot", {
    p_segredo: segredo,
    p_empresa: empresaId,
  });

  if (error) throw error;

  return (data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    quandoUsar: s.quando_usar,
  }));
}

export async function mensagens(
  segredo: string,
  conversaId: number,
  limite = 12,
): Promise<MensagemDoBot[]> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("mensagens_do_bot", {
    p_segredo: segredo,
    p_conversa: conversaId,
    p_limite: limite,
  });

  if (error) throw error;

  return (data ?? []).map((m) => ({
    direcao: m.direcao as "entrada" | "saida",
    tipo: m.tipo,
    texto: m.texto,
    doBot: m.do_bot,
    enviadaEm: m.enviada_em,
  }));
}

export async function credenciaisDoWhatsapp(
  segredo: string,
  conversaId: number,
): Promise<Credenciais | null> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("whatsapp_credenciais_do_bot", {
    p_segredo: segredo,
    p_conversa: conversaId,
  });

  if (error) throw error;

  const l = data?.[0];
  if (!l) return null;

  return {
    phoneNumberId: l.phone_number_id,
    wabaId: l.waba_id,
    apiVersao: l.api_versao,
    token: l.token,
  };
}

/**
 * Liga e desliga o aviso de "a IA esta respondendo".
 *
 * ⚠️ O desligar tem de acontecer em `finally`, sempre. Marca que fica presa
 * bloqueia o campo de escrita do atendente por 45 segundos a toa.
 */
export async function marcarRespondendo(
  segredo: string,
  conversaId: number,
  ativo: boolean,
): Promise<void> {
  const supabase = anonClient();

  const { error } = await supabase.rpc("whatsapp_bot_respondendo", {
    p_segredo: segredo,
    p_conversa: conversaId,
    p_ativo: ativo,
  });

  if (error) throw error;
}

export type Pendencia = {
  conversaId: number;
  acao: "TRIAR" | "LEMBRAR" | "ABANDONAR";
};

/** O que a varredura tem de fazer agora. A decisao vem pronta do banco. */
export async function pendencias(segredo: string, minutos: number): Promise<Pendencia[]> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("bot_conversas_pendentes", {
    p_segredo: segredo,
    p_minutos: minutos,
  });

  if (error) throw error;

  return (data ?? []).map((p) => ({
    conversaId: p.conversa_id,
    acao: p.acao as Pendencia["acao"],
  }));
}

export async function marcarLembrete(segredo: string, conversaId: number): Promise<void> {
  const supabase = anonClient();

  const { error } = await supabase.rpc("atendimento_marcar_lembrete", {
    p_segredo: segredo,
    p_conversa: conversaId,
  });

  if (error) throw error;
}

export async function abandonar(segredo: string, conversaId: number): Promise<void> {
  const supabase = anonClient();

  const { error } = await supabase.rpc("atendimento_abandonar", {
    p_segredo: segredo,
    p_conversa: conversaId,
  });

  if (error) throw error;
}

/** A IA desistiu: o atendimento passa a esperar uma pessoa. */
export async function pedirHumano(segredo: string, conversaId: number): Promise<void> {
  const supabase = anonClient();

  const { error } = await supabase.rpc("atendimento_pede_humano", {
    p_segredo: segredo,
    p_conversa: conversaId,
  });

  if (error) throw error;
}

export async function salvarAtendimento(
  segredo: string,
  conversaId: number,
  entrada: {
    intencao: string | null;
    resumo: string | null;
    confianca: number | null;
    setorId: number | null;
    situacao: SituacaoAtendimento;
    /** Abre linha nova em vez de atualizar a corrente. */
    novo: boolean;
  },
): Promise<number> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("atendimento_do_bot", {
    p_segredo: segredo,
    p_conversa: conversaId,
    p_intencao: entrada.intencao,
    p_resumo: entrada.resumo,
    p_confianca: entrada.confianca,
    p_setor: entrada.setorId,
    p_situacao: entrada.situacao,
    p_novo: entrada.novo,
  });

  if (error) throw error;
  return data as number;
}

/**
 * Grava o que o bot respondeu.
 *
 * ⚠️ `fkUser` fica nulo no banco. E o que distingue bot de pessoa em todo o
 * sistema, e o que faz a regra de silencio funcionar.
 */
export async function registrarSaidaDoBot(
  segredo: string,
  conversaId: number,
  wamid: string,
  texto: string,
): Promise<void> {
  const supabase = anonClient();

  const { error } = await supabase.rpc("whatsapp_registrar_saida_do_bot", {
    p_segredo: segredo,
    p_conversa: conversaId,
    p_wamid: wamid,
    p_texto: texto,
  });

  if (error) throw error;
}
