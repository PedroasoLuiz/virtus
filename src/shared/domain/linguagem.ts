/**
 * Filtro de palavrao para textos que a equipe escreve e o cliente pode ver.
 *
 * ⚠️ Lista curta e deliberadamente conservadora. O objetivo nao e moderar
 * conteudo: e impedir que um apelido escrito no calor da hora apareca num
 * seletor durante uma reuniao, ou vaze para um documento gerado.
 *
 * ⚠️ Compara com FRONTEIRA de palavra e sem acento. Sem a fronteira, "assessoria"
 * casaria com um palavrao de tres letras e o cadastro seria recusado sem
 * ninguem entender por que.
 */

const PALAVRAS = [
  "buceta", "caralho", "cacete", "cu", "cuzao", "foda", "foder", "fodase",
  "merda", "porra", "puta", "puto", "putaria", "viado", "viadinho", "arrombado",
  "corno", "otario", "babaca", "escroto", "desgraca", "piroca", "pinto",
  "boquete", "punheta", "vagabundo", "vagabunda", "fdp", "pqp",
];

/** Sem acento e sem maiuscula, que e como a comparacao acontece. */
function achatar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function temPalavrao(texto: string): boolean {
  const limpo = achatar(texto);

  return PALAVRAS.some((palavra) =>
    // `\\b` nao funciona com acento no JavaScript, mas aqui o texto ja chegou
    // achatado, entao a fronteira volta a ser confiavel.
    new RegExp(`\\b${palavra}\\b`).test(limpo),
  );
}
