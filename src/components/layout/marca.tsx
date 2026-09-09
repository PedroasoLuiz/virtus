import Image from "next/image";

/**
 * O logotipo do Vope: o simbolo mais o nome.
 *
 * ⚠️ Um lugar so, ainda que apareca em dois. O login e a barra lateral
 * desenhavam a marca cada um por conta, com o mesmo `<span>` colorido copiado,
 * e foi assim que ela ficou verde na tela de login por um mes depois de virar
 * azul em todo o resto. Identidade que se escreve duas vezes diverge na
 * primeira troca.
 *
 * ⚠️ A imagem no lugar da marca ESCRITA que morava aqui (`vope.` em texto, com
 * o ponto colorido). O desenho tem simbolo, e e ele que se reconhece de longe;
 * o texto so tinha a palavra. Quem quiser a versao escrita de volta, ela esta no
 * historico deste arquivo.
 *
 * ⚠️ DOIS ARQUIVOS, e nao um com `filter`. O logotipo e um simbolo azul com o
 * nome em preto: inverter para o tema escuro clarearia o nome e estragaria o
 * simbolo junto. O `-escuro` e o mesmo desenho com apenas o nome trocado por
 * branco.
 *
 * ⚠️ Quem escolhe entre os dois e o CSS (ver `globals.css`), e nao JavaScript
 * lendo o tema: os dois ja chegam na pagina e o navegador decide na primeira
 * pintura. Decidir depois faria a marca trocar de cor na frente da pessoa toda
 * vez que a tela abrisse.
 *
 * Sem `"use client"`: nao ha estado nem evento aqui. Assim a barra lateral, que
 * e client, e a tela de login, que e server, usam a mesma peca.
 */
export function LogotipoVope({ altura = 28 }: { altura?: number }) {
  /* A proporcao do arquivo (3497x1024). Cravada aqui e nao calculada em tela:
     e o `next/image` que precisa dela para reservar o espaco antes de baixar. */
  const largura = Math.round(altura * (3497 / 1024));
  const comum = { width: largura, height: altura, priority: true };

  return (
    <span style={{ display: "inline-flex", lineHeight: 0 }}>
      <Image {...comum} alt="vope" src="/marca/logohorizontal.png" className="logotipo-vope-claro" />
      <Image
        {...comum}
        alt="vope"
        src="/marca/logohorizontal-escuro.png"
        className="logotipo-vope-escuro"
      />
    </span>
  );
}
