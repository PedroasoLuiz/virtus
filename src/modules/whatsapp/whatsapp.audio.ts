/**
 * Reembrulha audio Opus de WebM para Ogg.
 *
 * ⚠️ POR QUE ISTO EXISTE
 *
 * O Chrome so grava audio em dois formatos: `audio/webm` e `audio/mp4`. A Cloud
 * API nao aceita webm, e o mp4 dele e FRAGMENTADO — testado quatro vezes em
 * 04/08/2026: o upload passa, a Meta devolve o `wamid`, e o processamento falha
 * depois com "Media upload error". A mensagem nunca chega.
 *
 * Sobrou `audio/ogg` com Opus, que o Chrome nao produz. Mas o audio DENTRO do
 * webm dele ja e Opus: o que muda entre os dois arquivos e so a caixa. Entao
 * aqui nao ha transcodificacao — nenhuma amostra e recalculada, nenhuma perda de
 * qualidade, nenhum ffmpeg. Os pacotes sao retirados do container Matroska e
 * escritos num container Ogg.
 *
 * A alternativa era um codificador em WASM no navegador, que traria dependencia
 * nova e alguns megabytes de bundle para resolver o que sao ~200 linhas sem
 * dependencia nenhuma.
 */

/** O que o Ogg precisa saber sobre o fluxo, tirado do proprio WebM. */
type FluxoOpus = {
  /** `OpusHead`, que no Matroska vem em `CodecPrivate`. */
  cabecalho: Uint8Array;
  /** Um pacote Opus por bloco de audio. */
  pacotes: Uint8Array[];
};

export class AudioInvalidoError extends Error {}

/**
 * Converte o corpo de um `audio/webm;codecs=opus` em `audio/ogg;codecs=opus`.
 *
 * Lanca `AudioInvalidoError` quando o arquivo nao e o que diz ser — melhor
 * recusar aqui, com mensagem nossa, do que mandar para a Meta e receber de volta
 * um "Media upload error" que nao explica nada.
 */
export function webmOpusParaOgg(bytes: Uint8Array): Uint8Array {
  const fluxo = lerWebm(bytes);

  if (fluxo.pacotes.length === 0) {
    throw new AudioInvalidoError("A gravacao nao tem audio.");
  }

  return escreverOgg(fluxo);
}

// ── Leitura do WebM (Matroska) ──────────────────────────────────
//
// O formato e uma arvore de elementos `id + tamanho + conteudo`, ambos em
// tamanho variavel. So descemos nos poucos ramos que interessam.

const SEGMENT = 0x18538067;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const CODEC_PRIVATE = 0x63a2;
const CLUSTER = 0x1f43b675;
const BLOCK_GROUP = 0xa0;
const SIMPLE_BLOCK = 0xa3;
const BLOCK = 0xa1;

/** Elementos em que precisamos entrar, em vez de pular. */
const RAMOS = new Set([SEGMENT, TRACKS, TRACK_ENTRY, CLUSTER, BLOCK_GROUP]);

function lerWebm(b: Uint8Array): FluxoOpus {
  const pacotes: Uint8Array[] = [];

  /*
   * Caixa em vez de variavel solta: a atribuicao acontece dentro de `percorrer`,
   * e o TypeScript nao acompanha escrita feita por fechamento — leria o valor
   * como `null` para sempre depois daqui.
   */
  const achado: { cabecalho: Uint8Array | null } = { cabecalho: null };

  function percorrer(inicio: number, fim: number) {
    let i = inicio;

    while (i < fim) {
      const id = lerId(b, i);
      if (!id) return;

      const tam = lerTamanho(b, id.prox);
      if (!tam) return;

      /*
       * Tamanho desconhecido acontece de verdade: o `MediaRecorder` escreve em
       * fluxo, sem saber onde o `Segment` vai terminar. Nesse caso o elemento
       * vai ate o fim do que temos.
       */
      const conteudoFim =
        tam.valor == null ? fim : Math.min(fim, tam.prox + tam.valor);

      if (RAMOS.has(id.valor)) {
        percorrer(tam.prox, conteudoFim);
      } else if (id.valor === CODEC_PRIVATE && !achado.cabecalho) {
        achado.cabecalho = b.subarray(tam.prox, conteudoFim);
      } else if (id.valor === SIMPLE_BLOCK || id.valor === BLOCK) {
        const pacote = lerBloco(b, tam.prox, conteudoFim);
        if (pacote) pacotes.push(pacote);
      }

      if (conteudoFim <= i) return; // trava de seguranca contra arquivo corrompido
      i = conteudoFim;
    }
  }

  percorrer(0, b.length);

  if (!achado.cabecalho || achado.cabecalho.length < 8) {
    throw new AudioInvalidoError("A gravacao nao parece ser Opus.");
  }

  return { cabecalho: achado.cabecalho, pacotes };
}

