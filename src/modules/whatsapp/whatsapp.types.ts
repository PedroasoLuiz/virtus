/**
 * Entidades da caixa de entrada do WhatsApp.
 *
 * A Cloud API nao guarda historico: mensagem recebida chega uma vez, por
 * webhook, e some. As tabelas `whatsappconversas` / `whatsappmensagens` sao a
 * unica copia que existe — por isso o webhook grava antes de qualquer coisa.
 */

export type Direcao = "entrada" | "saida";

/**
 * Um numero de WhatsApp da empresa.
 *
 * ⚠️ NAO carrega token nem app secret. Eles vivem no `supabase_vault` e nunca
 * saem do servidor — a tela sabe apenas SE estao preenchidos, o que basta para
 * mostrar "configurado" e para nao exigir redigitacao ao editar o apelido.
 */
export type ContaWhatsapp = {
  id: number;
  apelido: string | null;
  numero: string | null;
  phoneNumberId: string;
  wabaId: string | null;
  apiVersao: string;
  ativo: boolean;
  temToken: boolean;
  temAppSecret: boolean;
  verifyToken: string | null;
};

/** Credenciais para falar com a Meta. Existem so no servidor. */
export type Credenciais = {
  phoneNumberId: string;
  wabaId: string | null;
  apiVersao: string;
  token: string;
};

/** Rotulo do numero no seletor. Apelido quando ha, senao o proprio numero. */
export function rotuloDaConta(c: ContaWhatsapp): string {
  if (c.apelido?.trim()) return c.apelido.trim();
  return c.numero ? formatarTelefone(c.numero) : c.phoneNumberId;
}

/**
 * O que um lote do webhook produziu.
 *
 * `ignorados` e `campos` nao alimentam tela nenhuma: existem para o log. A Meta
 * entrega no mesmo POST coisas que nao sao mensagem (status de template, alerta
 * de qualidade), e sem registrar o que passou nao ha como descobrir por que algo
 * nao apareceu no painel.
 */
export type ResultadoDoEvento = {
  gravadas: number;
  /** `phone_number_id` que nao casou com nenhuma conta cadastrada. */
  ignorados: string[];
  /** O `field` de cada mudanca do lote: `messages`, `message_template_status_update`… */
  campos: string[];
  /**
   * Conversas que receberam mensagem NOVA.
   *
   * ⚠️ Vem vazio na reentrega da Meta, porque nada foi gravado. E isso que
   * impede o bot de responder duas vezes ao mesmo cliente: a idempotencia por
   * `wamid` vira, de graca, a trava do bot.
   */
  conversas: number[];
};

export type Conversa = {
  id: number;
  /** Numero da casa por onde esta conversa corre. A resposta sai por ele. */
  contaId: number;
  telefone: string;
  /** Nome do perfil no WhatsApp. Pode nao existir. */
  nome: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  /** Logo do cliente (`clientes.urlicon`). Vira a foto do contato quando existe. */
  clienteIcone: string | null;
  ultimaEm: string | null;
  ultimoTexto: string | null;
  /** Tipo da ultima mensagem: a lista mostra icone quando nao e texto. */
  ultimoTipo: string | null;
  ultimaDirecao: Direcao | null;
  naoLidas: number;
  janelaExpiraEm: string | null;
  /**
   * Quando a IA comecou a responder aqui, ou null.
   *
   * O painel bloqueia o campo de escrita enquanto estiver preenchido e recente,
   * para o atendente nao responder por cima dela.
   */
  botRespondendoEm: string | null;
};

/**
 * Cadastro que casa com o telefone de uma conversa.
 *
 * Plural de proposito: quando ha mais de um, a conversa fica SEM vinculo, e esta
 * lista e o que explica o porque. Nesta base o mesmo telefone chega a ser
 * contato de oito clientes distintos.
 */
export type ClienteCandidato = {
  id: number;
  razao: string;
  nomeFantasia: string | null;
  contato: string | null;
  cnpj: string | null;
  ativo: boolean;
};

