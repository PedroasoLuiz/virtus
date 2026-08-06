/**
 * Configuracao do provedor de IA, por empresa.
 *
 * Modulo proprio e nao dentro de `whatsapp`: quem paga a chave e a empresa, e o
 * mesmo provedor vai servir outras coisas depois (resumo de conta, classificacao
 * de despesa). Amarrar ao WhatsApp faria a segunda funcionalidade nascer
 * importando um modulo que nao tem nada a ver com ela.
 */

export type ProvedorDeIA = "gemini" | "openai" | "anthropic" | "deepseek";

/**
 * Os provedores oferecidos, na ordem em que aparecem na tela.
 *
 * OpenAI e DeepSeek falam o MESMO protocolo (chat completions), entao um
 * cliente serve os dois: muda a base e o nome do modelo. Gemini tem formato
 * proprio e cliente proprio.
 */
export const PROVEDORES: { valor: ProvedorDeIA; rotulo: string; modeloPadrao: string }[] = [
  { valor: "gemini", rotulo: "Google Gemini", modeloPadrao: "gemini-3.5-flash-lite" },
  { valor: "openai", rotulo: "OpenAI", modeloPadrao: "gpt-5-mini" },
  { valor: "anthropic", rotulo: "Anthropic Claude", modeloPadrao: "claude-haiku-4-5" },
  { valor: "deepseek", rotulo: "DeepSeek", modeloPadrao: "deepseek-chat" },
];

/**
 * ⚠️ NAO carrega a chave. Ela vive no `supabase_vault` e nunca sai do servidor —
 * a tela sabe apenas SE existe, o que basta para mostrar "configurado" e para
 * nao exigir redigitacao ao trocar o modelo.
 */
export type ConfigIA = {
  provedor: ProvedorDeIA;
  modelo: string;
  ativo: boolean;
  temChave: boolean;
  /**
   * Ordem de tentativa. 1 e o principal.
   *
   * ⚠️ Existe porque provedor cai, estoura cota e muda de preco. Com uma chave
   * so, qualquer um desses tres para o atendimento inteiro.
   */
  ordem: number;
  /**
   * Modo de teste: o bot atende SO estes numeros.
   *
   * ⚠️ E a trava de seguranca para ligar em producao. Enquanto houver numero
   * aqui, cliente de verdade nunca recebe resposta automatica, mesmo com tudo
   * ativo. Vazio significa "atende todo mundo".
   *
   * Varios de propósito, separados por virgula: validar com uma pessoa so nao
   * basta — o teste util envolve quem nao conhece o sistema.
   */
  numeroTeste: string | null;
};

/** Credencial em claro. Existe so no servidor. */
export type CredencialIA = {
  provedor: ProvedorDeIA;
  modelo: string;
  chave: string;
  numeroTeste: string | null;
  ordem: number;
};

/**
 * Modelos oferecidos na tela.
 *
 * ⚠️ Esta lista ENVELHECE. O Google descontinua variante com poucas semanas de
 * aviso: as duas 2.0, que estavam aqui, ja constam como desligadas na
 * documentacao (conferido em 05/08/2026). Por isso o campo aceita texto livre —
 * a lista e sugestao, nao trava, e modelo novo nao exige deploy.
 *
 * `flash-lite` primeiro porque triagem e classificacao de mensagem curta, o
 * trabalho mais barato que existe. Modelo de raciocinio para escolher entre tres
 * setores seria desperdicio, cobrado por mensagem recebida.
 */
export const MODELOS_SUGERIDOS = [
  { valor: "gemini-3.5-flash-lite", rotulo: "Gemini 3.5 Flash Lite (rápido e barato)" },
  { valor: "gemini-3.1-flash-lite", rotulo: "Gemini 3.1 Flash Lite (barato)" },
  { valor: "gemini-3.6-flash", rotulo: "Gemini 3.6 Flash (mais capaz)" },
  { valor: "gemini-3.5-flash", rotulo: "Gemini 3.5 Flash (raciocínio)" },
];

export const CONFIG_IA_PADRAO: ConfigIA = {
  provedor: "gemini",
  modelo: "gemini-3.5-flash-lite",
  ativo: false,
  temChave: false,
  ordem: 1,
  numeroTeste: null,
};

/**
 * Sugestoes por provedor. Como as do Gemini, ENVELHECEM: o campo continua
 * aceitando texto livre para modelo novo nao exigir deploy.
 */
export const MODELOS_POR_PROVEDOR: Record<ProvedorDeIA, { valor: string; rotulo: string }[]> = {
  gemini: MODELOS_SUGERIDOS,
  openai: [
    { valor: "gpt-5-mini", rotulo: "GPT-5 mini (rápido e barato)" },
    { valor: "gpt-5", rotulo: "GPT-5 (mais capaz)" },
    { valor: "gpt-4.1-mini", rotulo: "GPT-4.1 mini" },
  ],
  anthropic: [
    { valor: "claude-haiku-4-5", rotulo: "Claude Haiku 4.5 (rápido e barato)" },
    { valor: "claude-sonnet-5", rotulo: "Claude Sonnet 5 (mais capaz)" },
    { valor: "claude-opus-5", rotulo: "Claude Opus 5 (raciocínio)" },
  ],
  deepseek: [
    { valor: "deepseek-chat", rotulo: "DeepSeek Chat (barato)" },
    { valor: "deepseek-reasoner", rotulo: "DeepSeek Reasoner (raciocínio)" },
  ],
};
