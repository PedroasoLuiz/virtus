import React from "react";

/**
 * Negrito e italico do WhatsApp (`*assim*`, `_assim_`).
 *
 * Existe porque a assinatura do autor sai em `*Nome:*` — sem isto o cliente ve
 * negrito e quem responde ve os asteriscos crus, e a tela mentiria sobre o que
 * foi enviado. Serve tambem para o que CHEGA, que usa a mesma marcacao.
 *
 * Monta nos de React em vez de HTML: `dangerouslySetInnerHTML` sobre texto que
 * um terceiro escreveu e injecao esperando acontecer.
 */
export function comFormatacaoDoWhatsapp(texto: string): React.ReactNode[] {
  const partes: React.ReactNode[] = [];
  // `**assim**` antes de `*assim*`: a alternancia e testada em ordem, e o padrao
  // de um asterisco casaria com os dois primeiros de `**`, deixando o resto
  // solto na tela.
  const padrao = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;

  let ultimo = 0;
  let achado: RegExpExecArray | null;

  while ((achado = padrao.exec(texto)) !== null) {
    if (achado.index > ultimo) partes.push(texto.slice(ultimo, achado.index));

    const trecho = achado[0];
    const dobrado = trecho.startsWith("**");
    const marcas = dobrado ? 2 : 1;
    const miolo = trecho.slice(marcas, -marcas);

    partes.push(
      trecho.startsWith("*") ? (
        <strong key={achado.index}>{miolo}</strong>
      ) : (
        <em key={achado.index}>{miolo}</em>
      ),
    );

    ultimo = achado.index + trecho.length;
  }

  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}
