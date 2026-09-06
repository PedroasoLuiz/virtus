/**
 * A marca escrita: `vope.`
 *
 * ⚠️ Um lugar so, ainda que apareca em dois. O login e a barra lateral
 * desenhavam o logotipo cada um por conta, com o mesmo `<span>` colorido
 * copiado — e foi assim que a marca ficou verde na tela de login por um mes
 * depois de virar azul em todo o resto. Identidade que se escreve duas vezes
 * diverge na primeira troca.
 *
 * ⚠️ Minusculo, e o PONTO e a unica parte colorida. Nao e enfeite: o nome sem
 * o ponto vira uma palavra qualquer no meio da tela, e o ponto colorido e o que
 * o olho encontra primeiro. Colorir a letra inicial (o que se fazia antes) briga
 * com o resto da interface, onde `--primary` significa "clique aqui".
 *
 * Sem `"use client"`: nao ha estado nem evento aqui. Assim a barra lateral, que
 * e client, e a tela de login, que e server, usam a mesma peca.
 */
export function Marca({ tamanho = "var(--text-xl)" }: { tamanho?: string }) {
  return (
    <span
      style={{
        fontSize: tamanho,
        fontWeight: "var(--fw-bold)",
        /* Negativo de proposito: em caixa baixa as letras ja se apoiam umas nas
           outras, e o espacamento padrao faria a palavra parecer soletrada. */
        letterSpacing: "var(--tracking-tight)",
        color: "var(--text-primary)",
        whiteSpace: "nowrap",
      }}
    >
      vope<span style={{ color: "var(--primary)" }}>.</span>
    </span>
  );
}