/**
 * Miolo de um bloco: numero da trilha (tamanho variavel), 2 bytes de tempo,
 * 1 byte de sinalizadores, e entao o pacote.
 */
function lerBloco(b: Uint8Array, inicio: number, fim: number): Uint8Array | null {
  const trilha = lerTamanho(b, inicio);
  if (!trilha) return null;

  const sinalizadores = trilha.prox + 2;
  if (sinalizadores >= fim) return null;

  /*
   * Lacing (bits 1 e 2) empacota varios quadros num bloco so. O `MediaRecorder`
   * nao usa, e implementar os tres modos por um caso que nao acontece seria
   * codigo sem quem o exercite.
   */
  if ((b[sinalizadores] & 0x06) !== 0) {
    throw new AudioInvalidoError("A gravacao usa um empacotamento que nao sabemos ler.");
  }

  const dados = b.subarray(sinalizadores + 1, fim);
  return dados.length > 0 ? dados : null;
}

function lerId(b: Uint8Array, i: number): { valor: number; prox: number } | null {
  if (i >= b.length) return null;

  const largura = larguraDoVint(b[i]);
  if (!largura || i + largura > b.length) return null;

  let valor = 0;
  for (let k = 0; k < largura; k++) valor = valor * 256 + b[i + k];

  return { valor, prox: i + largura };
}

function lerTamanho(b: Uint8Array, i: number): { valor: number | null; prox: number } | null {
  if (i >= b.length) return null;

  const largura = larguraDoVint(b[i]);
  if (!largura || i + largura > b.length) return null;

  let valor = b[i] & (0xff >> largura);
  let todosUm = valor === (0xff >> largura);

  for (let k = 1; k < largura; k++) {
    valor = valor * 256 + b[i + k];
    if (b[i + k] !== 0xff) todosUm = false;
  }

  return { valor: todosUm ? null : valor, prox: i + largura };
}

/** Quantos bytes o inteiro ocupa, dado pelo primeiro bit ligado. */
function larguraDoVint(primeiro: number): number {
  for (let largura = 1; largura <= 8; largura++) {
    if (primeiro & (0x80 >> (largura - 1))) return largura;
  }
  return 0;
}

// ── Escrita do Ogg ──────────────────────────────────────────────
//
// O Ogg e uma sequencia de paginas. Cada uma tem cabecalho de 27 bytes, uma
// tabela dizendo como os pacotes se dividem, e o conteudo.

const MAXIMO_DE_SEGMENTOS = 255;

function escreverOgg(fluxo: FluxoOpus): Uint8Array {
  // Serial fixo: o arquivo tem um fluxo so, e nada aqui depende de sorteio.
  const serial = 0x5650_4159; // "VPAY"
  const paginas: Uint8Array[] = [];
  let sequencia = 0;

  // Pagina de abertura: o OpusHead sozinho, marcado como inicio do fluxo.
  paginas.push(montarPagina([fluxo.cabecalho], 0, 0x02, serial, sequencia++));

  // Comentarios. Obrigatorios pela especificacao, ainda que vazios.
  paginas.push(montarPagina([opusTags()], 0, 0x00, serial, sequencia++));

  let amostras = 0;
  let lote: Uint8Array[] = [];
  let segmentosDoLote = 0;

  const fecharLote = (ultima: boolean) => {
    if (lote.length === 0) return;
    paginas.push(montarPagina(lote, amostras, ultima ? 0x04 : 0x00, serial, sequencia++));
    lote = [];
    segmentosDoLote = 0;
  };

  for (let i = 0; i < fluxo.pacotes.length; i++) {
    const pacote = fluxo.pacotes[i];
    const segmentos = Math.floor(pacote.length / 255) + 1;

    // Uma pagina cabe 255 segmentos. Estourando, fecha e comeca outra.
    if (segmentosDoLote + segmentos > MAXIMO_DE_SEGMENTOS) fecharLote(false);

    lote.push(pacote);
    segmentosDoLote += segmentos;

    /*
     * A posicao granular conta AMOSTRAS a 48 kHz, nao bytes nem milissegundos.
     * E ela que da a duracao do audio; errar aqui faz o player mostrar o tempo
     * errado ou nem tocar.
     */
    amostras += amostrasDoPacote(pacote);
  }

  fecharLote(true);
  return juntar(paginas);
}

