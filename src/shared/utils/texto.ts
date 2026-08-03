/**
 * Primeiro texto que realmente tem conteudo.
 *
 * `??` nao serve para escolher entre nomes vindos do banco: ele so cai para o
 * proximo em `null`/`undefined`, e string VAZIA passa. O cadastro herdado tem
 * `nomefantasia = ''` em varios clientes — com `??`, o ticket exibia nome em
 * branco e parecia salvo sem cliente.
 */
export function primeiroPreenchido(...valores: (string | null | undefined)[]): string | null {
  for (const v of valores) {
    const limpo = (v ?? "").trim();
    if (limpo) return limpo;
  }
  return null;
}