export type Mensagem = {
  id: number;
  direcao: Direcao;
  tipo: string;
  texto: string | null;
  midiaId: string | null;
  midiaMime: string | null;
  midiaNome: string | null;
  /** `recebido` na entrada; na saida acompanha a Meta: enviado, entregue, lido, falhou. */
  status: string | null;
  erro: string | null;
  enviadaEm: string;
  /**
   * Saida sem usuario e do bot.
   *
   * ⚠️ `fkUser` nulo E o marcador. Nao ha coluna "origem": o bot nao tem usuario
   * em `auth.users`, e inventar um so para preencher esconderia justamente o que
   * se quer ver.
   */
  doBot: boolean;
};

/**
 * Modelo aprovado na Meta.
 *
 * E o unico jeito de escrever para quem esta fora da janela de 24h. Os
 * parametros sao posicionais (`{{1}}`, `{{2}}`…), nao nomeados — a Meta nao
 * guarda rotulo para eles, entao a tela so pode oferecer "campo 1", "campo 2".
 */
export type Modelo = {
  nome: string;
  idioma: string;
  categoria: string;
  /** O texto do corpo, com os `{{n}}` no lugar. Serve de previa. */
  corpo: string;
  cabecalho: string | null;
  rodape: string | null;
  /** Quantos `{{n}}` o corpo espera. */
  parametros: number;
};

/**
 * O resumo da triagem que aparece ao abrir a conversa.
 *
 * ⚠️ Existe para responder uma pergunta especifica de quem atende: "o bot disse
 * que ia transferir, transferiu mesmo?". Por isso `situacao` e `setorNome` vem
 * junto do texto, e nao so o resumo.
 */
export type AtendimentoDaConversa = {
  id: number;
  intencao: string | null;
  resumo: string | null;
  confianca: number | null;
  situacao: "TRIAGEM" | "ENCAMINHADO" | "HUMANO" | "ACEITO" | "RECUSADO" | "ABANDONADO";
  setorNome: string | null;
  criadoEm: string;
};

/** Tipos de anexo que o painel envia. */
export const TIPOS_DE_ENVIO = ["image", "audio", "video", "document"] as const;
export type TipoDeEnvio = (typeof TIPOS_DE_ENVIO)[number];

/**
 * Limites de tamanho da Cloud API, em bytes.
 *
 * Conferidos aqui e nao so na Meta para a recusa ser imediata e explicada: subir
 * 90 MB para receber um erro cru depois de dois minutos de espera e pior que
 * barrar na hora.
 */
export const LIMITE_POR_TIPO: Record<TipoDeEnvio, number> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