function opusTags(): Uint8Array {
  const fornecedor = new TextEncoder().encode("vpay");
  const saida = new Uint8Array(8 + 4 + fornecedor.length + 4);

  saida.set(new TextEncoder().encode("OpusTags"), 0);
  escreverU32(saida, 8, fornecedor.length);
  saida.set(fornecedor, 12);
  escreverU32(saida, 12 + fornecedor.length, 0); // nenhum comentario

  return saida;
}

function montarPagina(
  pacotes: Uint8Array[],
  granular: number,
  tipo: number,
  serial: number,
  sequencia: number,
): Uint8Array {
  const tabela: number[] = [];

  for (const pacote of pacotes) {
    let restante = pacote.length;
    while (restante >= 255) {
      tabela.push(255);
      restante -= 255;
    }
    tabela.push(restante);
  }

  const corpo = juntar(pacotes);
  const pagina = new Uint8Array(27 + tabela.length + corpo.length);

  pagina.set(new TextEncoder().encode("OggS"), 0);
  pagina[4] = 0; // versao
  pagina[5] = tipo;

  // Granular e de 64 bits; 32 bastam para ~24 horas de audio, e o resto fica em
  // zero. Gravacao de voz nao chega perto disso.
  escreverU32(pagina, 6, granular >>> 0);
  escreverU32(pagina, 10, Math.floor(granular / 4294967296));

  escreverU32(pagina, 14, serial);
  escreverU32(pagina, 18, sequencia);
  escreverU32(pagina, 22, 0); // CRC entra depois, com o campo zerado
  pagina[26] = tabela.length;
  pagina.set(tabela, 27);
  pagina.set(corpo, 27 + tabela.length);

  escreverU32(pagina, 22, crc32Ogg(pagina));
  return pagina;
}

/**
 * Duracao do pacote em amostras de 48 kHz, lida do byte TOC.
 *
 * O byte diz a configuracao (que fixa o tamanho do quadro) e quantos quadros o
 * pacote carrega. Assumir 20 ms funcionaria para o `MediaRecorder` de hoje, e
 * quebraria calado no dia em que ele mudasse.
 */
function amostrasDoPacote(pacote: Uint8Array): number {
  if (pacote.length === 0) return 0;

  const toc = pacote[0];
  const config = toc >> 3;
  const modo = toc & 0x03;

  const duracao = duracaoDoQuadro(config);

  let quadros = 1;
  if (modo === 1 || modo === 2) quadros = 2;
  else if (modo === 3) quadros = pacote.length > 1 ? pacote[1] & 0x3f : 1;

  return Math.round(duracao * 48 * quadros);
}

/** Tamanho do quadro em milissegundos, por configuracao do Opus. */
function duracaoDoQuadro(config: number): number {
  // SILK: 10, 20, 40 e 60 ms, repetidos em tres larguras de banda.
  if (config < 12) return [10, 20, 40, 60][config % 4];
  // Hibrido: so 10 e 20 ms.
  if (config < 16) return [10, 20][config % 2];
  // CELT: 2.5, 5, 10 e 20 ms.
  return [2.5, 5, 10, 20][config % 4];
}

// ── Utilitarios ─────────────────────────────────────────────────

function escreverU32(alvo: Uint8Array, i: number, valor: number) {
  alvo[i] = valor & 0xff;
  alvo[i + 1] = (valor >>> 8) & 0xff;
  alvo[i + 2] = (valor >>> 16) & 0xff;
  alvo[i + 3] = (valor >>> 24) & 0xff;
}

function juntar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, p) => soma + p.length, 0);
  const saida = new Uint8Array(total);

  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }

  return saida;
}

/**
 * CRC do Ogg.
 *
 * ⚠️ NAO e o CRC-32 comum (o do zip e do PNG). O Ogg usa o mesmo polinomio sem
 * reflexao de bits e sem inversao final, entao uma implementacao pronta de
 * `crc32` produz um valor que todo player recusa.
 */
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let bit = 0; bit < 8; bit++) {
      r = r & 0x80000000 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0;
    }
    t[i] = r >>> 0;
  }

  return t;
})();

function crc32Ogg(dados: Uint8Array): number {
  let crc = 0;

  for (const byte of dados) {
    crc = ((crc << 8) ^ TABELA_CRC[((crc >>> 24) & 0xff) ^ byte]) >>> 0;
  }

  return crc >>> 0;
}
