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
  /**
   * O bot responde a qualquer contato deste numero.
   *
   * ⚠️ Desligado com a lista vazia, ele nao responde a NINGUEM. E o padrao de
   * conta nova: ligar o atendimento automatico passa a ser um ato.
   */
  /** Este numero usa atendimento por IA. Desligado, os dois abaixo nao valem. */
  botAtivo: boolean;
  /**
   * Com qual credencial de IA este numero fala.
   *
   * ⚠️ Nulo cai na fila da empresa. Preenchido, so aquela chave e tentada: e o
   * que permite a conta de cada setor sair separada, e uma reserva de outro
   * setor furaria justamente essa separacao.
   */
  iaCredencialId: number | null;
  botRespondeTodos: boolean;
  /** Quando nao responde a todos, so estes. Um por linha. */
  botNumeros: string | null;
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

/**
 * Cor de etiqueta.
 *
 * ⚠️ Slug do design system, e nao hex. Cor livre parece liberdade e vira
 * problema: o roxo que o usuario escolheu no tema claro some no escuro, e nao ha
 * ninguem para corrigir depois.
 */
export type CorDeEtiqueta = "verde" | "azul" | "ambar" | "vermelho" | "roxo" | "cinza";

/** Classificacao de conversa. Pertence a EMPRESA: rotulo de uma so nao filtra. */
export type Etiqueta = {
  id: number;
  nome: string;
  cor: CorDeEtiqueta;
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
  /** Ids das etiquetas desta conversa. Os nomes vem da lista da empresa. */
  etiquetas: number[];
  /** Fora da caixa de entrada, mas com o historico inteiro no lugar. */
  arquivada: boolean;
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
  /**
   * O botao de URL, quando o modelo tem um.
   *
   * ⚠️ Nao entra na contagem de `parametros`: na Meta ele e outro componente, e
   * o `{{1}}` da URL e independente dos `{{n}}` do corpo. Contar junto faria a
   * validacao de quantidade recusar um envio correto.
   *
   * `temVariavel` diz se a URL termina em `{{1}}`, ou seja, se ela ESPERA que o
   * sistema complete o endereco. Sem isso, um botao de link fixo pediria um
   * valor que a Meta ignoraria.
   */
  botao: { texto: string; temVariavel: boolean } | null;
  /**
   * Por que este modelo NAO pode sair do painel, ou null.
   *
   * ⚠️ Botao de pedido, catalogo ou formulario exige um `action` que so quem
   * montou aquele fluxo sabe preencher. Sem isto o modelo aparecia na lista, a
   * pessoa escolhia, e a Meta devolvia "'action' cannot be null for
   * ORDER_DETAILS button type" — um erro que chega depois do clique e nao diz
   * que a culpa era da escolha.
   */
  bloqueio: string | null;
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
  /** Quem escreve, quando o contato e novo e nao havia cadastro. */
  leadNome: string | null;
  leadEmpresa: string | null;
  leadEmail: string | null;
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
    /*
     * ⚠️ A Meta manda `unsupported` para o que a API nao entrega: enquete,
     * pagamento, mensagem apagada. Sem rotulo, a linha ficava com um traco solto
     * no lugar da previa e ninguem sabia se era falha nossa ou coisa do
     * remetente.
     */
    unsupported: "Mensagem não suportada",
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
 * O nono digito do celular brasileiro, resolvido.
 *
 * ⚠️ O Brasil tem DOIS jeitos de escrever o mesmo celular. Desde 2016 o numero
 * tem 11 digitos com DDD (o 9 na frente), mas cadastro antigo, base importada e
 * o proprio `wa_id` da Meta ainda aparecem com 10. Os dois sao o mesmo telefone,
 * e sem resolver isso o cliente entra duas vezes na lista de conversas e a busca
 * pelo cadastro nao acha.
 *
 * A decisao e DECIDIVEL, e nao um chute: num numero local de 10 digitos, o
 * primeiro digito depois do DDD diz o que ele e. De 6 a 9 e celular, e ali falta
 * o nono; de 2 a 5 e fixo, e ali o 9 nao existe e inventa-lo criaria um numero
 * que nao toca em lugar nenhum.
 *
 * ⚠️ So vale para o DDI 55. Argentina tem regra propria (o 9 vem ANTES do DDD,
 * depois do pais), e aplicar esta aqui quebraria os numeros de la.
 */
export function comNonoDigito(ddi: string, local: string): string {
  const d = digitosDoTelefone(local);

  if (ddi !== "55" || d.length !== 10) return d;

  const primeiro = d[2];
  if (primeiro < "6" || primeiro > "9") return d;

  return `${d.slice(0, 2)}9${d.slice(2)}`;
}

/**
 * A chave que identifica um telefone, tolerante ao nono digito.
 *
 * ⚠️ DDD mais os OITO ultimos digitos, e nao os oito ultimos sozinhos. Com oito,
 * `(11) 99999-1234` e `(35) 99999-1234` casam entre si — dois clientes
 * diferentes, em estados diferentes, tratados como o mesmo. Com o DDD junto, a
 * chave continua imune ao 9 (que fica fora dos oito finais) e para de confundir
 * cidades.
 *
 * Numero sem DDI reconhecido cai nos oito finais, que e o que da para afirmar.
 */
export function chaveDoTelefone(bruto: string): string {
  const { ddi, local } = separarDdi(bruto);
  const d = digitosDoTelefone(local);

  if (d.length < 8) return d;
  if (ddi !== "55" || d.length < 10) return d.slice(-8);

  return `${d.slice(0, 2)}${d.slice(-8)}`;
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
/**
 * Os paises oferecidos no cadastro de numero.
 *
 * ⚠️ Lista curta de proposito, e nao a tabela E.164 inteira. Ela existe para
 * quem cadastra escolher o DDI sem decorar, e um seletor com 200 linhas atrapalha
 * mais que ajuda. Pais que falte se resolve digitando o numero completo.
 *
 * Ordenada por uso esperado, nao por alfabeto: o Brasil e o caso de quase todo
 * cadastro, e deixa-lo no meio da lista custaria uma rolagem por numero.
 */
export type Pais = {
  ddi: string;
  nome: string;
  bandeira: string;
  /**
   * Quantos digitos o numero LOCAL tem, sem o DDI.
   *
   * ⚠️ Lista, e nao um numero: o Brasil convive com 10 e 11 por causa do nono
   * digito, e validar so o maior recusaria fixo comercial que ainda existe.
   */
  tamanhos: number[];
  /** Como agrupar na exibicao. `9` e um digito; o resto e literal. */
  mascara: string;
};

export const PAISES: Pais[] = [
  { ddi: "55", nome: "Brasil", bandeira: "🇧🇷", tamanhos: [10, 11], mascara: "(99) 99999-9999" },
  { ddi: "351", nome: "Portugal", bandeira: "🇵🇹", tamanhos: [9], mascara: "999 999 999" },
  { ddi: "1", nome: "Estados Unidos e Canadá", bandeira: "🇺🇸", tamanhos: [10], mascara: "(999) 999-9999" },
  { ddi: "54", nome: "Argentina", bandeira: "🇦🇷", tamanhos: [10, 11], mascara: "(99) 9999-9999" },
  { ddi: "595", nome: "Paraguai", bandeira: "🇵🇾", tamanhos: [9], mascara: "999 999 999" },
  { ddi: "598", nome: "Uruguai", bandeira: "🇺🇾", tamanhos: [8, 9], mascara: "9 999 99 99" },
  { ddi: "56", nome: "Chile", bandeira: "🇨🇱", tamanhos: [9], mascara: "9 9999 9999" },
  { ddi: "244", nome: "Angola", bandeira: "🇦🇴", tamanhos: [9], mascara: "999 999 999" },
  { ddi: "258", nome: "Moçambique", bandeira: "🇲🇿", tamanhos: [9], mascara: "99 999 9999" },
  { ddi: "34", nome: "Espanha", bandeira: "🇪🇸", tamanhos: [9], mascara: "999 999 999" },
  { ddi: "44", nome: "Reino Unido", bandeira: "🇬🇧", tamanhos: [10], mascara: "9999 999999" },
];

export function paisDoDdi(ddi: string): Pais {
  // Brasil como reserva: e o cadastro de quase todo mundo, e um pais
  // desconhecido nao pode deixar o formulario sem mascara nenhuma.
  return PAISES.find((p) => p.ddi === ddi) ?? PAISES[0];
}

/**
 * Aplica a mascara do pais a um numero local.
 *
 * ⚠️ Para de consumir quando os digitos acabam, entao o campo nao mostra
 * parenteses e tracos de posicoes que a pessoa ainda nao digitou.
 */
export function mascaraDoPais(ddi: string, bruto: string): string {
  const pais = paisDoDdi(ddi);
  const d = digitosDoTelefone(bruto).slice(0, Math.max(...pais.tamanhos));

  if (!d) return "";

  let saida = "";
  let i = 0;

  for (const c of pais.mascara) {
    if (i >= d.length) break;

    if (c === "9") {
      saida += d[i];
      i += 1;
    } else {
      saida += c;
    }
  }

  // Sobrou digito depois da mascara: o Brasil com 11 nao cabe em 10 posicoes.
  return saida + d.slice(i);
}

/**
 * O numero local tem tamanho compativel com o pais?
 *
 * ⚠️ So o TAMANHO. Validar operadora e faixa exigiria uma base que muda toda
 * semana, e recusar numero valido por causa de tabela velha e pior que aceitar
 * um errado: aqui o erro aparece no primeiro envio, com a mensagem da Meta.
 */
export function telefoneValido(ddi: string, bruto: string): boolean {
  const d = digitosDoTelefone(bruto);
  return paisDoDdi(ddi).tamanhos.includes(d.length);
}

/** `v19.0`, `v23.0`. A Meta nomeia versao assim desde sempre. */
export function versaoDaApiValida(texto: string): boolean {
  return /^v\d{1,3}\.\d{1,2}$/.test(texto.trim());
}

/**
 * Um texto novo para o verify token.
 *
 * ⚠️ Quem cria e o SISTEMA, nao a Meta. Ele e um segredo combinado: a gente
 * inventa, cola no painel deles, e no handshake do webhook os dois comparam.
 * Por isso ele nasce pronto aqui e nao e um campo para preencher.
 */
export function novoVerifyToken(): string {
  const sorteio = () => Math.random().toString(36).slice(2, 10);
  return `vpay-${sorteio()}${sorteio()}`.slice(0, 24);
}

/**
 * Separa o DDI do resto, a partir do numero ja guardado.
 *
 * ⚠️ Testa do DDI MAIS LONGO para o mais curto. Comecar pelo curto faria "1"
 * casar antes de "351" e devolver Portugal como Estados Unidos com um numero
 * estranho junto.
 */
export function separarDdi(bruto: string): { ddi: string; local: string } {
  const d = digitosDoTelefone(bruto);

  const encontrado = [...PAISES]
    .sort((a, b) => b.ddi.length - a.ddi.length)
    .find((p) => d.startsWith(p.ddi));

  // Sem DDI reconhecido, assume Brasil e devolve o numero inteiro como local:
  // e o caso do cadastro antigo, gravado antes de existir seletor.
  if (!encontrado) return { ddi: "55", local: d };

  return { ddi: encontrado.ddi, local: d.slice(encontrado.ddi.length) };
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
 * ⚠️ O nono digito entra AQUI, no caminho de saida, e so em celular brasileiro.
 * O cadastro do cliente e digitado por gente e chega dos dois jeitos; a Meta
 * aceita os dois na entrega, mas o `wa_id` que ela devolve e sempre um so — e e
 * ele que vai casar com a conversa depois. Mandar sempre a forma de 11 deixa o
 * envio e a resposta no mesmo lugar.
 */
export function paraFormatoMeta(bruto: string): string {
  const d = digitosDoTelefone(bruto);

  if (d.length === 10 || d.length === 11) return `55${comNonoDigito("55", d)}`;
  if (d.length === 12 && d.startsWith("55")) return `55${comNonoDigito("55", d.slice(2))}`;

  return d;
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