/** Descobre o tipo de envio a partir do MIME do arquivo. */
export function tipoDoArquivo(mime: string): TipoDeEnvio {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/**
 * Rotulo da previa na lista, quando a ultima mensagem nao e texto.
 *
 * Espelha o WhatsApp: a lista diz "Foto", "Áudio", e a legenda quando existe.
 * Mora aqui porque a tela precisa e o service tambem poderia usar.
 */
export function rotuloDoTipo(tipo: string | null): string | null {
  const porTipo: Record<string, string> = {
    image: "Foto",
    sticker: "Figurinha",
    audio: "Áudio",
    voice: "Mensagem de voz",
    video: "Vídeo",
    document: "Documento",
    location: "Localização",
    contacts: "Contato",
  };

  return tipo ? (porTipo[tipo] ?? null) : null;
}

/**
 * Texto da mensagem como a LISTA mostra.
 *
 * Tira a assinatura do autor e a marcacao do WhatsApp, e achata as quebras de
 * linha. A lista tem duas linhas e ja diz "Voce:" por conta propria — repetir
 * "*PEDRO LUIZ:*" ali gastaria metade do espaco com o que ja esta dito, e os
 * asteriscos apareceriam crus porque a previa nao renderiza formatacao.
 */
export function previaDoTexto(texto: string | null, direcao: Direcao | null): string | null {
  if (!texto) return null;

  const semAssinatura =
    direcao === "saida" ? texto.replace(/^\*[^*\n]+:\*\n/, "") : texto;

  return semAssinatura
    .replace(/[*_~]/g, "")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/**
 * Janela de atendimento de 24 horas.
 *
 * Regra da Meta, nao nossa: passadas 24h da ULTIMA mensagem do cliente, texto
 * livre e recusado com o erro 131047 e so template aprovado passa. O painel
 * precisa disso para desabilitar o campo em vez de deixar o usuario escrever e
 * levar erro no envio.
 *
 * Mora em `types.ts` e nao no service porque a tela tambem chama: componente de
 * cliente que importa service arrasta o Supabase para o bundle e quebra o build.
 */
/**
 * A IA esta respondendo agora?
 *
 * Marca com mais de 45 segundos e tratada como abandonada. O processo pode
 * morrer no meio, e sem este limite o campo de escrita ficaria travado para
 * sempre esperando uma resposta que nao vem.
 */
export function botRespondendo(marcadoEm: string | null): boolean {
  if (!marcadoEm) return false;

  const inicio = new Date(marcadoEm).getTime();
  if (!Number.isFinite(inicio)) return false;

  return Date.now() - inicio < 45_000;
}

export function janelaAberta(janelaExpiraEm: string | null): boolean {
  if (!janelaExpiraEm) return false;
  const fim = new Date(janelaExpiraEm).getTime();
  return Number.isFinite(fim) && fim > Date.now();
}

/** Só os dígitos, sem máscara. */
export function digitosDoTelefone(bruto: string): string {
  return bruto.replace(/\D/g, "");
}

/**
 * Telefone como a Meta espera: so digitos, com DDI.
 *
 * ⚠️ A decisao de "ja tem DDI?" e por COMPRIMENTO, e nao por comecar com 55.
 * Pelo prefixo, um fixo do DDD 55 (Rio Grande do Sul) como `5533334444` seria
 * lido como um numero de 8 digitos com DDI, e o 55 do DDD viraria o pais.
 *
 *   10 ou 11 digitos = DDD + numero, falta o DDI
 *   12 ou 13 digitos = ja veio completo
 *
 * O nono digito NUNCA e inventado aqui: quem responde e sempre um numero que ja
 * escreveu, e esse veio pronto da Meta.
 */
export function paraFormatoMeta(bruto: string): string {
  const d = digitosDoTelefone(bruto);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/** Exibicao: +55 (35) 99119-2508 */
export function formatarTelefone(bruto: string): string {
  const d = digitosDoTelefone(bruto);
  if (!d.startsWith("55") || d.length < 12) return bruto;

  const ddd = d.slice(2, 4);
  const resto = d.slice(4);
  const meio = resto.length > 8 ? resto.slice(0, resto.length - 4) : resto.slice(0, 4);
  const fim = resto.slice(-4);

  return `+55 (${ddd}) ${meio}-${fim}`;
}

/**
 * Mascara enquanto se digita: +55 (00) 00000-0000
 *
 * Progressiva de proposito — formata o que ja foi digitado sem esperar o numero
 * ficar completo. O hifen entra depois do quarto digito do numero local e
 * ANDA uma casa quando chega o nono, que e o comportamento das mascaras
 * brasileiras: fixo fecha em 4+4, celular em 5+4.
 *
 * ⚠️ Recebe e devolve TEXTO de exibicao. O que se grava sao os digitos, tirados
 * com `digitosDoTelefone` — mascara nunca vai para o banco.
 */
export function mascararTelefone(bruto: string): string {
  const d = digitosDoTelefone(bruto).slice(0, 13);
  if (!d) return "";

  if (d.length <= 2) return `+${d}`;

  const ddi = d.slice(0, 2);
  const ddd = d.slice(2, 4);
  if (d.length <= 4) return `+${ddi} (${ddd}`;

  const local = d.slice(4);
  if (local.length <= 4) return `+${ddi} (${ddd}) ${local}`;

  const corte = local.length > 8 ? 5 : 4;
  return `+${ddi} (${ddd}) ${local.slice(0, corte)}-${local.slice(corte)}`;
}
